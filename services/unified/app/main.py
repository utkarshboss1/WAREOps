"""
services/unified/app/main.py — WAREOps Unified Application Entry Point.

Consolidates all 7 microservices into one FastAPI process:
  - Auth & Admin     → /api/v1/auth/*, /api/v1/admin/*
  - Topology         → /api/v1/warehouses/*, /api/v1/products/*, /api/v1/bins/*
  - Mission & Robots → /api/v1/missions/*, /api/v1/robots/*
  - Observations     → /api/v1/observations/*
  - Reconciliation   → /api/v1/inventory/*, /api/v1/reconciliation/*
  - Analytics        → /api/v1/analytics/*
  - Alerting         → /api/v1/alerts/*
  - Digital Twin     → /api/v1/twin/*, /api/v1/warehouses/{id}/twin/*, /socket.io/
  - Robot Simulator  → embedded asyncio background tasks
  - Seeder           → runs on startup (idempotent)
  - React SPA        → served at / with index.html fallback

Railway footprint: Postgres plugin + Redis plugin + this service = 3 things.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import socketio
import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from redis.asyncio import Redis, from_url as redis_from_url

from app.config import settings
from app.database import engine, AsyncSessionLocal

# ── Import all models so create_all registers every table ─────────────────────
import app.models  # noqa: F401 — side-effect: registers all ORM classes with Base

from app.database import Base
from app.twin.twin_state import WarehouseTwinState
from app.twin.consumer import TwinKafkaConsumer
from app.twin.socket_server import (
    configure_socket_server,
    sio,
    socket_asgi_app,
    start_pubsub_listener,
    stop_pubsub_listener,
)

# ── Routers ────────────────────────────────────────────────────────────────────
from app.routers.auth_router import router as auth_router
from app.routers.admin_router import router as admin_router
from app.routers.topology_router import router as topology_router
from app.routers.mission_router import router as mission_router
from app.routers.observation_router import router as observation_router
from app.routers.reconciliation_router import router as reconciliation_router
from app.routers.analytics_router import router as analytics_router
from app.routers.alert_router import router as alert_router
from app.routers.twin_router import router as twin_router

# ── Structured logging ─────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.format_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.LOG_LEVEL, logging.INFO)
    ),
)
logger = structlog.get_logger(__name__)


# ── Periodic stats broadcaster ──────────────────────────────────────────────────

async def _periodic_stats_broadcaster(twin_state: WarehouseTwinState, redis_client: Redis, interval: int) -> None:
    logger.info("stats_broadcaster_started", interval=interval)
    while True:
        try:
            await asyncio.sleep(interval)
            warehouses = await twin_state.get_active_warehouses()
            for wh_id in warehouses:
                snapshot = await twin_state.get_warehouse_snapshot(wh_id)
                delta = {"type": "warehouse_stats_update", "warehouse_id": wh_id, "stats": snapshot["stats"], "ts": time.time()}
                await redis_client.publish(f"twin:updates:{wh_id}", json.dumps(delta))
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.exception("stats_broadcaster_error", error=str(exc))


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("wareops_unified_starting", port=settings.PORT, env=settings.ENVIRONMENT)

    # 1. Create all DB tables (idempotent; respects existing schema from init.sql)
    logger.info("creating_db_tables")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)

    # 2. Redis
    redis_client: Redis = redis_from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=5,
        retry_on_timeout=True,
        health_check_interval=30,
    )
    await redis_client.ping()
    logger.info("redis_connected")
    app.state.redis = redis_client

    # 3. Auth seed + warehouse data seed
    logger.info("running_seeders")
    for attempt in range(3):
        try:
            from app.seeder.runner import seed_auth, seed_warehouse
            await seed_auth()
            await seed_warehouse()
            break
        except Exception as exc:
            logger.warning("seeder_attempt_failed", attempt=attempt+1, error=str(exc))
            if attempt < 2:
                await asyncio.sleep(3.0)

    # 4. Digital twin state + Socket.IO
    twin_state = WarehouseTwinState(redis_client=redis_client, robot_position_ttl=settings.ROBOT_POSITION_TTL_SECS)
    app.state.twin_state = twin_state
    app.state.redis_client = redis_client
    configure_socket_server(twin_state, redis_client)
    await start_pubsub_listener()

    # 5. Redis Pub/Sub consumer (drives twin state from observations/heartbeats)
    kafka_consumer = TwinKafkaConsumer(twin_state=twin_state, redis_client=redis_client)
    await kafka_consumer.start()
    app.state.kafka_consumer = kafka_consumer

    # 6. Periodic stats broadcaster
    stats_task = asyncio.create_task(
        _periodic_stats_broadcaster(twin_state, redis_client, settings.STATE_SNAPSHOT_INTERVAL_SECS),
        name="stats-broadcaster",
    )
    app.state.stats_task = stats_task

    # 7. Embedded robot simulator (starts after a brief delay so all routes are hot)
    if settings.ENABLE_SIMULATOR:
        async def _start_simulator_delayed():
            await asyncio.sleep(8.0)  # wait for app to be ready
            from app.simulator.runner import start_simulator
            base_url = f"http://localhost:{settings.PORT}"
            await start_simulator(base_url)

        sim_starter = asyncio.create_task(_start_simulator_delayed(), name="simulator-starter")
        app.state.sim_starter = sim_starter

    logger.info("wareops_unified_ready")

    # ── Serve ────────────────────────────────────────────────────────────────────
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────────
    logger.info("wareops_unified_shutting_down")

    if settings.ENABLE_SIMULATOR:
        from app.simulator.runner import stop_simulator
        await stop_simulator()

    stats_task.cancel()
    try:
        await stats_task
    except asyncio.CancelledError:
        pass

    await kafka_consumer.stop()
    await stop_pubsub_listener()
    await redis_client.aclose()
    await engine.dispose()
    logger.info("wareops_unified_shutdown_complete")


# ── FastAPI application ─────────────────────────────────────────────────────────

app = FastAPI(
    title="WAREOps — Unified Warehouse Intelligence Platform",
    description="All services consolidated into one deployable unit.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus ──────────────────────────────────────────────────────────────────
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


# ── Health ──────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health_check() -> dict[str, Any]:
    checks: dict[str, Any] = {}
    try:
        r: Redis = app.state.redis
        await r.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    try:
        consumer = app.state.kafka_consumer
        task = consumer._task
        checks["event_subscriber"] = "ok" if (task and not task.done()) else "stopped"
    except Exception as exc:
        checks["event_subscriber"] = f"error: {exc}"

    return {"status": "ok", "service": settings.SERVICE_NAME, "version": "2.0.0", "checks": checks}


# ── Dashboard stats endpoint (called by topologyApiClient.getDashboardStats) ────

@app.get("/api/v1/dashboard/stats", tags=["dashboard"])
async def get_dashboard_stats() -> dict[str, Any]:
    """Quick aggregate stats for the dashboard overview."""
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            sql = text("""
                SELECT
                    (SELECT COUNT(*) FROM warehouses WHERE is_active=TRUE) AS warehouses,
                    (SELECT COUNT(*) FROM missions WHERE status IN ('SCHEDULED','IN_PROGRESS')) AS active_missions,
                    (SELECT COUNT(*) FROM robots WHERE status NOT IN ('OFFLINE','FAULTED')) AS robots_online,
                    (SELECT COUNT(*) FROM alerts WHERE status='OPEN') AS open_alerts,
                    (SELECT COUNT(*) FROM observations) AS total_observations
            """)
            result = await session.execute(sql)
            row = result.mappings().fetchone()
            return dict(row) if row else {}
    except Exception:
        return {}


# ── Notifications alias (frontend calls /api/v1/notifications) ──────────────────

@app.get("/api/v1/notifications", tags=["auth"])
async def notifications_alias():
    """Alias → redirects to auth's /me/notifications. Returns empty list as fallback."""
    return []


# ── Active missions shortcut ────────────────────────────────────────────────────

@app.get("/api/v1/missions/active", tags=["missions"])
async def get_active_missions() -> list:
    """Return missions in IN_PROGRESS or PAUSED state."""
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            from app.models.mission import Mission
            result = await session.execute(
                select(Mission).filter(Mission.status.in_(["IN_PROGRESS", "PAUSED"])).order_by(Mission.started_at.desc())
            )
            missions = result.scalars().all()
            return [
                {
                    "id": str(m.id), "name": m.name, "status": str(m.status),
                    "warehouse_id": str(m.warehouse_id), "robot_id": str(m.robot_id) if m.robot_id else None,
                    "audit_scope": m.audit_scope, "started_at": m.started_at.isoformat() if m.started_at else None,
                }
                for m in missions
            ]
    except Exception:
        return []


# ── Include all routers ─────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(topology_router, prefix="/api/v1")
app.include_router(mission_router)
app.include_router(observation_router)
app.include_router(reconciliation_router)
app.include_router(analytics_router)
app.include_router(alert_router)
app.include_router(twin_router)

# ── Serve React SPA (must be last — catches all remaining paths) ────────────────
from app.static_assets import mount_spa
mount_spa(app)


# ── Combined ASGI: FastAPI + Socket.IO ──────────────────────────────────────────

class _CombinedASGI:
    """Routes /socket.io/* to the Socket.IO ASGI app; all else to FastAPI."""

    def __init__(self, fastapi_app: FastAPI, sio_asgi: socketio.ASGIApp) -> None:
        self._fastapi = fastapi_app
        self._sio = sio_asgi

    async def __call__(self, scope: dict, receive, send) -> None:
        path: str = scope.get("path", "")
        if scope["type"] in ("http", "websocket") and path.startswith("/socket.io"):
            await self._sio(scope, receive, send)
        else:
            await self._fastapi(scope, receive, send)


# This is what uvicorn actually serves
socket_app = _CombinedASGI(app, socket_asgi_app)


# ── Dev entrypoint ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=settings.PORT,
        loop="asyncio",
        log_level=settings.LOG_LEVEL.lower(),
        reload=settings.ENVIRONMENT == "development",
    )
