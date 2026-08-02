"""
Redis Pub/Sub subscriber for the digital-twin-sync service.

Replaces the original Kafka consumer with Redis Pub/Sub for simplified
deployment on Railway. Subscribes to the following channels:
    - ``robot.telemetry.heartbeat``         → update robot position in twin state
    - ``observation.raw``                   → update bin state with observed SKU
    - ``inventory.reconciliation.mismatch`` → mark bin MISMATCH
    - ``inventory.reconciliation.verified`` → mark bin VERIFIED

For every processed event the subscriber publishes a delta message to the
Redis Pub/Sub channel ``twin:updates:{warehouse_id}`` so that the Socket.IO
layer can fan out the change to all connected web clients.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import structlog
from redis.asyncio import Redis

from app.config import settings
from app.twin.twin_state import WarehouseTwinState

logger = structlog.get_logger(__name__)

# ── Channels (same names as the old Kafka topics) ────────────────────────────
CHANNEL_ROBOT_HEARTBEAT = "robot.telemetry.heartbeat"
CHANNEL_OBSERVATION_RAW = "observation.raw"
CHANNEL_MISMATCH = "inventory.reconciliation.mismatch"
CHANNEL_VERIFIED = "inventory.reconciliation.verified"

ALL_CHANNELS = [
    CHANNEL_ROBOT_HEARTBEAT,
    CHANNEL_OBSERVATION_RAW,
    CHANNEL_MISMATCH,
    CHANNEL_VERIFIED,
]

# Redis Pub/Sub channel template for twin deltas
_PUBSUB_CHANNEL = "twin:updates:{warehouse_id}"


class TwinKafkaConsumer:
    """
    Redis Pub/Sub subscriber that drives digital-twin state updates.

    NOTE: Class is named TwinKafkaConsumer for backward compatibility with
    main.py imports. Internally uses Redis Pub/Sub instead of Kafka.

    Each incoming message is decoded, validated, and dispatched to the
    appropriate handler method.  After updating Redis state the subscriber
    publishes a compact delta onto the Pub/Sub channel for the affected
    warehouse so the Socket.IO server can relay it to browser clients.
    """

    def __init__(self, twin_state: WarehouseTwinState, redis_client: Redis) -> None:
        self._twin = twin_state
        self._redis = redis_client
        self._running = False
        self._task: asyncio.Task[None] | None = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Start the Redis Pub/Sub subscriber."""
        logger.info("twin_subscriber_starting", channels=ALL_CHANNELS)
        self._running = True
        self._task = asyncio.create_task(self._run_subscriber(), name="twin-redis-subscriber")

    async def stop(self) -> None:
        """Gracefully stop the subscriber."""
        logger.info("twin_subscriber_stopping")
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("twin_subscriber_stopped")

    # ── Internal subscribe loop ──────────────────────────────────────────────

    async def _run_subscriber(self) -> None:
        """Subscribe to Redis channels and process messages."""
        while self._running:
            try:
                pubsub = self._redis.pubsub()
                await pubsub.subscribe(*ALL_CHANNELS)
                logger.info("twin_subscriber_connected", channels=ALL_CHANNELS)

                async for message in pubsub.listen():
                    if not self._running:
                        break
                    if message["type"] != "message":
                        continue

                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode("utf-8")

                    raw_data = message["data"]
                    if isinstance(raw_data, bytes):
                        raw_data = raw_data.decode("utf-8")

                    try:
                        event = json.loads(raw_data)
                    except json.JSONDecodeError:
                        logger.warning("twin_subscriber_invalid_json", channel=channel)
                        continue

                    await self._dispatch(channel, event)

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception("twin_subscriber_error", error=str(exc))
                if self._running:
                    await asyncio.sleep(5)  # Backoff before retry

    # ── Dispatch ──────────────────────────────────────────────────────────────

    async def _dispatch(self, channel: str, event: dict[str, Any]) -> None:
        """Route an incoming message to the correct handler."""
        try:
            if channel == CHANNEL_ROBOT_HEARTBEAT:
                await self._handle_robot_heartbeat(event)
            elif channel == CHANNEL_OBSERVATION_RAW:
                await self._handle_observation_raw(event)
            elif channel == CHANNEL_MISMATCH:
                await self._handle_mismatch(event)
            elif channel == CHANNEL_VERIFIED:
                await self._handle_verified(event)
            else:
                logger.warning("twin_subscriber_unknown_channel", channel=channel)
        except Exception as exc:
            logger.exception(
                "twin_subscriber_dispatch_error",
                channel=channel,
                error=str(exc),
                event_preview=str(event)[:200],
            )

    # ── Handlers (identical logic to original Kafka consumer) ─────────────────

    async def _handle_robot_heartbeat(self, event: dict[str, Any]) -> None:
        warehouse_id = event.get("warehouse_id", "unknown")
        robot_id: str = event.get("robot_id", "")
        if not robot_id:
            logger.warning("robot_heartbeat_missing_robot_id")
            return

        await self._twin.update_robot_position(
            warehouse_id=warehouse_id,
            robot_id=robot_id,
            x=float(event.get("x", 0.0)),
            y=float(event.get("y", 0.0)),
            z=float(event.get("z", 0.0)),
            yaw=float(event.get("yaw", 0.0)),
            battery=float(event.get("battery_pct", 0.0)),
            status=str(event.get("status", "UNKNOWN")),
        )

        delta: dict[str, Any] = {
            "type": "robot_position_update",
            "robot_id": robot_id,
            "warehouse_id": warehouse_id,
            "x": event.get("x"),
            "y": event.get("y"),
            "z": event.get("z"),
            "yaw": event.get("yaw"),
            "battery": event.get("battery_pct"),
            "status": event.get("status"),
            "ts": time.time(),
        }
        await self._publish_delta(warehouse_id, delta)

    async def _handle_observation_raw(self, event: dict[str, Any]) -> None:
        warehouse_id = event.get("warehouse_id", "unknown")
        bin_id: str = str(event.get("bin_id", ""))
        if not bin_id:
            logger.warning("observation_raw_missing_bin_id")
            return

        sku: str | None = event.get("sku") or None
        confidence = float(event.get("confidence", 0.0))

        await self._twin.update_bin_state(
            warehouse_id=warehouse_id,
            bin_id=bin_id,
            sku=sku,
            mismatch_type=None,
            confidence=confidence,
            status="OBSERVED" if sku else "EMPTY",
        )

        delta: dict[str, Any] = {
            "type": "bin_state_update",
            "bin_id": bin_id,
            "warehouse_id": warehouse_id,
            "sku": sku,
            "status": "OBSERVED" if sku else "EMPTY",
            "confidence": confidence,
            "ts": time.time(),
        }
        await self._publish_delta(warehouse_id, delta)

    async def _handle_mismatch(self, event: dict[str, Any]) -> None:
        warehouse_id = event.get("warehouse_id", "unknown")
        bin_id: str = str(event.get("bin_id", ""))
        if not bin_id:
            logger.warning("mismatch_event_missing_bin_id")
            return

        sku = event.get("observed_sku") or event.get("expected_sku")
        mismatch_type = str(event.get("mismatch_type", "UNKNOWN_MISMATCH"))
        confidence = float(event.get("confidence", 0.0))

        await self._twin.mark_bin_mismatch(
            warehouse_id=warehouse_id,
            bin_id=bin_id,
            sku=sku,
            mismatch_type=mismatch_type,
            confidence=confidence,
        )

        delta: dict[str, Any] = {
            "type": "bin_state_update",
            "bin_id": bin_id,
            "warehouse_id": warehouse_id,
            "sku": sku,
            "status": "MISMATCH",
            "mismatch_type": mismatch_type,
            "confidence": confidence,
            "ts": time.time(),
        }
        await self._publish_delta(warehouse_id, delta)
        logger.info(
            "bin_mismatch_applied",
            warehouse_id=warehouse_id,
            bin_id=bin_id,
            mismatch_type=mismatch_type,
        )

    async def _handle_verified(self, event: dict[str, Any]) -> None:
        warehouse_id = event.get("warehouse_id", "unknown")
        bin_id: str = str(event.get("bin_id", ""))
        if not bin_id:
            logger.warning("verified_event_missing_bin_id")
            return

        sku = event.get("sku")
        confidence = float(event.get("confidence", 1.0))

        await self._twin.mark_bin_verified(
            warehouse_id=warehouse_id,
            bin_id=bin_id,
            sku=sku,
            confidence=confidence,
        )

        delta: dict[str, Any] = {
            "type": "bin_state_update",
            "bin_id": bin_id,
            "warehouse_id": warehouse_id,
            "sku": sku,
            "status": "VERIFIED",
            "confidence": confidence,
            "ts": time.time(),
        }
        await self._publish_delta(warehouse_id, delta)
        logger.info(
            "bin_verified_applied",
            warehouse_id=warehouse_id,
            bin_id=bin_id,
            sku=sku,
        )

    # ── Pub/Sub publisher ─────────────────────────────────────────────────────

    async def _publish_delta(self, warehouse_id: str, delta: dict[str, Any]) -> None:
        channel = _PUBSUB_CHANNEL.format(warehouse_id=warehouse_id)
        try:
            await self._redis.publish(channel, json.dumps(delta))
        except Exception as exc:
            logger.warning(
                "twin_pubsub_publish_failed",
                channel=channel,
                error=str(exc),
            )
