import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, or_
from typing import List
from datetime import datetime
import structlog

from app.database import get_db
from app.models.mission import Mission, Robot
from app.schemas.mission import (
    MissionCreate, MissionResponse, MissionUpdate, RobotResponse,
    RobotCreateOrUpdate, RobotHeartbeatRequest, NextTaskResponse
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["missions"])


def _is_uuid(val: str) -> bool:
    """Return True if val is a valid UUID string."""
    try:
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False


def _robot_filter(id: str):
    """
    Build a SQLAlchemy filter that handles both UUID robot IDs and
    serial-number-style IDs (e.g. 'robot-003'). When id is not a valid
    UUID we only match on serial_number to avoid a Postgres DataError.
    """
    if _is_uuid(id):
        return or_(Robot.id == id, Robot.serial_number == id)
    else:
        return Robot.serial_number == id

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1")

@router.get("/missions", response_model=List[MissionResponse])
async def list_missions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).order_by(Mission.created_at.desc()))
    return result.scalars().all()

@router.post("/missions", response_model=MissionResponse)
async def create_mission(mission: MissionCreate, db: AsyncSession = Depends(get_db)):
    # Only pass fields that exist on the Mission ORM model
    mission_data = {
        "name": mission.name,
        "warehouse_id": mission.warehouse_id,
        "robot_id": mission.robot_id,
        "priority": mission.priority,
        "audit_scope": mission.audit_scope or 'FULL',
        "target_scope_id": mission.target_scope_id,
        "description": mission.description,
        "total_bins_target": mission.bins_total or mission.total_bins_target or 0,
        "status": "SCHEDULED",
    }
    new_mission = Mission(**{k: v for k, v in mission_data.items() if v is not None or k in ("audit_scope",)})
    db.add(new_mission)
    await db.commit()
    await db.refresh(new_mission)
    return new_mission

@router.get("/missions/{id}", response_model=MissionResponse)
async def get_mission(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).filter(Mission.id == id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission

@router.post("/missions/{id}/start", response_model=MissionResponse)
async def start_mission(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).filter(Mission.id == id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission.status = 'IN_PROGRESS'
    mission.started_at = datetime.utcnow()
    await db.commit()
    await db.refresh(mission)
    return mission

@router.post("/missions/{id}/pause", response_model=MissionResponse)
async def pause_mission(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).filter(Mission.id == id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission.status = 'SCHEDULED'
    await db.commit()
    await db.refresh(mission)
    return mission

@router.post("/missions/{id}/complete", response_model=MissionResponse)
async def complete_mission(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).filter(Mission.id == id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission.status = 'COMPLETED'
    mission.completed_at = datetime.utcnow()
    mission.coverage_pct = 100.0
    await db.commit()
    await db.refresh(mission)
    return mission

@router.post("/missions/{id}/cancel", response_model=MissionResponse)
async def cancel_mission(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).filter(Mission.id == id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    mission.status = 'CANCELLED'
    await db.commit()
    await db.refresh(mission)
    return mission

@router.get("/robots", response_model=List[RobotResponse])
async def list_robots(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Robot).order_by(Robot.created_at.desc()))
    robots = result.scalars().all()
    out = []
    for r in robots:
        resp = RobotResponse.model_validate(r)
        resp.robot_id = r.id
        out.append(resp)
    return out

@router.post("/robots", response_model=RobotResponse, status_code=status.HTTP_201_CREATED)
async def register_robot(payload: RobotCreateOrUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Robot).filter(Robot.serial_number == payload.serial_number))
    robot = result.scalar_one_or_none()

    if robot:
        if payload.name is not None: robot.name = payload.name
        if payload.model is not None: robot.model = payload.model
        if payload.warehouse_id is not None: robot.warehouse_id = payload.warehouse_id
        if payload.firmware_version is not None: robot.firmware_version = payload.firmware_version
        if payload.status is not None: robot.status = payload.status
        if payload.battery_pct is not None: robot.battery_pct = payload.battery_pct
    else:
        robot_id = payload.robot_id or str(uuid.uuid4())
        robot = Robot(
            id=robot_id,
            serial_number=payload.serial_number,
            name=payload.name or f"Robot-{payload.serial_number}",
            model=payload.model or "WH-AUDITOR-V1",
            warehouse_id=payload.warehouse_id,
            firmware_version=payload.firmware_version or "1.0.0-sim",
            status=payload.status or "IDLE",
            battery_pct=payload.battery_pct if payload.battery_pct is not None else 100.0
        )
        db.add(robot)

    await db.commit()
    await db.refresh(robot)
    resp = RobotResponse.model_validate(robot)
    resp.robot_id = robot.id
    return resp

@router.get("/robots/{id}", response_model=RobotResponse)
async def get_robot(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Robot).filter(
        _robot_filter(id)
    ))

@router.post("/robots/{id}/heartbeat")
async def robot_heartbeat(
    id: str,
    payload: RobotHeartbeatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Robot).filter(
        _robot_filter(id)
    ))
    robot = result.scalar_one_or_none()

    if not robot:
        if payload.warehouse_id:
            robot_id = payload.robot_id or (id if "-" in id and len(id) > 20 else str(uuid.uuid4()))
            robot = Robot(
                id=robot_id,
                serial_number=id,
                warehouse_id=payload.warehouse_id,
                status=payload.status or "IDLE",
                battery_pct=payload.battery_pct or payload.battery or 100.0
            )
            db.add(robot)
        else:
            raise HTTPException(status_code=404, detail="Robot not found")

    x = payload.x
    y = payload.y
    z = payload.z
    if payload.coord_x is not None: x = payload.coord_x
    if payload.coord_y is not None: y = payload.coord_y
    if payload.coord_z is not None: z = payload.coord_z
    if payload.position and isinstance(payload.position, dict):
        x = payload.position.get("x", x)
        y = payload.position.get("y", y)
        z = payload.position.get("z", z)

    battery = payload.battery_pct if payload.battery_pct is not None else payload.battery
    if battery is None:
        battery = float(robot.battery_pct or 100.0)

    active_mission_id = payload.mission_id or payload.active_mission_id

    if x is not None: robot.current_coord_x = x
    if y is not None: robot.current_coord_y = y
    if z is not None: robot.current_coord_z = z
    if payload.yaw is not None: robot.current_yaw = payload.yaw
    robot.battery_pct = battery
    robot.status = payload.status or robot.status
    robot.last_heartbeat = datetime.utcnow()
    if active_mission_id is not None:
        robot.active_mission_id = active_mission_id

    await db.commit()
    await db.refresh(robot)

    # Publish to Redis Pub/Sub channel 'robot.telemetry.heartbeat'
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client:
        telemetry = {
            "robot_id": robot.id,
            "serial_number": robot.serial_number,
            "warehouse_id": robot.warehouse_id,
            "x": float(robot.current_coord_x or 0.0),
            "y": float(robot.current_coord_y or 0.0),
            "z": float(robot.current_coord_z or 0.0),
            "yaw": float(robot.current_yaw or 0.0),
            "battery_pct": float(robot.battery_pct or 100.0),
            "status": robot.status,
            "active_mission_id": robot.active_mission_id,
            "timestamp": robot.last_heartbeat.isoformat()
        }
        try:
            await redis_client.publish("robot.telemetry.heartbeat", json.dumps(telemetry))
            robot_loc_key = f"robot:location:{robot.warehouse_id}"
            await redis_client.hset(robot_loc_key, robot.id, json.dumps(telemetry))
        except Exception as e:
            logger.error("failed_publishing_heartbeat_redis", error=str(e))

    return {"status": "acknowledged", "robot_id": robot.id}

@router.get("/robots/{id}/next-task")
async def get_next_task(
    id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Robot).filter(
        _robot_filter(id)
    ))
    robot = result.scalar_one_or_none()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    mission_query = await db.execute(
        select(Mission)
        .filter(
            Mission.warehouse_id == robot.warehouse_id,
            Mission.status == 'SCHEDULED',
            or_(Mission.robot_id == robot.id, Mission.robot_id == None)
        )
        .order_by(Mission.priority.asc(), Mission.created_at.asc())
    )
    mission = mission_query.scalars().first()

    if not mission:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    mission.status = 'IN_PROGRESS'
    mission.robot_id = robot.id
    mission.started_at = datetime.utcnow()
    robot.active_mission_id = mission.id
    robot.status = 'AUDITING'

    await db.commit()

    # ── Query real bin coordinates from the shared Postgres topology ───────────
    # Joins: bins → shelves → racks → aisles → zones → warehouses
    # Respects mission audit_scope (FULL / RACK / AISLE / ZONE / BIN)
    audit_scope = (mission.audit_scope or 'FULL').upper()
    target_scope_id = mission.target_scope_id or ''

    base_sql = """
        SELECT
            b.id        AS bin_id,
            b.code      AS bin_code,
            COALESCE(b.coord_x, rk.coord_x, 0.0)  AS coord_x,
            COALESCE(b.coord_y, rk.coord_y, 0.0)  AS coord_y,
            COALESCE(b.coord_z, rk.coord_z, 0.0)  AS coord_z,
            rk.code     AS rack_code,
            a.code      AS aisle_code
        FROM bins b
        JOIN shelves sh  ON sh.id  = b.shelf_id
        JOIN racks   rk  ON rk.id  = sh.rack_id
        JOIN aisles  a   ON a.id   = rk.aisle_id
        JOIN zones   z   ON z.id   = a.zone_id
        JOIN warehouses w ON w.id  = z.warehouse_id
        WHERE w.id = :wh_id
          AND b.is_active = TRUE
    """
    params: dict = {"wh_id": str(robot.warehouse_id)}

    if audit_scope == 'RACK' and target_scope_id:
        base_sql += " AND rk.code = :scope_id"
        params["scope_id"] = target_scope_id
    elif audit_scope == 'AISLE' and target_scope_id:
        base_sql += " AND a.code = :scope_id"
        params["scope_id"] = target_scope_id
    elif audit_scope == 'ZONE' and target_scope_id:
        base_sql += " AND z.code = :scope_id"
        params["scope_id"] = target_scope_id
    elif audit_scope == 'BIN' and target_scope_id:
        base_sql += " AND (b.code = :scope_id OR b.id::text = :scope_id)"
        params["scope_id"] = target_scope_id

    base_sql += " ORDER BY a.aisle_number, rk.rack_number, sh.level_number, b.bin_number LIMIT 200"

    try:
        rows_result = await db.execute(text(base_sql), params)
        bin_rows = rows_result.fetchall()
    except Exception as exc:
        logger.warning("get_next_task_bin_query_failed", error=str(exc))
        bin_rows = []

    bins = [
        {
            "bin_id": str(row.bin_id),
            "bin_code": str(row.bin_code),
            "coord_x": float(row.coord_x or 0.0),
            "coord_y": float(row.coord_y or 0.0),
            "coord_z": float(row.coord_z or 0.0),
            "rack_code": str(row.rack_code or ''),
            "aisle_code": str(row.aisle_code or ''),
        }
        for row in bin_rows
    ]
    bin_ids = [b["bin_id"] for b in bins]

    # Update total bins target with real count if not already set
    if bins and (mission.total_bins_target is None or mission.total_bins_target == 0):
        mission.total_bins_target = len(bins)
        await db.commit()

    logger.info(
        "next_task_assigned",
        robot_id=robot.id,
        mission_id=mission.id,
        bin_count=len(bins),
        audit_scope=audit_scope,
    )

    return {
        "mission_id": mission.id,
        "warehouse_id": mission.warehouse_id,
        "audit_scope": audit_scope,
        "target_scope_id": target_scope_id,
        "bins": bins,
        "bin_ids": bin_ids,
    }

