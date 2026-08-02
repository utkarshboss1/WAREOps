"""
Reconciliation domain ORM models — inventory, reconciliation_results, alerts.
Canonical definitions; uses unified Base. PgEnums use create_type=True so they
are created on fresh Postgres (Railway) by create_all (idempotent via checkfirst).
"""
from __future__ import annotations

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM as PgEnum, JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

_mismatch_type = PgEnum(
    "CORRECT_PLACEMENT", "MISPLACED", "MISSING", "DUPLICATE", "UNKNOWN", "QUANTITY_DISCREPANCY",
    name="mismatch_type", create_type=True,
)
_alert_severity = PgEnum(
    "INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL",
    name="alert_severity", create_type=True,
)
_alert_status = PgEnum(
    "OPEN", "ACKNOWLEDGED", "ACTION_REQUIRED", "RESOLVED", "DISMISSED", "FALSE_POSITIVE",
    name="alert_status", create_type=True,
)


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    bin_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(String(100), ForeignKey("products.sku"), nullable=False, index=True)
    expected_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    lot_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_wms_sync: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    observation_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), nullable=False, index=True)
    bin_id: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), nullable=True)
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    result_type: Mapped[str] = mapped_column(_mismatch_type, nullable=False)
    expected_sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    expected_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    observed_sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    observed_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    expected_bin_id: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), nullable=True)
    reconciled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4), nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=False), nullable=False, index=True)
    reconciliation_id: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), ForeignKey("reconciliation_results.id"), nullable=True)
    observation_id: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), nullable=True)
    bin_id: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), nullable=True, index=True)
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    alert_type: Mapped[str] = mapped_column(_mismatch_type, nullable=False)
    severity: Mapped[str] = mapped_column(_alert_severity, nullable=False, default="MEDIUM")
    status: Mapped[str] = mapped_column(_alert_status, nullable=False, default="OPEN")
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expected_value: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    observed_value: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    acknowledged_by: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(PgUUID(as_uuid=False), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auto_resolvable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rescan_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
