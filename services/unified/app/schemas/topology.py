from pydantic import BaseModel, Field, field_validator
from pydantic import ConfigDict
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
import uuid

# --- Warehouse ---
class WarehouseBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    timezone: str = "UTC"
    total_area_sqm: Optional[Decimal] = None

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseResponse(WarehouseBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Zone ---
class ZoneBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    zone_type: Optional[str] = None
    floor_level: int = 0

class ZoneCreate(ZoneBase):
    warehouse_id: str

class ZoneResponse(ZoneBase):
    id: uuid.UUID
    warehouse_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Aisle ---
class AisleBase(BaseModel):
    code: str
    aisle_number: int
    direction: str = "NORTH_SOUTH"
    start_coord_x: Optional[Decimal] = None
    start_coord_y: Optional[Decimal] = None
    end_coord_x: Optional[Decimal] = None
    end_coord_y: Optional[Decimal] = None

class AisleCreate(AisleBase):
    zone_id: str

class AisleResponse(AisleBase):
    id: uuid.UUID
    zone_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Rack ---
class RackBase(BaseModel):
    code: str
    rack_number: int
    side: str = "LEFT"
    num_shelves: int = 5
    coord_x: Optional[Decimal] = None
    coord_y: Optional[Decimal] = None
    coord_z: Decimal = Decimal("0.0000")
    height_cm: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    depth_cm: Optional[Decimal] = None

class RackCreate(RackBase):
    aisle_id: str

class RackResponse(RackBase):
    id: uuid.UUID
    aisle_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Shelf ---
class ShelfBase(BaseModel):
    code: str
    level_number: int
    height_from_floor_cm: Optional[Decimal] = None
    load_capacity_kg: Optional[Decimal] = None

class ShelfCreate(ShelfBase):
    rack_id: str

class ShelfResponse(ShelfBase):
    id: uuid.UUID
    rack_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Bin ---
class BinBase(BaseModel):
    code: str
    bin_number: int
    coord_x: Optional[Decimal] = None
    coord_y: Optional[Decimal] = None
    coord_z: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    depth_cm: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    qr_code: Optional[str] = None

class BinCreate(BinBase):
    shelf_id: str

class BinResponse(BinBase):
    id: uuid.UUID
    shelf_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Detail Hierarchical Schemas ---
class BinDetail(BinResponse):
    pass

class ShelfDetail(ShelfResponse):
    bins: List[BinDetail] = []

class RackDetail(RackResponse):
    shelves: List[ShelfDetail] = []

class AisleDetail(AisleResponse):
    racks: List[RackDetail] = []

class ZoneDetail(ZoneResponse):
    aisles: List[AisleDetail] = []

class WarehouseDetail(WarehouseResponse):
    zones: List[ZoneDetail] = []

# --- Product ---
class ProductBase(BaseModel):
    sku: str = Field(..., max_length=100)
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    weight_kg: Optional[Decimal] = None
    length_cm: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    is_active: bool = True
    location: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BulkDeleteRequest(BaseModel):
    skus: List[str]
