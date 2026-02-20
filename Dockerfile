# ── Backend image ────────────────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# ── Frontend build ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
# VITE_API_URL is empty so requests go to same origin (served by backend)
RUN npm run build

# ── Final image ──────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Copy backend
COPY --from=backend /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin
COPY backend/ ./backend/

# Copy built frontend into backend/static so FastAPI can serve it
COPY --from=frontend-build /app/frontend/dist ./backend/static/

WORKDIR /app/backend

# Serve static files from FastAPI
ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
