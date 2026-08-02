"""
Mission domain ORM models — robots, missions, mission_zones.
Uses PgEnums with create_type=False (enums already created by init.sql).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import ENUM as PgEnum, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

_robot_status = PgEnum(
    "IDLE", "AUDITING", "CHARGING", "FAULTED", "OFFLINE", "MAINTENANCE",
    name="robot_status", create_type=False,
)
_mission_status = PgEnum(
    "SCHEDULED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "PAUSED",
    name="mission_status", create_type=False,
)


class Robot(Base):
    __tablename__ = "robots"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), nullable=False)
    status: Mapped[str] = mapped_column(_robot_status, nullable=False, default="IDLE")
    battery_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("100.00"))
    firmware_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_coord_x: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    current_coord_y: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    current_coord_z: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True, default=Decimal("0"))
    current_yaw: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True, default=Decimal("0"))
    active_mission_id: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), nullable=False)
    robot_id: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), ForeignKey("robots.id"), nullable=True)
    status: Mapped[str] = mapped_column(_mission_status, nullable=False, default="SCHEDULED")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    total_bins_target: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_bins_scanned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coverage_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    audit_scope: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="ZONE")
    target_scope_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class MissionZone(Base):
    __tablename__ = "mission_zones"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    mission_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), ForeignKey("missions.id", ondelete="CASCADE"), nullable=False)
    zone_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), nullable=False)
    scan_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="PENDING")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
