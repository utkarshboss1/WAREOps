# ── Stage 1: Build React SPA ────────────────────────────────────────────────────
FROM node:20-alpine AS spa-builder

WORKDIR /spa

# Install deps with layer caching
COPY apps/ops-dashboard/package.json apps/ops-dashboard/package-lock.json* ./
RUN npm ci

COPY apps/ops-dashboard/ ./

# Production build — all API calls same-origin, WS same-origin
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_TOPOLOGY_API_URL=/api/v1
ARG VITE_WS_URL=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_TOPOLOGY_API_URL=$VITE_TOPOLOGY_API_URL \
    VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ── Stage 2: Python dependencies ─────────────────────────────────────────────────
FROM python:3.12-slim AS python-builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /build/venv
ENV PATH="/build/venv/bin:$PATH"

COPY services/unified/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/venv/bin:$PATH" \
    PORT=8080

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home appuser

# Copy venv from builder
COPY --from=python-builder /build/venv /app/venv

# Copy unified app source
COPY --chown=appuser:appgroup services/unified/app /app/app

# Copy built React SPA into /app/static
COPY --from=spa-builder /spa/dist /app/static

# Copy warehouse_database.xlsx into the image
COPY --chown=appuser:appgroup warehouse_database.xlsx /app/seed_data/warehouse_database.xlsx

# Make the static dir writable (in case the SPA build writes anything)
RUN mkdir -p /app/static && chown -R appuser:appgroup /app

USER appuser

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
    CMD curl -sf http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "/app/venv/bin/python -m uvicorn app.main:socket_app --host 0.0.0.0 --port ${PORT} --loop asyncio --workers 1"]
