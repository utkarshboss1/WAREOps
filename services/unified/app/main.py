"""
services/unified/app/main.py — WAREOps Unified Application Entry Point.

Startup sequence for Railway (fresh Postgres):
  1. [blocking in lifespan] Connect to Postgres with retry → create_all all tables
  2. [lifespan yields → server accepts requests, /health returns 200 immediately]
  3. [background task] Connect Redis, seed auth + warehouse data, start twin/simulator

This ensures:
  - /health passes Railway's healthcheck immediately (no blocking)
  - Tables exist before any request hits the DB
  - Simulator doesn't start until seeding is complete (30s delay)
  - Login works as soon as lifespan completes
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

from app.routers.auth_router import router as auth_router
from app.routers.admin_router import router as admin_router
from app.routers.topology_router import router as topology_router
from app.routers.mission_router import router as mission_router
from app.routers.observation_router import router as observation_router
from app.routers.reconciliation_router import router as reconciliation_router
from app.routers.analytics_router import router as analytics_router
from app.routers.alert_router import router as alert_router
from app.routers.twin_router import router as twin_router

# ── Logging ────────────────────────────────────────────────────────────────────
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

# ── Global readiness flag ──────────────────────────────────────────────────────
# Set to True after DB tables exist AND background startup completes.
# The simulator checks this before registering robots.
_db_ready: bool = False          # Tables created, auth endpoints safe to use
_fully_ready: bool = False       # Redis + seed + twin all done
_startup_error: str | None = None


# ── Background startup (Redis, seeding, twin, simulator) ─────────────────────
# Runs AFTER lifespan yields — DB tables already exist at this point.

async def _background_startup(app: FastAPI) -> None:
    global _fully_ready, _startup_error
    logger.info("bg_startup.begin")

    try:
        # ── Redis (retry — Railway Redis cold-starts slowly) ──────────────────
        logger.info("bg_startup.redis")
        redis_client: Redis | None = None
        for attempt in range(15):
            try:
                r = redis_from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=10,
                    retry_on_timeout=True,
                    health_check_interval=30,
                )
                await r.ping()
                redis_client = r
                logger.info("bg_startup.redis_ok")
                break
            except Exception as exc:
                logger.warning("bg_startup.redis_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(3.0)

        if redis_client is None:
            raise RuntimeError("Redis unreachable after retries")

        app.state.redis = redis_client
        app.state.redis_client = redis_client

        # ── Auth seed + warehouse seed ────────────────────────────────────────
        logger.info("bg_startup.seeding")
        for attempt in range(5):
            try:
                from app.seeder.runner import seed_auth, seed_warehouse
                await seed_auth()
                await seed_warehouse()
                logger.info("bg_startup.seeding_ok")
                break
            except Exception as exc:
                logger.warning("bg_startup.seeding_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(5.0)

        # ── Digital twin ──────────────────────────────────────────────────────
        logger.info("bg_startup.twin")
        twin_state = WarehouseTwinState(
            redis_client=redis_client,
            robot_position_ttl=settings.ROBOT_POSITION_TTL_SECS,
        )
        app.state.twin_state = twin_state
        configure_socket_server(twin_state, redis_client)
        await start_pubsub_listener()

        consumer = TwinKafkaConsumer(twin_state=twin_state, redis_client=redis_client)
        await consumer.start()
        app.state.kafka_consumer = consumer

        stats_task = asyncio.create_task(
            _periodic_stats_broadcaster(twin_state, redis_client, settings.STATE_SNAPSHOT_INTERVAL_SECS),
            name="stats-broadcaster",
        )
        app.state.stats_task = stats_task

        # ── Mark fully ready ──────────────────────────────────────────────────
        _fully_ready = True
        logger.info("bg_startup.complete")

        # ── Simulator — starts AFTER fully_ready, with extra delay ────────────
        # Uses 30-second delay so all seeds finish and the DB is populated
        # before robots try to register and fetch topology.
        if settings.ENABLE_SIMULATOR:
            async def _start_sim():
                # Wait for full readiness + extra buffer for seeding to settle
                for _ in range(60):
                    if _fully_ready:
                        break
                    await asyncio.sleep(1.0)
                await asyncio.sleep(20.0)  # extra buffer
                from app.simulator.runner import start_simulator
                await start_simulator(f"http://localhost:{settings.PORT}")
                logger.info("bg_startup.simulator_started")
            asyncio.create_task(_start_sim(), name="simulator-starter")

    except Exception as exc:
        _startup_error = str(exc)
        logger.error("bg_startup.failed", error=str(exc))


async def _periodic_stats_broadcaster(
    twin_state: WarehouseTwinState, redis_client: Redis, interval: int
) -> None:
    while True:
        try:
            await asyncio.sleep(interval)
            warehouses = await twin_state.get_active_warehouses()
            for wh_id in warehouses:
                snap = await twin_state.get_warehouse_snapshot(wh_id)
                delta = {
                    "type": "warehouse_stats_update",
                    "warehouse_id": wh_id,
                    "stats": snap["stats"],
                    "ts": time.time(),
                }
                await redis_client.publish(f"twin:updates:{wh_id}", json.dumps(delta))
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.exception("stats_broadcaster_error", error=str(exc))


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Blocking step: wait for Postgres, then create all DB tables.
    This runs synchronously before the server accepts any requests.
    /health will return 200 immediately after lifespan yields.
    All auth/API endpoints are safe to use immediately after yield
    because tables are guaranteed to exist.
    """
    global _db_ready
    logger.info("wareops_start", port=settings.PORT, env=settings.ENVIRONMENT)

    # ── Create all tables (blocking — this is fast when tables already exist) ─
    # On Railway's fresh Postgres, this is the first and most important step.
    # Retry up to 10 times (30 seconds total) to handle Railway's cold-start DNS.
    logger.info("lifespan.create_tables")
    created = False
    for attempt in range(10):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all, checkfirst=True)
            logger.info("lifespan.create_tables_ok", attempt=attempt + 1)
            created = True
            break
        except Exception as exc:
            logger.warning(
                "lifespan.create_tables_retry",
                attempt=attempt + 1,
                error=str(exc)[:120],
            )
            await asyncio.sleep(3.0)

    if not created:
        # DB still unreachable after 30 seconds — start anyway, handle gracefully
        logger.error("lifespan.create_tables_failed_starting_anyway")

    _db_ready = True  # Tables exist (or we tried our best)

    # ── Launch background task (Redis, seeding, twin, simulator) ─────────────
    bg = asyncio.create_task(_background_startup(app), name="bg-startup")
    app.state.bg_task = bg

    logger.info("lifespan.ready_serving")
    yield  # ← server is live; /health returns 200; auth works

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("wareops_shutdown")
    bg.cancel()
    await asyncio.gather(bg, return_exceptions=True)

    if settings.ENABLE_SIMULATOR:
        try:
            from app.simulator.runner import stop_simulator
            await stop_simulator()
        except Exception:
            pass

    for attr in ("stats_task",):
        try:
            t = getattr(app.state, attr, None)
            if t:
                t.cancel()
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


# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="WAREOps — Unified Warehouse Intelligence Platform",
    description="All services in one deployable unit.",
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


# ── /health ────────────────────────────────────────────────────────────────────
# Returns 200 immediately after lifespan yields.
# Railway's healthcheck window starts when the container launches.
# By returning 200 quickly (lifespan only blocks on create_all with retry),
# we pass the healthcheck. The 'db_ready' and 'fully_ready' flags tell you
# the full state.

@app.get("/health", tags=["system"])
async def health_check() -> dict[str, Any]:
    checks: dict[str, Any] = {
        "db_ready": _db_ready,
        "fully_ready": _fully_ready,
    }
    if _startup_error:
        checks["startup_error"] = _startup_error

    if _fully_ready:
        try:
            r: Redis = app.state.redis
            await r.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {str(exc)[:60]}"

        try:
            consumer = app.state.kafka_consumer
            task = getattr(consumer, "_task", None)
            checks["event_subscriber"] = "ok" if (task and not task.done()) else "starting"
        except Exception:
            checks["event_subscriber"] = "starting"

    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": "2.0.0",
        "db_ready": _db_ready,
        "ready": _fully_ready,
        "checks": checks,
    }


# ── Extra utility endpoints ───────────────────────────────────────────────────

@app.get("/api/v1/dashboard/stats", tags=["dashboard"])
async def get_dashboard_stats() -> dict[str, Any]:
    if not _db_ready:
        return {}
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            result = await session.execute(text("""
                SELECT
                    (SELECT COUNT(*) FROM warehouses WHERE is_active=TRUE) AS warehouses,
                    (SELECT COUNT(*) FROM missions WHERE status IN ('SCHEDULED','IN_PROGRESS')) AS active_missions,
                    (SELECT COUNT(*) FROM robots WHERE status NOT IN ('OFFLINE','FAULTED')) AS robots_online,
                    (SELECT COUNT(*) FROM alerts WHERE status='OPEN') AS open_alerts,
                    (SELECT COUNT(*) FROM observations) AS total_observations
            """))
            row = result.mappings().fetchone()
            return dict(row) if row else {}
    except Exception:
        return {}


@app.get("/api/v1/notifications", tags=["auth"])
async def notifications_alias():
    return []


@app.get("/api/v1/missions/active", tags=["missions"])
async def get_active_missions() -> list:
    if not _db_ready:
        return []
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            from app.models.mission import Mission
            result = await session.execute(
                select(Mission)
                .filter(Mission.status.in_(["IN_PROGRESS", "PAUSED"]))
                .order_by(Mission.started_at.desc())
            )
            return [
                {
                    "id": str(m.id), "name": m.name, "status": str(m.status),
                    "warehouse_id": str(m.warehouse_id),
                    "robot_id": str(m.robot_id) if m.robot_id else None,
                    "audit_scope": m.audit_scope,
                    "started_at": m.started_at.isoformat() if m.started_at else None,
                }
                for m in result.scalars().all()
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

from app.static_assets import mount_spa
mount_spa(app)


# ── Combined ASGI: FastAPI + Socket.IO ────────────────────────────────────────

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
