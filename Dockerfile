# Stage 1: build the React frontend
FROM node:22-alpine AS frontend
WORKDIR /app/Frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
# Vite inlines VITE_* vars at build time (Supabase anon key is public by design)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_KEY
RUN npm run build

# Stage 2: Python runtime serving API + built frontend
FROM python:3.12-slim
WORKDIR /app
COPY Backend/requirements.txt Backend/
RUN pip install --no-cache-dir -r Backend/requirements.txt
COPY Backend/ Backend/
COPY --from=frontend /app/Frontend/dist Frontend/dist

WORKDIR /app/Backend
EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
