"""
services/unified/app/config.py — Unified single-service configuration.

All 7 microservices collapsed to one. No inter-service HTTP URLs needed.
"""
from __future__ import annotations

import os
from typing import Any
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Identity ────────────────────────────────────────────────────────────────
    SERVICE_NAME: str = "wareops-unified"
    PORT: int = Field(default=8080)
    LOG_LEVEL: str = Field(default="INFO")
    ENVIRONMENT: str = Field(default="production")
    DEBUG: bool = Field(default=False)

    # ── Database (single shared Postgres) ────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://warehouse_admin:warehouse_secret@localhost:5432/warehouse_platform"
    )
    DB_POOL_SIZE: int = Field(default=10)
    DB_MAX_OVERFLOW: int = Field(default=20)
    DB_POOL_TIMEOUT: int = Field(default=30)

    # ── Redis (single instance; all services use the same db number — Pub/Sub is global) ────
    REDIS_URL: str = Field(default="redis://:redis_secret@localhost:6379/0")

    # ── Auth / JWT ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(
        default="CHANGE-ME-in-production-must-be-at-least-32-chars-long!!!"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # ── CORS ────────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = Field(default=["*"])
    FRONTEND_URL: str = Field(default="http://localhost:5173")

    # ── Auth service tuning ──────────────────────────────────────────────────────
    MAX_FAILED_LOGINS: int = Field(default=5)
    LOCKOUT_MINUTES: int = Field(default=15)
    RATE_LIMIT_LOGIN_REQUESTS: int = Field(default=20)
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = Field(default=60)
    RESET_TOKEN_EXPIRE_HOURS: int = Field(default=2)
    INVITE_TOKEN_EXPIRE_HOURS: int = Field(default=72)
    SMTP_HOST: str = Field(default="")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM: str = Field(default="noreply@wareops.dev")
    SMTP_TLS: bool = Field(default=True)

    # ── Twin / Socket.IO ─────────────────────────────────────────────────────────
    STATE_SNAPSHOT_INTERVAL_SECS: int = Field(default=30)
    ROBOT_POSITION_TTL_SECS: int = Field(default=300)

    # ── Topology cache ────────────────────────────────────────────────────────────
    REDIS_TOPOLOGY_TTL_SECONDS: int = Field(default=3600)
    REDIS_BIN_RESOLVE_TTL_SECONDS: int = Field(default=1800)

    # ── Simulator ───────────────────────────────────────────────────────────────
    ENABLE_SIMULATOR: bool = Field(default=True)
    ROBOT_COUNT: int = Field(default=3)
    WAREHOUSE_ID: str = Field(default="a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    SCAN_INTERVAL_MS: int = Field(default=2000)
    HEARTBEAT_INTERVAL_MS: int = Field(default=1000)
    BATTERY_DRAIN_RATE: float = Field(default=0.02)
    CONNECTIVITY_FAILURE_PROBABILITY: float = Field(default=0.05)
    DECODE_FAILURE_PROBABILITY: float = Field(default=0.08)

    # ── Seeder ───────────────────────────────────────────────────────────────────
    ENABLE_SEEDER: bool = Field(default=True)

    # ── Mission service tuning ───────────────────────────────────────────────────
    MISSION_LOCK_TTL_SECS: int = Field(default=300)
    ROBOT_HEARTBEAT_TIMEOUT_SECS: int = Field(default=60)

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: Any) -> str:
        """Railway Postgres gives postgresql:// — asyncpg needs postgresql+asyncpg://."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def fix_redis_url(cls, v: Any) -> str:
        """Ensure Redis URL has no trailing whitespace and is valid."""
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        return v.upper()


settings = Settings()


def get_settings() -> Settings:
    return settings
