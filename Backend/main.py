import json
import os
import re
import time
from collections import defaultdict, deque
from typing import Literal

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from groq import Groq
from pydantic import BaseModel, Field

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
# HS256 secret from Supabase Dashboard > Settings > API > JWT Secret.
# If unset, falls back to the project's JWKS (newer asymmetric-key projects).
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")

app = FastAPI(title="AI Planner")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(
            f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        )
    return _jwks_client


def get_user(request: Request) -> dict:
    """Verify the Supabase JWT and return {'id': ..., 'token': ...}."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = auth.removeprefix("Bearer ")
    try:
        if SUPABASE_JWT_SECRET:
            claims = jwt.decode(
                token, SUPABASE_JWT_SECRET,
                algorithms=["HS256"], audience="authenticated",
            )
        else:
            key = _get_jwks_client().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token, key.key,
                algorithms=["ES256", "RS256"], audience="authenticated",
            )
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    return {"id": claims["sub"], "token": token}


# --- Simple per-user rate limit for the LLM endpoint ---

_hits: dict[str, deque] = defaultdict(deque)
GENERATE_LIMIT = 10  # requests
GENERATE_WINDOW = 60  # seconds


def rate_limit(user_id: str):
    now = time.monotonic()
    q = _hits[user_id]
    while q and now - q[0] > GENERATE_WINDOW:
        q.popleft()
    if len(q) >= GENERATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests; wait a minute.")
    q.append(now)


# --- Supabase REST (PostgREST) with the *user's* token, so RLS applies ---

def db_headers(user: dict) -> dict:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {user['token']}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


DB_URL = f"{SUPABASE_URL}/rest/v1/schedules"


async def db_request(method: str, user: dict, params: dict | None = None,
                     json_body=None, url: str = DB_URL):
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.request(method, url, params=params,
                                   json=json_body, headers=db_headers(user))
    if res.status_code >= 400:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    return res.json() if res.text else None


# --- Models ---

PlanType = Literal["daily", "monthly", "yearly"]


class EventInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    duration: str = Field(default="", max_length=100)


class GenerateRequest(BaseModel):
    type: PlanType
    period_start: str  # ISO date
    events: list[EventInput] = Field(min_length=1, max_length=50)
    requirement: str = Field(default="", max_length=1000)


class ScheduleBody(BaseModel):
    type: PlanType
    period_start: str
    title: str = Field(default="", max_length=200)
    requirement: str = Field(default="", max_length=1000)
    items: list[dict]


# --- LLM generation ---

PROMPTS = {
    "daily": (
        "Create a realistic daily schedule for {period} with these events/tasks:\n{events}\n"
        "Requirements: {req}\n\n"
        "Respond with ONLY a JSON array. Each item must have keys: "
        '"name", "start" (e.g. "9:00 AM"), "end" (e.g. "10:30 AM"). '
        "Do not overlap events. Order chronologically."
    ),
    "monthly": (
        "Distribute these tasks across the days of the month starting {period} "
        "({days} days):\n{events}\n"
        "Requirements: {req}\n\n"
        "Respond with ONLY a JSON array. Each item must have keys: "
        '"name" and "day" (integer 1-{days}). Spread work sensibly; a task may '
        "appear on multiple days if its duration warrants it."
    ),
    "yearly": (
        "Distribute these goals/milestones across the 12 months of the year "
        "starting {period}:\n{events}\n"
        "Requirements: {req}\n\n"
        "Respond with ONLY a JSON array. Each item must have keys: "
        '"name" and "month" (integer 1-12). Sequence them logically; a goal may '
        "span multiple months as separate entries."
    ),
}


def extract_json(text: str):
    """Parse JSON from LLM output, stripping markdown fences or prose."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
    return None


def days_in_month(iso_date: str) -> int:
    import calendar
    y, m, _ = (int(p) for p in iso_date.split("-"))
    return calendar.monthrange(y, m)[1]


ITEM_KEYS = {"daily": {"name", "start", "end"},
             "monthly": {"name", "day"},
             "yearly": {"name", "month"}}


def sanitize_items(plan_type: PlanType, items) -> list[dict]:
    """Keep only expected keys and string-coerce values before storing/returning."""
    if not isinstance(items, list):
        raise HTTPException(status_code=502, detail="LLM returned a non-list schedule.")
    clean = []
    for it in items:
        if not isinstance(it, dict):
            continue
        entry = {}
        for k in ITEM_KEYS[plan_type]:
            v = it.get(k)
            if k in ("day", "month"):
                try:
                    entry[k] = int(v)
                except (TypeError, ValueError):
                    entry = None
                    break
            else:
                entry[k] = str(v or "")[:200]
        if entry and entry.get("name"):
            clean.append(entry)
    return clean


@app.post("/api/generate")
async def generate(body: GenerateRequest, user: dict = Depends(get_user)):
    rate_limit(user["id"])
    events_text = "\n".join(
        f"- {e.name}" + (f" ({e.duration})" if e.duration else "")
        for e in body.events
    )
    prompt = PROMPTS[body.type].format(
        period=body.period_start,
        events=events_text,
        req=body.requirement or "none",
        days=days_in_month(body.period_start),
    )
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_completion_tokens=2048,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")

    items = extract_json(completion.choices[0].message.content)
    if items is None:
        raise HTTPException(status_code=502, detail="LLM returned unparseable output.")
    return {"items": sanitize_items(body.type, items)}


# --- Schedule CRUD (RLS scopes every query to the requesting user) ---

@app.get("/api/schedules")
async def list_schedules(type: PlanType | None = None,
                         user: dict = Depends(get_user)):
    params = {"select": "*", "order": "period_start.desc,created_at.desc"}
    if type:
        params["type"] = f"eq.{type}"
    return await db_request("GET", user, params=params)


@app.post("/api/schedules")
async def create_schedule(body: ScheduleBody, user: dict = Depends(get_user)):
    rows = await db_request("POST", user, json_body={
        **body.model_dump(), "items": sanitize_items(body.type, body.items),
        "user_id": user["id"],
    })
    return rows[0]


@app.put("/api/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, body: ScheduleBody,
                          user: dict = Depends(get_user)):
    rows = await db_request(
        "PATCH", user, params={"id": f"eq.{schedule_id}"},
        json_body={**body.model_dump(),
                   "items": sanitize_items(body.type, body.items)},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return rows[0]


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(get_user)):
    await db_request("DELETE", user, params={"id": f"eq.{schedule_id}"})
    return {"ok": True}


# --- Serve the built frontend (production) ---

DIST = os.path.join(os.path.dirname(__file__), "..", "Frontend", "dist")

if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")),
              name="assets")

    @app.get("/{path:path}")
    async def spa(path: str):
        file = os.path.join(DIST, path)
        if path and os.path.isfile(file):
            return FileResponse(file)
        return FileResponse(os.path.join(DIST, "index.html"))
