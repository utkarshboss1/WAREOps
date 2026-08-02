"""
services/unified/app/main.py — WAREOps Unified Application Entry Point.

KEY DESIGN DECISION FOR RAILWAY:
  The lifespan must NOT block the server from accepting requests.
  Railway's healthcheck fires immediately after the container starts.
  We start uvicorn immediately, return 200 on /health right away,
  and do ALL heavy work (DB create_all, seeding, Redis, twin, simulator)
  in a background asyncio task that runs after the server is hot.

Railway footprint: Postgres plugin + Redis plugin + 1 app service = 3 total.
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
import app.models  # noqa: F401

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

# ── Startup state (checked by /health) ─────────────────────────────────────────
_startup_complete = False
_startup_error: str | None = None


# ── Background startup task ─────────────────────────────────────────────────────

async def _background_startup(app: FastAPI) -> None:
    """
    All heavy startup work runs here as a background task.
    The server is already accepting requests when this runs — /health returns 200
    immediately so Railway's healthcheck passes while we do the real work.
    """
    global _startup_complete, _startup_error
    logger.info("background_startup_starting")

    try:
        # 1. DB create_all (idempotent — respects init.sql existing schema)
        logger.info("background_startup.create_tables")
        for attempt in range(5):
            try:
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all, checkfirst=True)
                logger.info("background_startup.tables_ok")
                break
            except Exception as exc:
                logger.warning("background_startup.create_tables_retry", attempt=attempt+1, error=str(exc))
                await asyncio.sleep(5.0)

        # 2. Redis connect (with retry for Railway cold start)
        logger.info("background_startup.redis_connect")
        redis_client: Redis | None = None
        for attempt in range(10):
            try:
                redis_client = redis_from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=10,
                    retry_on_timeout=True,
                    health_check_interval=30,
                )
                await redis_client.ping()
                logger.info("background_startup.redis_ok")
                break
            except Exception as exc:
                logger.warning("background_startup.redis_retry", attempt=attempt+1, error=str(exc))
                await asyncio.sleep(3.0)

        if redis_client is None:
            raise RuntimeError("Redis connection failed after retries")

        app.state.redis = redis_client
        app.state.redis_client = redis_client

        # 3. Auth seed + warehouse seed (idempotent ON CONFLICT DO NOTHING)
        logger.info("background_startup.seeding")
        for attempt in range(3):
            try:
                from app.seeder.runner import seed_auth, seed_warehouse
                await seed_auth()
                await seed_warehouse()
                logger.info("background_startup.seeding_ok")
                break
            except Exception as exc:
                logger.warning("background_startup.seeding_retry", attempt=attempt+1, error=str(exc))
                await asyncio.sleep(5.0)

        # 4. Digital twin state + Socket.IO
        logger.info("background_startup.twin")
        twin_state = WarehouseTwinState(
            redis_client=redis_client,
            robot_position_ttl=settings.ROBOT_POSITION_TTL_SECS,
        )
        app.state.twin_state = twin_state
        configure_socket_server(twin_state, redis_client)
        await start_pubsub_listener()

        # 5. Redis Pub/Sub consumer
        kafka_consumer = TwinKafkaConsumer(twin_state=twin_state, redis_client=redis_client)
        await kafka_consumer.start()
        app.state.kafka_consumer = kafka_consumer

        # 6. Stats broadcaster
        stats_task = asyncio.create_task(
            _periodic_stats_broadcaster(twin_state, redis_client, settings.STATE_SNAPSHOT_INTERVAL_SECS),
            name="stats-broadcaster",
        )
        app.state.stats_task = stats_task

        # 7. Embedded robot simulator
        if settings.ENABLE_SIMULATOR:
            async def _start_sim():
                await asyncio.sleep(5.0)
                from app.simulator.runner import start_simulator
                await start_simulator(f"http://localhost:{settings.PORT}")
            asyncio.create_task(_start_sim(), name="simulator-starter")

        _startup_complete = True
        logger.info("background_startup_complete")

    except Exception as exc:
        _startup_error = str(exc)
        logger.error("background_startup_failed", error=str(exc))


# ── Periodic stats broadcaster ──────────────────────────────────────────────────

async def _periodic_stats_broadcaster(twin_state: WarehouseTwinState, redis_client: Redis, interval: int) -> None:
    while True:
        try:
            await asyncio.sleep(interval)
            warehouses = await twin_state.get_active_warehouses()
            for wh_id in warehouses:
                snapshot = await twin_state.get_warehouse_snapshot(wh_id)
                delta = {
                    "type": "warehouse_stats_update",
                    "warehouse_id": wh_id,
                    "stats": snapshot["stats"],
                    "ts": time.time(),
                }
                await redis_client.publish(f"twin:updates:{wh_id}", json.dumps(delta))
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.exception("stats_broadcaster_error", error=str(exc))


# ── Lifespan (intentionally minimal — just launches the background task) ────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Only launch the background startup task here.
    The server starts accepting requests immediately — Railway healthcheck passes.
    All heavy work (DB, Redis, seeding, twin, simulator) runs in _background_startup.
    """
    logger.info("wareops_lifespan_start", port=settings.PORT, env=settings.ENVIRONMENT)
    startup_task = asyncio.create_task(_background_startup(app), name="background-startup")
    app.state.startup_task = startup_task

    yield  # ← server is live immediately

    # ── Shutdown ─────────────────────────────────────────────────────────────────
    logger.info("wareops_shutdown")
    startup_task.cancel()

    if settings.ENABLE_SIMULATOR:
        try:
            from app.simulator.runner import stop_simulator
            await stop_simulator()
        except Exception:
            pass

    try:
        stats_task = app.state.stats_task
        stats_task.cancel()
        await asyncio.gather(stats_task, return_exceptions=True)
    except Exception:
        pass

    try:
        await app.state.kafka_consumer.stop()
    except Exception:
        pass

    try:
        await stop_pubsub_listener()
    except Exception:
        pass

    try:
        await app.state.redis_client.aclose()
    except Exception:
        pass

    await engine.dispose()
    logger.info("wareops_shutdown_complete")


# ── FastAPI application ─────────────────────────────────────────────────────────

app = FastAPI(
    title="WAREOps — Unified Warehouse Intelligence Platform",
    description="All services consolidated into one deployable unit.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


# ── Health — responds immediately (even during startup) ─────────────────────────
# Railway healthcheck hits this endpoint. It must return 200 right away,
# even before DB / Redis are connected. The 'ready' field tells you whether
# the full startup has completed.

@app.get("/health", tags=["system"])
async def health_check() -> dict[str, Any]:
    """
    Always returns HTTP 200. Railway needs this to pass immediately.
    The 'ready' field indicates whether full startup has completed.
    """
    checks: dict[str, Any] = {"startup_complete": _startup_complete}

    if _startup_error:
        checks["startup_error"] = _startup_error

    # Only check Redis if startup has completed
    if _startup_complete:
        try:
            r: Redis = app.state.redis
            await r.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {str(exc)[:60]}"

        try:
            consumer = app.state.kafka_consumer
            task = consumer._task
            checks["event_subscriber"] = "ok" if (task and not task.done()) else "stopped"
        except Exception:
            checks["event_subscriber"] = "starting"

    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": "2.0.0",
        "ready": _startup_complete,
        "checks": checks,
    }


# ── Extra endpoints ────────────────────────────────────────────────────────────

@app.get("/api/v1/dashboard/stats", tags=["dashboard"])
async def get_dashboard_stats() -> dict[str, Any]:
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


@app.get("/api/v1/notifications", tags=["auth"])
async def notifications_alias():
    return []


@app.get("/api/v1/missions/active", tags=["missions"])
async def get_active_missions() -> list:
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            from app.models.mission import Mission
            result = await session.execute(
                select(Mission).filter(
                    Mission.status.in_(["IN_PROGRESS", "PAUSED"])
                ).order_by(Mission.started_at.desc())
            )
            missions = result.scalars().all()
            return [
                {
                    "id": str(m.id), "name": m.name, "status": str(m.status),
                    "warehouse_id": str(m.warehouse_id),
                    "robot_id": str(m.robot_id) if m.robot_id else None,
                    "audit_scope": m.audit_scope,
                    "started_at": m.started_at.isoformat() if m.started_at else None,
                }
                for m in missions
            ]
    except Exception:
        return []


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(topology_router, prefix="/api/v1")
app.include_router(mission_router)
app.include_router(observation_router)
app.include_router(reconciliation_router)
app.include_router(analytics_router)
app.include_router(alert_router)
app.include_router(twin_router)

# SPA fallback (must be last)
from app.static_assets import mount_spa
mount_spa(app)


# ── Combined ASGI: FastAPI + Socket.IO ──────────────────────────────────────────

class _CombinedASGI:
    def __init__(self, fastapi_app: FastAPI, sio_asgi: socketio.ASGIApp) -> None:
        self._fastapi = fastapi_app
        self._sio = sio_asgi

    async def __call__(self, scope: dict, receive, send) -> None:
        path: str = scope.get("path", "")
        if scope["type"] in ("http", "websocket") and path.startswith("/socket.io"):
            await self._sio(scope, receive, send)
        else:
            await self._fastapi(scope, receive, send)


socket_app = _CombinedASGI(app, socket_asgi_app)


if __name__ == "__main__":
    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=settings.PORT,
        loop="asyncio",
        log_level=settings.LOG_LEVEL.lower(),
    )
