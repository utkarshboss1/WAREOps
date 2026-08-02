"""
Topology domain ORM models — warehouses, zones, aisles, racks, shelves, bins, products.
Converted from topology-service's legacy declarative_base() to the unified DeclarativeBase.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import ClassVar, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="UTC")
    total_area_sqm: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    zones: Mapped[list["Zone"]] = relationship("Zone", back_populates="warehouse", lazy="noload", cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    zone_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    floor_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="zones", lazy="noload")
    aisles: Mapped[list["Aisle"]] = relationship("Aisle", back_populates="zone", lazy="noload", cascade="all, delete-orphan")


class Aisle(Base):
    __tablename__ = "aisles"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    aisle_number: Mapped[int] = mapped_column(Integer, nullable=False)
    direction: Mapped[str] = mapped_column(String(15), nullable=False, default="NORTH_SOUTH")
    start_coord_x: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    start_coord_y: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    end_coord_x: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    end_coord_y: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    zone: Mapped["Zone"] = relationship("Zone", back_populates="aisles", lazy="noload")
    racks: Mapped[list["Rack"]] = relationship("Rack", back_populates="aisle", lazy="noload", cascade="all, delete-orphan")


class Rack(Base):
    __tablename__ = "racks"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aisle_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("aisles.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    rack_number: Mapped[int] = mapped_column(Integer, nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False, default="LEFT")
    num_shelves: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    coord_x: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    coord_y: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    coord_z: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=Decimal("0.0"))
    height_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    width_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    depth_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    aisle: Mapped["Aisle"] = relationship("Aisle", back_populates="racks", lazy="noload")
    shelves: Mapped[list["Shelf"]] = relationship("Shelf", back_populates="rack", lazy="noload", cascade="all, delete-orphan")


class Shelf(Base):
    __tablename__ = "shelves"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rack_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("racks.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    level_number: Mapped[int] = mapped_column(Integer, nullable=False)
    height_from_floor_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    load_capacity_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    rack: Mapped["Rack"] = relationship("Rack", back_populates="shelves", lazy="noload")
    bins: Mapped[list["Bin"]] = relationship("Bin", back_populates="shelf", lazy="noload", cascade="all, delete-orphan")


class Bin(Base):
    __tablename__ = "bins"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shelf_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("shelves.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    bin_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    coord_x: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    coord_y: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    coord_z: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    width_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    depth_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    height_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    qr_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    shelf: Mapped["Shelf"] = relationship("Shelf", back_populates="bins", lazy="noload")


class Product(Base):
    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    unit_of_measure: Mapped[str] = mapped_column(String(50), nullable=False, default="EACH")
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    length_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    width_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    height_cm: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    barcode_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    # non-persisted helper (populated via raw SQL join)
    location: ClassVar[Optional[str]] = None
