import calendar
import contextlib
import json
import logging
import os
import re
import time
import uuid
from collections import defaultdict, deque
from datetime import date
from typing import Literal

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from groq import AsyncGroq
from pydantic import BaseModel, Field

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
# HS256 secret from Supabase Dashboard > Settings > API > JWT Secret.
# If unset, falls back to the project's JWKS (newer asymmetric-key projects).
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
MAX_BODY_BYTES = 1_000_000

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("ai-planner")

http_client: httpx.AsyncClient | None = None


@contextlib.asynccontextmanager
async def lifespan(_app):
    global http_client
    http_client = httpx.AsyncClient(timeout=15)
    yield
    await http_client.aclose()


app = FastAPI(title="AI Planner", docs_url=None, redoc_url=None, openapi_url=None,
              lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    f"connect-src 'self' {SUPABASE_URL}; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


@app.middleware("http")
async def security_and_limits(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "Request body too large."}, status_code=413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = CSP
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


groq_client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
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
                issuer=f"{SUPABASE_URL}/auth/v1", leeway=30,
            )
        else:
            key = _get_jwks_client().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token, key.key,
                algorithms=["ES256", "RS256"], audience="authenticated",
                issuer=f"{SUPABASE_URL}/auth/v1", leeway=30,
            )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token has no subject.")
    return {"id": sub, "token": token}


# --- Simple per-user rate limits (single-instance; resets on restart) ---

class RateLimiter:
    def __init__(self, limit: int, window: float):
        self.limit = limit
        self.window = window
        self.hits: dict[str, deque] = defaultdict(deque)
        self.last_sweep = time.monotonic()

    def check(self, user_id: str):
        now = time.monotonic()
        if now - self.last_sweep > 300:  # drop idle users so memory stays bounded
            self.last_sweep = now
            for uid in [u for u, q in self.hits.items() if not q or now - q[-1] > self.window]:
                del self.hits[uid]
        q = self.hits[user_id]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise HTTPException(status_code=429, detail="Too many requests; wait a minute.")
        q.append(now)


llm_limiter = RateLimiter(limit=10, window=60)     # LLM endpoints (costs money)
write_limiter = RateLimiter(limit=60, window=60)   # DB write endpoints


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
    try:
        res = await http_client.request(method, url, params=params,
                                        json=json_body, headers=db_headers(user))
    except httpx.HTTPError:
        log.exception("Supabase request failed")
        raise HTTPException(status_code=502, detail="Database unavailable; try again.")
    if res.status_code >= 400:
        log.warning("Supabase error %s: %s", res.status_code, res.text[:500])
        detail = "Database request failed."
        if res.status_code in (401, 403):
            detail = "Not authorized."
        raise HTTPException(status_code=res.status_code if res.status_code < 500 else 502,
                            detail=detail)
    return res.json() if res.text else None


# --- Models ---

PlanType = Literal["daily", "monthly", "yearly"]


class EventInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    duration: str = Field(default="", max_length=100)


class GenerateRequest(BaseModel):
    type: PlanType
    period_start: date
    events: list[EventInput] = Field(min_length=1, max_length=50)
    requirement: str = Field(default="", max_length=1000)


class RefineRequest(BaseModel):
    type: PlanType
    period_start: date
    items: list[dict] = Field(min_length=1, max_length=200)
    instruction: str = Field(min_length=1, max_length=1000)


class ParseTasksRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class ScheduleBody(BaseModel):
    type: PlanType
    period_start: date
    title: str = Field(default="", max_length=200)
    requirement: str = Field(default="", max_length=1000)
    items: list[dict] = Field(max_length=200)


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

REFINE_PROMPT = (
    "Here is an existing {kind} schedule as a JSON array:\n{items}\n\n"
    "Apply this change requested by the user: {instruction}\n\n"
    "Keep every item the user did not ask to change. Preserve any \"done\" flags. "
    "Respond with ONLY the full updated JSON array in the same format ({fmt})."
)

REFINE_FMT = {
    "daily": 'keys "name", "start" (e.g. "9:00 AM"), "end"; no overlaps; chronological order',
    "monthly": 'keys "name" and "day" (integer, valid day of that month)',
    "yearly": 'keys "name" and "month" (integer 1-12)',
}

PARSE_PROMPT = (
    "Extract a task list from this text:\n---\n{text}\n---\n"
    "Respond with ONLY a JSON array. Each item must have keys: "
    '"name" (short task name) and "duration" (e.g. "2h", "30m", or "" if not stated). '
    "Do not invent tasks that are not in the text. Max 50 tasks."
)


async def llm_json(prompt: str):
    try:
        completion = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_completion_tokens=2048,
        )
    except Exception:
        log.exception("Groq request failed")
        raise HTTPException(status_code=502, detail="The AI service is unavailable; try again.")
    parsed = extract_json(completion.choices[0].message.content)
    if parsed is None:
        raise HTTPException(status_code=502, detail="The AI returned an unusable answer; try again.")
    return parsed


def extract_json(text: str):
    """Parse JSON from LLM output, stripping markdown fences or prose."""
    text = (text or "").strip()
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


def days_in_month(d: date) -> int:
    return calendar.monthrange(d.year, d.month)[1]


ITEM_KEYS = {"daily": {"name", "start", "end"},
             "monthly": {"name", "day"},
             "yearly": {"name", "month"}}
INT_RANGE = {"day": (1, 31), "month": (1, 12)}


def sanitize_items(plan_type: PlanType, items, max_day: int = 31) -> list[dict]:
    """Keep only expected keys, coerce values, and range-check before storing/returning."""
    if not isinstance(items, list):
        raise HTTPException(status_code=502, detail="Schedule must be a list of items.")
    clean = []
    for it in items[:200]:
        if not isinstance(it, dict):
            continue
        entry = {}
        for k in ITEM_KEYS[plan_type]:
            v = it.get(k)
            if k in INT_RANGE:
                lo, hi = INT_RANGE[k]
                if k == "day":
                    hi = min(hi, max_day)
                try:
                    n = int(v)
                except (TypeError, ValueError):
                    entry = None
                    break
                if not lo <= n <= hi:
                    entry = None
                    break
                entry[k] = n
            else:
                entry[k] = str(v or "")[:200]
        if entry and entry.get("name"):
            if isinstance(it.get("done"), bool):
                entry["done"] = it["done"]
            clean.append(entry)
    return clean


def sanitize_for(plan_type: PlanType, period_start: date, items) -> list[dict]:
    return sanitize_items(plan_type, items, max_day=days_in_month(period_start))


# --- Health ---

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# --- LLM endpoints ---

@app.post("/api/generate")
async def generate(body: GenerateRequest, user: dict = Depends(get_user)):
    llm_limiter.check(user["id"])
    events_text = "\n".join(
        f"- {e.name}" + (f" ({e.duration})" if e.duration else "")
        for e in body.events
    )
    prompt = PROMPTS[body.type].format(
        period=body.period_start.isoformat(),
        events=events_text,
        req=body.requirement or "none",
        days=days_in_month(body.period_start),
    )
    items = await llm_json(prompt)
    return {"items": sanitize_for(body.type, body.period_start, items)}


@app.post("/api/refine")
async def refine(body: RefineRequest, user: dict = Depends(get_user)):
    llm_limiter.check(user["id"])
    current = sanitize_for(body.type, body.period_start, body.items)
    if not current:
        raise HTTPException(status_code=422, detail="Nothing to refine yet.")
    prompt = REFINE_PROMPT.format(
        kind=body.type,
        items=json.dumps(current),
        instruction=body.instruction,
        fmt=REFINE_FMT[body.type],
    )
    items = await llm_json(prompt)
    cleaned = sanitize_for(body.type, body.period_start, items)
    if not cleaned:
        raise HTTPException(status_code=502, detail="The AI returned an unusable answer; try again.")
    return {"items": cleaned}


@app.post("/api/parse-tasks")
async def parse_tasks(body: ParseTasksRequest, user: dict = Depends(get_user)):
    llm_limiter.check(user["id"])
    parsed = await llm_json(PARSE_PROMPT.format(text=body.text))
    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="The AI returned an unusable answer; try again.")
    events = []
    for it in parsed[:50]:
        if isinstance(it, dict) and str(it.get("name") or "").strip():
            events.append({
                "name": str(it["name"]).strip()[:200],
                "duration": str(it.get("duration") or "")[:100],
            })
    return {"events": events}


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
    write_limiter.check(user["id"])
    rows = await db_request("POST", user, json_body={
        **body.model_dump(mode="json"),
        "items": sanitize_for(body.type, body.period_start, body.items),
        "user_id": user["id"],
    })
    if not rows:
        raise HTTPException(status_code=502, detail="Database request failed.")
    return rows[0]


@app.put("/api/schedules/{schedule_id}")
async def update_schedule(schedule_id: uuid.UUID, body: ScheduleBody,
                          user: dict = Depends(get_user)):
    write_limiter.check(user["id"])
    rows = await db_request(
        "PATCH", user, params={"id": f"eq.{schedule_id}"},
        json_body={**body.model_dump(mode="json"),
                   "items": sanitize_for(body.type, body.period_start, body.items)},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return rows[0]


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: uuid.UUID, user: dict = Depends(get_user)):
    write_limiter.check(user["id"])
    await db_request("DELETE", user, params={"id": f"eq.{schedule_id}"})
    return {"ok": True}


# --- Serve the built frontend (production) ---

DIST = os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "Frontend", "dist"))

if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")),
              name="assets")

    @app.get("/{path:path}")
    async def spa(path: str):
        file = os.path.realpath(os.path.join(DIST, path))
        # Never serve anything outside dist/ (blocks ../ traversal).
        if path and file.startswith(DIST + os.sep) and os.path.isfile(file):
            return FileResponse(file)
        return FileResponse(os.path.join(DIST, "index.html"))
