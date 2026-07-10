# Stage 1: build the React frontend
FROM node:22-alpine AS frontend
WORKDIR /app/Frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
# Vite inlines VITE_* vars at build time (Supabase anon key is public by design).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_KEY
# Fail the build early instead of shipping a frontend that can't reach Supabase.
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_KEY" \
    || (echo "ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_KEY build args are required" && exit 1)
RUN npm run build

# Stage 2: Python runtime serving API + built frontend
FROM python:3.12-slim
RUN useradd --create-home --uid 1000 appuser
WORKDIR /app
COPY Backend/requirements.txt Backend/
RUN pip install --no-cache-dir -r Backend/requirements.txt
COPY Backend/ Backend/
COPY --from=frontend /app/Frontend/dist Frontend/dist

USER appuser
WORKDIR /app/Backend
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",8000)}/api/health')" || exit 1
# exec so uvicorn is PID 1 and receives SIGTERM for graceful shutdown
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
