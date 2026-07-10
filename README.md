# AI Planner

Full-stack scheduling app: enter your tasks and how long they take, and an LLM
builds your schedule — daily (time blocks), monthly (tasks on calendar days),
or yearly (goals across months). Edit with drag-and-drop, stretch-to-resize,
or click-to-edit; refine the whole plan with a plain-English instruction, mark
items done, and export daily/monthly plans to your calendar (`.ics`). Every
plan is saved per-user.

**Stack:** React 19 + Tailwind 4 (Vite) · FastAPI · Supabase (Postgres + Auth,
Google OAuth 2.0 + email + password reset) · Groq (Llama 3.3 70B) · Docker · Render

### AI features
- **Generate** a daily/monthly/yearly plan from a task list + free-text requirements.
- **Quick-add** tasks from a sentence ("gym for an hour, 3h studying, call mom").
- **Refine** an existing plan with an instruction ("move gym before lunch"), with one-level undo.

### Security
- JWT-verified API — the browser never writes to the database directly. The
  backend verifies the Supabase token (HS256 secret or JWKS), pinning both
  audience and issuer, and forwards the user's own token to PostgREST.
- Postgres **Row-Level Security** scopes every row to its owner (defense-in-depth).
- **Security headers** on every response: CSP, `X-Frame-Options: DENY`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS over HTTPS.
- Per-user **rate limits** (LLM and write endpoints), a **1 MB request-body cap**,
  and Pydantic validation on every input.
- LLM output is **range-checked and sanitized** (allowed keys only, day/month
  bounds, length caps) before it is stored or returned.
- Static file server is **path-traversal-safe** (realpath containment check).
- Upstream database errors are logged server-side and returned as generic
  messages — no internal details leak to the client.

## One-time Supabase setup

1. **Database** — Dashboard → SQL Editor → run `supabase-setup.sql`.
   ⚠️ It drops the old `schedules` table.
2. **JWT secret** — Dashboard → Settings → API → copy **JWT Secret** into
   `Backend/.env` as `SUPABASE_JWT_SECRET` (legacy HS256 projects). On newer
   asymmetric-key projects, leave it empty — the API verifies via JWKS.
3. **Google sign-in** — Dashboard → Authentication → Providers → Google:
   - Create an OAuth client at https://console.cloud.google.com/apis/credentials
     (type: Web application).
   - Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
   - Paste the client ID + secret into the Supabase Google provider and enable it.
4. **Redirect URLs** — Dashboard → Authentication → URL Configuration: add
   `http://localhost:5173`, `http://localhost:8000`, and your production URL
   (password-reset and OAuth links return the user here).

## Run locally (dev)

```bash
# Copy env templates and fill them in
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env

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

## Tests

```bash
cd Backend && pip install -r requirements-dev.txt && pytest     # API + auth + sanitizer
cd Frontend && npm test                                         # time + ics helpers
```

CI (`.github/workflows/ci.yml`) runs lint, both test suites, and a production
Docker build on every push and PR.

## Run as one server (production mode)

```bash
cd Frontend && npm run build && cd ../Backend && uvicorn main:app --port 8000
# → http://localhost:8000 serves the app + API
```

Or with Docker:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://<your-project>.supabase.co \
  --build-arg VITE_SUPABASE_KEY=<anon-key> \
  -t ai-planner .
docker run -p 8000:8000 --env-file Backend/.env ai-planner
```

The `VITE_*` values are needed at **build time** (Vite inlines them into the
bundle); the rest are read at runtime from the environment.

## Deploy to Render

1. Push this repo to GitHub.
2. https://dashboard.render.com → New → Blueprint → pick the repo
   (`render.yaml` configures the service, health check, and auto-deploy).
3. Set the env vars it asks for: `GROQ_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_KEY`. Render passes them into the Docker build so the
   `VITE_*` build args reach Vite.
4. Add the Render URL to Supabase Auth → URL Configuration → Redirect URLs.

Health check: `GET /api/health` → `{"status":"ok"}`.

## Environment variables

| File | Keys |
|---|---|
| `Backend/.env` | `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS` (optional), `GROQ_MODEL` (optional) |
| `Frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (anon key — public by design) |

Templates live in `Backend/.env.example` and `Frontend/.env.example`.
Never commit `.env` files (already gitignored).

## Notes

- The in-memory rate limiter resets when the instance restarts and is per-instance;
  fine for a single Render web service. For multi-instance scale, move it to Redis.
- On Render's free plan the service cold-starts after inactivity; the first
  request may take a few seconds.
