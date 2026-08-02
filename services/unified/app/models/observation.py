"""
Observation domain ORM model — lifted from observation-service canonical version.
Cross-service ForeignKeys removed; uses unified Base.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.uuid_generate_v4()
    )
    mission_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    robot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    bin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    bin_code: Mapped[str | None] = mapped_column(String(150), nullable=True)
    decoded_qr: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)
    raw_qr_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    detection_confidence: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    frame_blur_score: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    robot_coord_x: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    robot_coord_y: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    robot_coord_z: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status: Mapped[str] = mapped_column(
        Enum("PENDING", "PROCESSED", "FAILED", "DECODE_ERROR", name="observation_status", create_type=False),
        nullable=False, default="PENDING", server_default="PENDING"
    )
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict, server_default="{}")
