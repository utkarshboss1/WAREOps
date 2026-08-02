"""
REST API router for digital twin state queries.

Endpoints:
    GET /api/v1/warehouses/{warehouse_id}/twin/snapshot
        Returns the full current twin state for a warehouse.

    GET /api/v1/warehouses/{warehouse_id}/twin/robots
        Returns all active robot positions.

    GET /api/v1/warehouses/{warehouse_id}/twin/bins
        Returns all bin states.

    GET /api/v1/warehouses/{warehouse_id}/twin/history
        Returns historical robot path positions (query param: robot_id, limit).
"""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, BackgroundTasks
import json
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["digital-twin"])


# ── Response models ───────────────────────────────────────────────────────────

class RobotPositionResponse(BaseModel):
    """Individual robot position entry."""

    robot_id: str
    warehouse_id: str
    x: float
    y: float
    z: float
    yaw: float
    battery: float
    status: str
    last_seen: float


class BinStateResponse(BaseModel):
    """Individual bin state entry."""

    bin_id: str
    warehouse_id: str
    sku: str | None
    mismatch_type: str | None
    confidence: float
    status: str
    last_updated: float


class TwinStatsResponse(BaseModel):
    """Aggregate statistics for the twin snapshot."""

    total_bins_tracked: int
    mismatch_count: int
    verified_count: int
    observed_count: int
    active_robots: int
    robots_online: int
    average_battery: float


class WarehouseSnapshotResponse(BaseModel):
    """Full digital twin snapshot for a warehouse."""

    warehouse_id: str
    robots: list[dict[str, Any]]
    bins: dict[str, Any]
    stats: TwinStatsResponse
    snapshot_ts: float


class RobotPathPointResponse(BaseModel):
    """Single point in a robot's travel path."""

    x: float
    y: float
    z: float
    yaw: float
    ts: float


class RobotHistoryResponse(BaseModel):
    """Robot historical path response."""

    warehouse_id: str
    robot_id: str
    path: list[RobotPathPointResponse]
    total_points: int


class RobotsListResponse(BaseModel):
    """List of robot positions."""

    warehouse_id: str
    robots: list[dict[str, Any]]
    count: int


class BinsStateResponse(BaseModel):
    """Map of bin states."""

    warehouse_id: str
    bins: dict[str, Any]
    count: int

class RobotHeartbeatRequest(BaseModel):
    """Robot heartbeat telemetry payload."""
    warehouse_id: str = Field(default="a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    robot_id: str
    x: float
    y: float
    z: float = 0.0
    yaw: float = 0.0
    battery_pct: float = 100.0
    status: str = "IDLE"
    mission_id: str | None = None


# ── Dependency ────────────────────────────────────────────────────────────────

def get_twin_state(request: Request):  # type: ignore[return]
    """Extract the WarehouseTwinState from the app state."""
    twin_state = getattr(request.app.state, "twin_state", None)
    if twin_state is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Twin state not initialised",
        )
    return twin_state


def get_redis_client(request: Request):  # type: ignore[return]
    """Extract the Redis client from the app state."""
    redis_client = getattr(request.app.state, "redis_client", None)
    if redis_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis client not initialised",
        )
    return redis_client

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/warehouses/{warehouse_id}/twin/snapshot",
    response_model=WarehouseSnapshotResponse,
    summary="Get full warehouse twin snapshot",
    description=(
        "Returns the complete live digital twin state for the given warehouse, "
        "including all robot positions, bin states, and aggregate statistics."
    ),
)
async def get_twin_snapshot(
    warehouse_id: str,
    twin_state: Annotated[Any, Depends(get_twin_state)],
) -> WarehouseSnapshotResponse:
    """Fetch and return the full warehouse twin snapshot."""
    try:
        snapshot = await twin_state.get_warehouse_snapshot(warehouse_id)
    except Exception as exc:
        logger.exception(
            "snapshot_fetch_error",
            warehouse_id=warehouse_id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch warehouse snapshot",
        ) from exc

    return WarehouseSnapshotResponse(
        warehouse_id=snapshot["warehouse_id"],
        robots=snapshot["robots"],
        bins=snapshot["bins"],
        stats=TwinStatsResponse(**snapshot["stats"]),
        snapshot_ts=snapshot["snapshot_ts"],
    )


@router.get(
    "/warehouses/{warehouse_id}/twin/robots",
    response_model=RobotsListResponse,
    summary="Get robot positions",
    description="Returns all currently tracked robot positions for the warehouse.",
)
async def get_robot_positions(
    warehouse_id: str,
    twin_state: Annotated[Any, Depends(get_twin_state)],
) -> RobotsListResponse:
    """Return all active robot positions for the warehouse."""
    try:
        robots = await twin_state.get_robot_positions(warehouse_id)
    except Exception as exc:
        logger.exception(
            "robot_positions_fetch_error",
            warehouse_id=warehouse_id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch robot positions",
        ) from exc

    return RobotsListResponse(
        warehouse_id=warehouse_id,
        robots=robots,
        count=len(robots),
    )


@router.get(
    "/warehouses/{warehouse_id}/twin/bins",
    response_model=BinsStateResponse,
    summary="Get bin states",
    description="Returns all bin occupancy and audit states for the warehouse.",
)
async def get_bin_states(
    warehouse_id: str,
    twin_state: Annotated[Any, Depends(get_twin_state)],
) -> BinsStateResponse:
    """Return all bin states for the warehouse."""
    try:
        bins = await twin_state.get_bin_states(warehouse_id)
    except Exception as exc:
        logger.exception(
            "bin_states_fetch_error",
            warehouse_id=warehouse_id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch bin states",
        ) from exc

    return BinsStateResponse(
        warehouse_id=warehouse_id,
        bins=bins,
        count=len(bins),
    )


@router.get(
    "/warehouses/{warehouse_id}/twin/history",
    response_model=RobotHistoryResponse,
    summary="Get robot path history",
    description=(
        "Returns the historical travel path for a specific robot in the warehouse. "
        "Path is stored in Redis as a capped circular list."
    ),
)
async def get_robot_path_history(
    warehouse_id: str,
    twin_state: Annotated[Any, Depends(get_twin_state)],
    robot_id: Annotated[str, Query(description="Robot identifier")],
    limit: Annotated[int, Query(ge=1, le=500, description="Maximum path points to return")] = 100,
) -> RobotHistoryResponse:
    """Return historical path positions for a specific robot."""
    if not robot_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="robot_id query parameter is required",
        )

    try:
        path_data = await twin_state.get_robot_path_history(
            warehouse_id=warehouse_id,
            robot_id=robot_id,
            limit=limit,
        )
    except Exception as exc:
        logger.exception(
            "robot_history_fetch_error",
            warehouse_id=warehouse_id,
            robot_id=robot_id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch robot path history",
        ) from exc

    path_points = [
        RobotPathPointResponse(
            x=p.get("x", 0.0),
            y=p.get("y", 0.0),
            z=p.get("z", 0.0),
            yaw=p.get("yaw", 0.0),
            ts=p.get("ts", 0.0),
        )
        for p in path_data
    ]

    return RobotHistoryResponse(
        warehouse_id=warehouse_id,
        robot_id=robot_id,
        path=path_points,
        total_points=len(path_points),
    )


@router.post(
    "/twin/robot-heartbeat",
    status_code=status.HTTP_200_OK,
    summary="Receive robot heartbeat telemetry",
    description="Updates the twin state and publishes telemetry for connected clients.",
)
async def post_robot_heartbeat(
    payload: RobotHeartbeatRequest,
    background_tasks: BackgroundTasks,
    twin_state: Annotated[Any, Depends(get_twin_state)],
    redis_client: Annotated[Any, Depends(get_redis_client)],
) -> dict:
    """Handle incoming robot telemetry heartbeat."""
    # Update twin state immediately
    await twin_state.update_robot_position(
        warehouse_id=payload.warehouse_id,
        robot_id=payload.robot_id,
        x=payload.x,
        y=payload.y,
        z=payload.z,
        yaw=payload.yaw,
        battery=payload.battery_pct,
        status=payload.status,
    )

    # Fire off a background task to publish to Redis Pub/Sub so clients get the update
    # Note: We publish to both the twin delta channel (for Socket.IO) 
    # and the original robot.telemetry.heartbeat for consistency if needed.
    
    async def _publish_telemetry():
        try:
            # 1. Delta for Socket.IO clients directly
            delta = {
                "type": "robot_position_update",
                "warehouse_id": payload.warehouse_id,
                "robot": {
                    "robot_id": payload.robot_id,
                    "x": payload.x,
                    "y": payload.y,
                    "z": payload.z,
                    "yaw": payload.yaw,
                    "battery": payload.battery_pct,
                    "status": payload.status,
                },
            }
            channel = f"twin:updates:{payload.warehouse_id}"
            await redis_client.publish(channel, json.dumps(delta))
            
            # 2. Raw telemetry channel (if other services still listen to it)
            raw_event = {
                "warehouse_id": payload.warehouse_id,
                "robot_id": payload.robot_id,
                "x": payload.x,
                "y": payload.y,
                "z": payload.z,
                "yaw": payload.yaw,
                "battery_pct": payload.battery_pct,
                "status": payload.status,
                "mission_id": payload.mission_id,
            }
            await redis_client.publish("robot.telemetry.heartbeat", json.dumps(raw_event))
            
        except Exception as exc:
            logger.error(f"Failed to publish heartbeat telemetry: {exc}")

    background_tasks.add_task(_publish_telemetry)
    return {"status": "acknowledged", "robot_id": payload.robot_id}

