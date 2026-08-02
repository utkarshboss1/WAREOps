# ── WAREOps API Gateway + SPA — Combined Dockerfile ──────────────────────────
#
# Stage 1: Build the React SPA
# Stage 2: Nginx gateway that serves both the SPA and proxies /api/v1/* to
#           the backend microservices via Railway internal DNS.
#
# Railway exposes this container publicly. All other services are internal.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build React SPA ──────────────────────────────────────────────────
FROM node:20-alpine AS spa-builder

WORKDIR /spa

# Install dependencies with layer caching
COPY apps/ops-dashboard/package.json apps/ops-dashboard/package-lock.json* ./
RUN npm ci

# Copy source
COPY apps/ops-dashboard/ ./

# Build args (injected by Railway build config / docker build --build-arg)
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_TOPOLOGY_API_URL=/api/v1
ARG VITE_WS_URL=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_TOPOLOGY_API_URL=$VITE_TOPOLOGY_API_URL \
    VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ── Stage 2: Nginx gateway ────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Install envsubst (included in gettext package)
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf /etc/nginx/nginx.conf

# Copy built SPA into nginx html root
COPY --from=spa-builder /spa/dist /usr/share/nginx/html

# Copy nginx config template and startup script
COPY infrastructure/nginx/nginx.conf.template /etc/nginx/nginx.conf.template
COPY infrastructure/nginx/start.sh /start.sh
RUN chmod +x /start.sh

# Railway sets PORT env var dynamically; defaults below for Railway internal DNS
ENV PORT=8080 \
    AUTH_SERVICE_HOST=auth-service.railway.internal:8000 \
    TOPOLOGY_SERVICE_HOST=topology-service.railway.internal:8001 \
    MISSION_SERVICE_HOST=mission-service.railway.internal:8002 \
    OBSERVATION_SERVICE_HOST=observation-service.railway.internal:8003 \
    RECONCILIATION_SERVICE_HOST=reconciliation-service.railway.internal:8004 \
    ALERTING_SERVICE_HOST=alerting-service.railway.internal:8005 \
    TWIN_SERVICE_HOST=digital-twin-sync.railway.internal:8006

EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["/start.sh"]
