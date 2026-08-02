from fastapi import APIRouter, Depends, HTTPException, Query, Body
import structlog
import uuid
from typing import List, Optional
from pydantic import BaseModel

from app.database import DbSession
from app.reconciliation_repo import ReconciliationRepository
from app.schemas.reconciliation import (
    AlertCreate,
    AlertDetail,
    AlertFilters,
    AlertListResponse,
    AlertUpdateRequest,
    DashboardStats,
    InventoryResponse,
    ReconciliationResultResponse,
    RescanResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["reconciliation"])

# Hardcoded fallback warehouse ID
DEFAULT_WAREHOUSE_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

def get_repo(session: DbSession) -> ReconciliationRepository:
    return ReconciliationRepository(session)

class ResolveRequest(BaseModel):
    notes: Optional[str] = None

class AssignRequest(BaseModel):
    user_id: str

@router.get("/inventory", response_model=List[InventoryResponse])
async def list_inventory(
    warehouse_id: Optional[uuid.UUID] = Query(None),
    repo: ReconciliationRepository = Depends(get_repo)
):
    items, total = await repo.get_inventory_by_warehouse(warehouse_id or DEFAULT_WAREHOUSE_ID)
    return items

@router.get("/inventory/search", response_model=List[InventoryResponse])
async def search_inventory(
    q: str = Query(...),
    zone: Optional[str] = Query(None),
    warehouse_id: Optional[uuid.UUID] = Query(None),
    repo: ReconciliationRepository = Depends(get_repo)
):
    # Simply list all and filter in memory for now, as search is not in repo
    items, total = await repo.get_inventory_by_warehouse(warehouse_id or DEFAULT_WAREHOUSE_ID)
    
    results = []
    q_lower = q.lower()
    for item in items:
        if q_lower in item.sku.lower() or (item.lot_number and q_lower in item.lot_number.lower()):
            results.append(item)
            
    return results

@router.get("/reconciliation/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    warehouse_id: Optional[uuid.UUID] = Query(None),
    repo: ReconciliationRepository = Depends(get_repo)
):
    stats = await repo.get_dashboard_stats(warehouse_id or DEFAULT_WAREHOUSE_ID)
    return stats

@router.post("/inventory/bins/{id}/rescan", response_model=RescanResponse)
async def request_bin_rescan(
    id: str,
    repo: ReconciliationRepository = Depends(get_repo),
):
    """Create a targeted SCHEDULED rescan mission for a specific bin."""
    return await repo.create_rescan_mission(bin_id_or_code=id)

@router.post("/alerts/{id}/request-rescan", response_model=RescanResponse)
async def request_alert_rescan(
    id: str,
    repo: ReconciliationRepository = Depends(get_repo),
):
    """Request a rescan for an alert's bin, marking alert rescan requested and scheduling a mission."""
    return await repo.create_alert_rescan_mission(alert_id=id)

