"""
alert_create.py — In-process replacement for observation→alerting HTTP call.

Previously observation_router called:
    httpx POST {ALERTING_SERVICE_URL}/api/v1/alerts

Now it inserts the alert row directly into the shared DB.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reconciliation import Alert


async def create_alert(
    session: AsyncSession,
    *,
    warehouse_id: str,
    observation_id: Optional[str] = None,
    bin_id: Optional[str] = None,
    sku: Optional[str] = None,
    alert_type: str,
    severity: str,
    title: str,
    description: Optional[str] = None,
    expected_value: Optional[str] = None,
    observed_value: Optional[str] = None,
    auto_resolvable: bool = False,
) -> Alert:
    """
    Insert an alert row directly into the shared database.

    This is called by the observation router after detecting a mismatch.
    No HTTP call needed — same DB session.
    """
    alert = Alert(
        id=str(uuid.uuid4()),
        warehouse_id=warehouse_id,
        observation_id=observation_id,
        bin_id=bin_id,
        sku=sku,
        alert_type=alert_type,
        severity=severity,
        title=title,
        description=description,
        expected_value=expected_value,
        observed_value=observed_value,
        auto_resolvable=auto_resolvable,
        status="OPEN",
    )
    session.add(alert)
    # Don't commit here — let the caller commit the full transaction
    await session.flush()
    return alert
