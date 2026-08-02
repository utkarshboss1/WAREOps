"""
observation_router.py — unified version.
All HTTP hops replaced with in-process function calls.
"""
import json
import uuid
from typing import List
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Query, Request
from fastapi.exceptions import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import DbSession
from app.models.observation import Observation
from app.schemas.observation import ObservationIngest, ObservationBatch, ObservationResponse, ObservationListResponse
from app.observation_repo import ObservationRepository
from app.integrations.bin_lookup import get_expected_sku
from app.integrations.alert_create import create_alert

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/v1")


async def _process_post_commit_actions(obs: Observation, redis_client, db: AsyncSession):
    """Publish raw telemetry to Redis and run SKU reconciliation check — all in-process."""
    # 1. Publish observation.raw to Redis channel
    raw_payload = {
        "event_type": "observation.raw",
        "observation_id": str(obs.id),
        "mission_id": str(obs.mission_id) if obs.mission_id else None,
        "robot_id": str(obs.robot_id),
        "warehouse_id": str(obs.warehouse_id),
        "bin_id": str(obs.bin_id) if obs.bin_id else None,
        "bin_code": obs.bin_code,
        "sku": obs.decoded_qr,
        "decoded_qr": obs.decoded_qr,
        "confidence": float(obs.detection_confidence) if obs.detection_confidence is not None else None,
        "detection_confidence": float(obs.detection_confidence) if obs.detection_confidence is not None else None,
        "robot_coord_x": float(obs.robot_coord_x) if obs.robot_coord_x is not None else None,
        "robot_coord_y": float(obs.robot_coord_y) if obs.robot_coord_y is not None else None,
        "robot_coord_z": float(obs.robot_coord_z) if obs.robot_coord_z is not None else None,
        "observed_at": obs.observed_at.isoformat() if obs.observed_at else None,
        "status": obs.status,
    }
    if redis_client:
        try:
            await redis_client.publish("observation.raw", json.dumps(raw_payload))
        except Exception as exc:
            logger.error("redis_publish_raw_error", error=str(exc))

    # 2. Reconciliation check: compare decoded_qr against expected SKU
    #    Uses in-process DB query instead of HTTP to topology-service.
    expected_sku: str | None = None
    if obs.bin_id:
        expected_sku = await get_expected_sku(obs.bin_id, db)

    # Also try by bin_code if bin_id lookup returned nothing
    if not expected_sku and obs.bin_code:
        try:
            sql = text("""
                SELECT COALESCE(b.qr_code, i.sku) AS expected
                FROM bins b
                LEFT JOIN inventory i ON i.bin_id = b.id AND i.is_active = TRUE
                WHERE b.code = :code
                LIMIT 1
            """)
            res = await db.execute(sql, {"code": obs.bin_code})
            row = res.fetchone()
            if row and row.expected:
                expected_sku = str(row.expected)
        except Exception:
            pass

    observed_sku = obs.decoded_qr
    if expected_sku and observed_sku:
        is_match = (expected_sku == observed_sku)
    elif not expected_sku and not observed_sku:
        is_match = True
    else:
        is_match = False

    now_iso = datetime.now(timezone.utc).isoformat()

    if is_match:
        verified_payload = {
            "event_type": "inventory.reconciliation.verified",
            "observation_id": str(obs.id),
            "warehouse_id": str(obs.warehouse_id),
            "bin_id": str(obs.bin_id) if obs.bin_id else None,
            "bin_code": obs.bin_code,
            "sku": observed_sku or expected_sku,
            "expected_sku": expected_sku,
            "timestamp": now_iso,
        }
        if redis_client:
            try:
                await redis_client.publish("inventory.reconciliation.verified", json.dumps(verified_payload))
            except Exception as exc:
                logger.error("redis_publish_verified_error", error=str(exc))
    else:
        mismatch_payload = {
            "event_type": "inventory.reconciliation.mismatch",
            "observation_id": str(obs.id),
            "warehouse_id": str(obs.warehouse_id),
            "bin_id": str(obs.bin_id) if obs.bin_id else None,
            "bin_code": obs.bin_code,
            "observed_sku": observed_sku,
            "expected_sku": expected_sku,
            "timestamp": now_iso,
        }
        if redis_client:
            try:
                await redis_client.publish("inventory.reconciliation.mismatch", json.dumps(mismatch_payload))
            except Exception as exc:
                logger.error("redis_publish_mismatch_error", error=str(exc))

        # Create alert in-process (no HTTP hop)
        try:
            await create_alert(
                db,
                warehouse_id=str(obs.warehouse_id),
                observation_id=str(obs.id),
                bin_id=str(obs.bin_id) if obs.bin_id else None,
                sku=observed_sku or expected_sku,
                alert_type="MISPLACED" if observed_sku else "MISSING",
                severity="HIGH",
                title=f"SKU Mismatch at Bin {obs.bin_code or obs.bin_id}",
                description=f"Expected SKU '{expected_sku}', observed SKU '{observed_sku}'",
                expected_value=expected_sku or "EMPTY",
                observed_value=observed_sku or "EMPTY",
            )
            # commit immediately so alert persists
            await db.commit()
        except Exception as exc:
            try:
                await db.rollback()
            except Exception:
                pass
            logger.error("alert_create_in_process_failed", error=str(exc))


@router.post("/observations", response_model=ObservationResponse)
async def create_observation(
    observation_data: ObservationIngest,
    request: Request,
    db: DbSession,
):
    repo = ObservationRepository(db)
    new_obs = await repo.create_observation(observation_data.model_dump(exclude={"image_b64"}))
    await db.commit()
    await db.refresh(new_obs)
    redis_client = getattr(request.app.state, "redis", None)
    await _process_post_commit_actions(new_obs, redis_client, db)
    return new_obs


@router.post("/observations/batch", response_model=List[ObservationResponse])
async def create_observation_batch(
    batch: ObservationBatch,
    request: Request,
    db: DbSession,
):
    repo = ObservationRepository(db)
    created_list = []

    for item in batch.observations:
        obs_dict = item.model_dump(exclude={"image_b64"})
        if not obs_dict.get("robot_id") and batch.robot_id:
            obs_dict["robot_id"] = batch.robot_id
        if not obs_dict.get("warehouse_id") and batch.warehouse_id:
            obs_dict["warehouse_id"] = batch.warehouse_id
        if not obs_dict.get("mission_id") and batch.mission_id:
            obs_dict["mission_id"] = batch.mission_id
        obs = await repo.create_observation(obs_dict)
        created_list.append(obs)

    await db.commit()

    redis_client = getattr(request.app.state, "redis", None)
    for obs in created_list:
        await _process_post_commit_actions(obs, redis_client, db)

    return created_list


@router.get("/observations", response_model=ObservationListResponse)
async def list_observations(
    warehouse_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: DbSession = None,
):
    repo = ObservationRepository(db)
    items, total = await repo.get_observations_by_warehouse(warehouse_id=warehouse_id, skip=skip, limit=limit)
    return ObservationListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/observations/{id}", response_model=ObservationResponse)
async def get_observation(id: uuid.UUID, db: DbSession = None):
    repo = ObservationRepository(db)
    obs = await repo.get_observation_by_id(id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    return obs
