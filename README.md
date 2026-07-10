# AI Planner

Full-stack scheduling app: enter your tasks and how long they take, and an LLM
builds your schedule — daily (time blocks), monthly (tasks on calendar days),
or yearly (goals across months). Edit with drag-and-drop, stretch-to-resize,
or click-to-edit. Every plan is saved per-user.

**Stack:** React 19 + Tailwind 4 (Vite) · FastAPI · Supabase (Postgres + Auth,
Google OAuth 2.0 + email) · Groq (Llama 3.3 70B) · Docker · Render

**Security:** JWT-verified API (no direct client→DB writes), Postgres
Row-Level Security as defense-in-depth, per-user rate limiting on the LLM
endpoint, Pydantic validation, LLM output sanitized before storage.

## One-time Supabase setup

1. **Database** — Dashboard → SQL Editor → run `supabase-setup.sql`.
   ⚠️ It drops the old `schedules` table.
2. **JWT secret** — Dashboard → Settings → API → copy **JWT Secret** into
   `Backend/.env` as `SUPABASE_JWT_SECRET`.
3. **Google sign-in** — Dashboard → Authentication → Providers → Google:
   - Create an OAuth client at https://console.cloud.google.com/apis/credentials
     (type: Web application).
   - Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Paste the client ID + secret into the Supabase Google provider and enable it.
4. **Redirect URLs** — Dashboard → Authentication → URL Configuration: add
   `http://localhost:5173`, `http://localhost:8000`, and your production URL.

## Run locally (dev)

```bash
# Terminal 1 — API
cd Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend with hot reload
cd Frontend
npm install
npm run dev        # http://localhost:5173
```

## Run as one server (production mode)

```bash
cd Frontend && npm run build && cd ../Backend && uvicorn main:app --port 8000
# → http://localhost:8000 serves the app + API
```

Or with Docker: `docker build -t ai-planner . && docker run -p 8000:8000 --env-file Backend/.env ai-planner`

## Deploy to Render

1. Push this repo to GitHub.
2. https://dashboard.render.com → New → Blueprint → pick the repo
   (`render.yaml` configures everything).
3. Set the env vars it asks for: `GROQ_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_KEY`.
4. Add the Render URL to Supabase Auth → URL Configuration → Redirect URLs.

## Environment variables

| File | Keys |
|---|---|
| `Backend/.env` | `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` |
| `Frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (anon key — public by design) |

Never commit `.env` files (already gitignored).
