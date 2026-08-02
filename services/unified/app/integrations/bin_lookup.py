"""
bin_lookup.py — In-process replacement for observation→topology HTTP call.

Previously observation_router called:
    httpx GET {TOPOLOGY_SERVICE_URL}/api/v1/bins/{bin_id}

Now it queries the shared DB directly. No network hop needed.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def get_expected_sku(
    bin_id: uuid.UUID | str,
    session: AsyncSession,
) -> Optional[str]:
    """
    Return the expected QR code / SKU for a bin by looking up:
      1. bins.qr_code (set by the seed from warehouse_database.xlsx)
      2. inventory.sku (WMS expected SKU for the bin)

    Returns None if the bin has no expected value (unassigned/empty slot).
    """
    bid = str(bin_id)
    try:
        sql = text("""
            SELECT COALESCE(b.qr_code, i.sku) AS expected
            FROM bins b
            LEFT JOIN inventory i ON i.bin_id = b.id AND i.is_active = TRUE
            WHERE b.id = :bid
            LIMIT 1
        """)
        result = await session.execute(sql, {"bid": bid})
        row = result.fetchone()
        if row and row.expected:
            return str(row.expected)
    except Exception:
        pass
    return None


async def get_bin_code(
    bin_id: uuid.UUID | str,
    session: AsyncSession,
) -> Optional[str]:
    """Return the human-readable bin code for a bin UUID."""
    bid = str(bin_id)
    try:
        sql = text("SELECT code FROM bins WHERE id = :bid LIMIT 1")
        result = await session.execute(sql, {"bid": bid})
        row = result.fetchone()
        if row:
            return str(row.code)
    except Exception:
        pass
    return None
