"""
services/unified/app/database.py — Single shared async engine + session factory.

All routers import get_db / DbSession from here. The Base used for
create_all is imported from app.models (which assembles all ORM classes).
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# ── Declarative Base ────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Single unified Base for all ORM models."""
    type_annotation_map: dict[Any, Any] = {}


# ── Engine ──────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=1800,
    connect_args={
        "server_settings": {
            "application_name": settings.SERVICE_NAME,
            "jit": "off",
        }
    },
)

# ── Session factory ──────────────────────────────────────────────────────────────
AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── FastAPI dependency ────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yields a request-scoped async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Annotated shorthand used by routers
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Alias for get_db — keeps alerting-service router compatible."""
    async for s in get_db():
        yield s
