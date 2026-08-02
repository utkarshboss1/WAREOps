"""
alert_router.py — Alerting service REST endpoints.

All session dependencies use Annotated + Depends(get_db_session) explicitly,
which is the only correct pattern for FastAPI with async SQLAlchemy.
The old code had `session: DbSession = Depends()` with an empty Depends()
call — FastAPI has no way to infer the factory from a bare type annotation
for non-Pydantic types, causing a startup crash. Fixed here.
"""
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import structlog

from app.database import get_db_session
from app.models.reconciliation import Alert

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["alerts"])

# Correct annotated dependency — used everywhere in this file
DbSession = Annotated[AsyncSession, Depends(get_db_session)]


class AlertDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: Any
    warehouse_id: Any
    reconciliation_id: Optional[Any] = None
    observation_id: Optional[Any] = None
    bin_id: Optional[Any] = None
    sku: Optional[str] = None
    alert_type: str
    severity: str
    status: str
    title: str
    description: Optional[str] = None
    expected_value: Optional[str] = None
    observed_value: Optional[str] = None
    acknowledged_by: Optional[Any] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[Any] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    auto_resolvable: bool = False
    rescan_requested: bool = False
    created_at: datetime
    updated_at: datetime


class AlertCreate(BaseModel):
    warehouse_id: str
    reconciliation_id: Optional[str] = None
    observation_id: Optional[str] = None
    bin_id: Optional[str] = None
    sku: Optional[str] = None
    alert_type: str
    severity: str
    title: str
    description: Optional[str] = None
    expected_value: Optional[str] = None
    observed_value: Optional[str] = None
    auto_resolvable: bool = False


class ResolveRequest(BaseModel):
    notes: Optional[str] = None
    resolutionNotes: Optional[str] = None  # accept both field names from frontend


class AssignRequest(BaseModel):
    user_id: str


class DismissRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/alerts", response_model=List[AlertDetail])
async def list_alerts(
    session: DbSession,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
):
    q = select(Alert).order_by(desc(Alert.created_at)).limit(200)
    if severity:
        q = q.where(Alert.severity == severity)
    if status:
        q = q.where(Alert.status == status)
    if warehouse_id:
        q = q.where(Alert.warehouse_id == warehouse_id)
    result = await session.execute(q)
    return result.scalars().all()


@router.get("/alerts/stats")
async def get_alert_stats(session: DbSession, warehouseId: Optional[str] = None):
    """Return count of open alerts, grouped by severity."""
    from sqlalchemy import func
    q = select(Alert.severity, func.count().label("cnt")).where(
        Alert.status.in_(["OPEN", "ACKNOWLEDGED"])
    )
    if warehouseId:
        q = q.where(Alert.warehouse_id == warehouseId)
    q = q.group_by(Alert.severity)
    result = await session.execute(q)
    rows = result.all()
    return {row.severity: row.cnt for row in rows}


@router.get("/alerts/{id}", response_model=AlertDetail)
async def get_alert(id: str, session: DbSession):
    alert = await session.get(Alert, id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/alerts/{id}/acknowledge", response_model=AlertDetail)
async def acknowledge_alert(id: str, session: DbSession):
    alert = await session.get(Alert, id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.now(tz=timezone.utc)
    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/alerts/{id}/resolve", response_model=AlertDetail)
async def resolve_alert(
    id: str,
    payload: ResolveRequest = Body(...),
    session: DbSession = None,  # DbSession is already Annotated[AsyncSession, Depends(get_db_session)]
):
    alert = await session.get(Alert, id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "RESOLVED"
    alert.resolved_at = datetime.now(tz=timezone.utc)
    # Accept both field names (frontend sends resolutionNotes or notes)
    alert.resolution_notes = payload.notes or payload.resolutionNotes
    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/alerts/{id}/escalate", response_model=AlertDetail)
async def escalate_alert(id: str, session: DbSession):
    alert = await session.get(Alert, id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.severity = "CRITICAL"
    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/alerts/{id}/assign", response_model=AlertDetail)
async def assign_alert(
    id: str,
    payload: AssignRequest = Body(...),
    session: DbSession = None,
):
    alert = await session.get(Alert, id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged_by = payload.user_id
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.now(tz=timezone.utc)
    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/alerts/{id}/dismiss", response_model=AlertDetail)
async def dismiss_alert(
    id: str,
    payload: DismissRequest = Body(default=DismissRequest()),
    session: DbSession = None,
):
    alert = await session.get(Alert, id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "DISMISSED"
    if payload.reason:
        alert.resolution_notes = payload.reason
    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/alerts/{id}/request-rescan")
async def request_rescan(id: str, session: DbSession):
    alert = await session.get(Alert, id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.rescan_requested = True
    alert.status = "ACTION_REQUIRED"
    await session.commit()
    await session.refresh(alert)
    return {"status": "rescan_requested", "alert_id": id, "bin_id": alert.bin_id}


@router.post("/alerts", response_model=AlertDetail)
async def create_alert(payload: AlertCreate, session: DbSession):
    alert = Alert(
        id=str(uuid.uuid4()),
        warehouse_id=str(payload.warehouse_id),
        reconciliation_id=str(payload.reconciliation_id) if payload.reconciliation_id else None,
        observation_id=str(payload.observation_id) if payload.observation_id else None,
        bin_id=str(payload.bin_id) if payload.bin_id else None,
        sku=payload.sku,
        alert_type=payload.alert_type,
        severity=payload.severity,
        title=payload.title,
        description=payload.description,
        expected_value=payload.expected_value,
        observed_value=payload.observed_value,
        auto_resolvable=payload.auto_resolvable,
        status="OPEN",
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    logger.info("alert_created", alert_id=alert.id, severity=alert.severity, alert_type=alert.alert_type)
    return alert
