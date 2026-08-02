from pydantic import BaseModel, ConfigDict
from typing import Any, Optional
from datetime import datetime

class MissionCreate(BaseModel):
    name: str
    warehouse_id: str
    robot_id: Optional[str] = None
    robot_name: Optional[str] = None
    priority: int = 5
    audit_scope: Optional[str] = 'FULL'
    target_scope_id: Optional[str] = None
    bins_total: Optional[int] = 0
    description: Optional[str] = None
    total_bins_target: int = 0

class MissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Any
    warehouse_id: Any
    robot_id: Optional[Any] = None
    status: Any
    priority: int
    name: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    total_bins_target: int
    total_bins_scanned: int
    coverage_pct: float
    audit_scope: Optional[str] = None
    target_scope_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MissionUpdate(BaseModel):
    status: Optional[str] = None
    failure_reason: Optional[str] = None
    total_bins_scanned: Optional[int] = None


class RobotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Any
    robot_id: Optional[Any] = None
    serial_number: str
    name: Optional[str] = None
    model: Optional[str] = None
    warehouse_id: Any
    status: Any
    battery_pct: float
    firmware_version: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    current_coord_x: Optional[float] = None
    current_coord_y: Optional[float] = None
    current_coord_z: Optional[float] = None
    current_yaw: Optional[float] = None
    active_mission_id: Optional[Any] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class RobotCreateOrUpdate(BaseModel):
    robot_id: Optional[str] = None
    serial_number: str
    name: Optional[str] = None
    model: Optional[str] = None
    warehouse_id: str
    firmware_version: Optional[str] = None
    status: Optional[str] = "IDLE"
    battery_pct: Optional[float] = 100.0
    current_coord_x: Optional[float] = None
    current_coord_y: Optional[float] = None
    current_coord_z: Optional[float] = 0.0
    current_yaw: Optional[float] = 0.0
    capabilities: Optional[list] = None
    registered_at: Optional[str] = None

class RobotHeartbeatRequest(BaseModel):
    robot_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    battery_pct: Optional[float] = None
    battery: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = 0.0
    yaw: Optional[float] = 0.0
    coord_x: Optional[float] = None
    coord_y: Optional[float] = None
    coord_z: Optional[float] = None
    position: Optional[dict] = None
    status: str = "IDLE"
    mission_id: Optional[str] = None
    active_mission_id: Optional[str] = None
    offline_buffer_size: Optional[int] = 0
    timestamp: Optional[str] = None

class NextTaskResponse(BaseModel):
    mission_id: str
    warehouse_id: str
    bins: list = []
    bin_ids: list = []

