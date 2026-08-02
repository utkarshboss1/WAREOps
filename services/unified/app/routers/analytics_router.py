from fastapi import APIRouter, Depends, Query
import structlog
from typing import List, Optional, Dict

from app.database import DbSession
from app.reconciliation_repo import ReconciliationRepository
from app.schemas.reconciliation import (
    WarehouseKPIs,
    AccuracyDataPoint,
    AlertFrequencyPoint,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def get_repo(session: DbSession) -> ReconciliationRepository:
    return ReconciliationRepository(session)


@router.get("/kpis", response_model=WarehouseKPIs)
async def get_kpis(
    warehouse_id: Optional[str] = Query(None),
    repo: ReconciliationRepository = Depends(get_repo),
):
    """Retrieve warehouse KPIs computed from real DB records."""
    return await repo.get_warehouse_kpis(warehouse_id=warehouse_id)


@router.get("/accuracy-trend", response_model=List[AccuracyDataPoint])
async def get_accuracy_trend(
    warehouse_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    repo: ReconciliationRepository = Depends(get_repo),
):
    """Retrieve inventory accuracy trend over a specified number of days."""
    return await repo.get_accuracy_trend(warehouse_id=warehouse_id, days=days)


@router.get("/alert-frequency", response_model=List[AlertFrequencyPoint])
async def get_alert_frequency(
    warehouse_id: Optional[str] = Query(None),
    days: int = Query(14, ge=1, le=365),
    repo: ReconciliationRepository = Depends(get_repo),
):
    """Retrieve daily alert frequency breakdown by severity."""
    return await repo.get_alert_frequency(warehouse_id=warehouse_id, days=days)


@router.get("/mission-stats")
async def get_mission_stats(
    warehouse_id: Optional[str] = Query(None),
    repo: ReconciliationRepository = Depends(get_repo),
) -> Dict[str, int]:
    """Retrieve mission statistics aggregated by status."""
    return await repo.get_mission_stats(warehouse_id=warehouse_id)
