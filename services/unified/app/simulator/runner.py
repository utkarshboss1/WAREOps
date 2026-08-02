"""
simulator/runner.py — Embedded robot simulator that calls the unified app's own
FastAPI endpoints via in-process HTTP (httpx to localhost) instead of requiring
a separate robot-simulator Docker container.

This is started as an asyncio background task in lifespan after all routes are
mounted. It mimics exactly what the external robot-simulator did, but without
the network latency and without needing an 11th Railway service.

Design:
- Each simulated robot runs as its own asyncio task.
- Robots register themselves, poll for missions, simulate navigation,
  submit observations (via local HTTP), and send heartbeats.
- Uses httpx.AsyncClient pointed at http://localhost:{PORT} (the unified app itself).
- The LOCAL base URL is resolved at startup from the app config.
"""
from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime
from typing import Optional

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

_simulator_tasks: list[asyncio.Task] = []


class EmbeddedRobotAgent:
    """
    Simulated warehouse robot. Runs entirely within the unified process.
    Talks to the app via HTTP to localhost (same process — zero network cost).
    """

    def __init__(self, robot_id: str, base_url: str) -> None:
        self.robot_id = robot_id
        self.warehouse_id = settings.WAREHOUSE_ID
        self.base_url = base_url.rstrip("/")
        self.serial_number = f"SIM-{robot_id.upper()}"
        self.battery_pct = 100.0
        self.status = "IDLE"
        self.mission_id: Optional[str] = None
        self.current_x = 0.0
        self.current_y = 0.0
        self.current_z = 0.0
        self.bins: list[dict] = []
        self.connected = True
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0),
                headers={"Content-Type": "application/json"},
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def run(self) -> None:
        """Main robot loop — register, then cycle heartbeat + mission forever."""
        await asyncio.sleep(random.uniform(1.0, 5.0))  # stagger startup

        # Wait for tables to exist before doing anything (guards against Railway cold start)
        for _ in range(60):
            try:
                import httpx as _httpx
                async with _httpx.AsyncClient(timeout=3.0) as c:
                    r = await c.get(f"{self.base_url}/health")
                    if r.status_code == 200:
                        d = r.json()
                        if d.get("db_ready") and d.get("ready"):
                            break
            except Exception:
                pass
            await asyncio.sleep(2.0)

        await self._register()
        await self._fetch_topology()

        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        try:
            while True:
                if self.status == "IDLE":
                    await self._request_and_execute_mission()
                await asyncio.sleep(5.0)
        except asyncio.CancelledError:
            heartbeat_task.cancel()
            await self.close()
            raise

    # ── Registration ────────────────────────────────────────────────────────────

    async def _register(self) -> None:
        client = await self._get_client()
        try:
            r = await client.post("/api/v1/robots", json={
                "serial_number": self.serial_number,
                "name": f"SimBot {self.robot_id}",
                "model": "WH-AUDITOR-SIM-V2",
                "warehouse_id": self.warehouse_id,
                "firmware_version": "2.0.0-sim",
                "status": "IDLE",
                "battery_pct": self.battery_pct,
            })
            if r.status_code in (200, 201):
                data = r.json()
                # Use the server-assigned UUID so heartbeats match DB records
                if data.get("id"):
                    self.robot_id = str(data["id"])
                logger.info("simulator.robot_registered", robot_id=self.robot_id)
        except Exception as exc:
            logger.warning("simulator.register_failed", robot_id=self.robot_id, error=str(exc))

    # ── Topology fetch ───────────────────────────────────────────────────────────

    async def _fetch_topology(self) -> None:
        client = await self._get_client()
        try:
            r = await client.get(f"/api/v1/warehouses/{self.warehouse_id}/topology")
            if r.status_code == 200:
                data = r.json()
                for zone in data.get("zones", []):
                    for aisle in zone.get("aisles", []):
                        for rack in aisle.get("racks", []):
                            for shelf in rack.get("shelves", []):
                                for b in shelf.get("bins", []):
                                    self.bins.append({
                                        "bin_id": str(b.get("id", "")),
                                        "bin_code": str(b.get("code", "")),
                                        "coord_x": float(b.get("coord_x") or 0.0),
                                        "coord_y": float(b.get("coord_y") or 0.0),
                                        "coord_z": float(b.get("coord_z") or 0.5),
                                        "qr_code": b.get("qr_code"),
                                    })
                logger.info("simulator.topology_loaded", robot_id=self.robot_id, bins=len(self.bins))
        except Exception as exc:
            logger.warning("simulator.topology_fetch_failed", robot_id=self.robot_id, error=str(exc))

    # ── Heartbeat loop ───────────────────────────────────────────────────────────

    async def _heartbeat_loop(self) -> None:
        while True:
            self.connected = random.random() > settings.CONNECTIVITY_FAILURE_PROBABILITY
            if self.status != "CHARGING":
                self.battery_pct = max(0.0, self.battery_pct - settings.BATTERY_DRAIN_RATE)
            if self.battery_pct < 10.0 and self.status != "CHARGING":
                self.status = "CHARGING"
                self.battery_pct = 100.0

            if self.connected:
                client = await self._get_client()
                try:
                    await client.post(
                        f"/api/v1/robots/{self.robot_id}/heartbeat",
                        json={
                            "robot_id": self.robot_id,
                            "warehouse_id": self.warehouse_id,
                            "battery_pct": round(self.battery_pct, 2),
                            "coord_x": round(self.current_x, 4),
                            "coord_y": round(self.current_y, 4),
                            "coord_z": round(self.current_z, 4),
                            "status": self.status,
                            "mission_id": self.mission_id,
                        },
                        timeout=2.0,
                    )
                except Exception:
                    pass

            await asyncio.sleep(settings.HEARTBEAT_INTERVAL_MS / 1000.0)

    # ── Mission execution ────────────────────────────────────────────────────────

    async def _request_and_execute_mission(self) -> None:
        client = await self._get_client()
        try:
            r = await client.get(f"/api/v1/robots/{self.robot_id}/next-task")
            if r.status_code == 200:
                task = r.json()
                if task and "mission_id" in task:
                    self.mission_id = task["mission_id"]
                    self.status = "AUDITING"

                    # Use real bins from task if available, otherwise fall back to local cache
                    task_bins = task.get("bins") or []
                    scan_bins = task_bins if task_bins else self.bins
                    target_bins = random.sample(scan_bins, min(len(scan_bins), random.randint(5, 10))) if scan_bins else []

                    await self._execute_scan_run(target_bins)
        except Exception as exc:
            logger.warning("simulator.mission_request_failed", robot_id=self.robot_id, error=str(exc))

    async def _execute_scan_run(self, target_bins: list[dict]) -> None:
        client = await self._get_client()
        bins_scanned = 0

        for bin_obj in target_bins:
            # Navigate
            tx = float(bin_obj.get("coord_x", 0.0))
            ty = float(bin_obj.get("coord_y", 0.0))
            tz = float(bin_obj.get("coord_z", 0.5))
            await self._navigate_to(tx, ty, tz)
            await asyncio.sleep(settings.SCAN_INTERVAL_MS / 1000.0)

            # Generate scan observation
            obs = self._generate_scan(bin_obj)

            if self.connected:
                try:
                    await client.post("/api/v1/observations/batch", json={
                        "robot_id": self.robot_id,
                        "warehouse_id": self.warehouse_id,
                        "mission_id": self.mission_id,
                        "observations": [obs],
                    })
                except Exception:
                    pass

            bins_scanned += 1

        # Complete mission
        if self.mission_id:
            try:
                await client.post(f"/api/v1/missions/{self.mission_id}/complete", json={
                    "total_bins_scanned": bins_scanned,
                })
            except Exception:
                pass

        self.status = "IDLE"
        self.mission_id = None
        logger.info("simulator.mission_completed", robot_id=self.robot_id, bins_scanned=bins_scanned)

    async def _navigate_to(self, x: float, y: float, z: float) -> None:
        steps = 5
        dx = (x - self.current_x) / steps
        dy = (y - self.current_y) / steps
        dz = (z - self.current_z) / steps
        for _ in range(steps):
            self.current_x += dx
            self.current_y += dy
            self.current_z += dz
            await asyncio.sleep(0.1)

    def _generate_scan(self, bin_obj: dict) -> dict:
        decoded_qr = bin_obj.get("qr_code")
        is_blurred = random.random() < 0.05
        decode_failed = random.random() < settings.DECODE_FAILURE_PROBABILITY
        mismatch_sku = random.random() < 0.05

        if decode_failed or is_blurred:
            decoded_qr = None
        elif mismatch_sku and decoded_qr:
            decoded_qr = "SKU-SIM-MISMATCH-999"

        return {
            "robot_id": self.robot_id,
            "warehouse_id": self.warehouse_id,
            "mission_id": self.mission_id,
            "bin_id": bin_obj.get("bin_id"),
            "bin_code": bin_obj.get("bin_code"),
            "decoded_qr": decoded_qr,
            "detection_confidence": 0.50 if is_blurred else round(random.uniform(0.85, 0.99), 4),
            "frame_blur_score": 50.0 if is_blurred else 220.0,
            "robot_coord_x": round(self.current_x, 4),
            "robot_coord_y": round(self.current_y, 4),
            "robot_coord_z": round(self.current_z, 4),
            "observed_at": datetime.utcnow().isoformat(),
        }


async def start_simulator(base_url: str) -> None:
    """
    Start N simulated robot agents as asyncio background tasks.
    Called from lifespan after all routes are mounted.
    """
    if not settings.ENABLE_SIMULATOR:
        logger.info("simulator.disabled_by_config")
        return

    logger.info("simulator.starting", robot_count=settings.ROBOT_COUNT, base_url=base_url)

    for i in range(1, settings.ROBOT_COUNT + 1):
        robot_id = f"sim-robot-{i:03d}"
        agent = EmbeddedRobotAgent(robot_id=robot_id, base_url=base_url)
        task = asyncio.create_task(agent.run(), name=f"simulator-robot-{i:03d}")
        _simulator_tasks.append(task)

    logger.info("simulator.started", tasks=len(_simulator_tasks))


async def stop_simulator() -> None:
    """Cancel all simulator tasks gracefully."""
    for task in _simulator_tasks:
        task.cancel()
    if _simulator_tasks:
        await asyncio.gather(*_simulator_tasks, return_exceptions=True)
    _simulator_tasks.clear()
    logger.info("simulator.stopped")
