"""
WebSocket routes — NagarMind
Per-user real-time notification channel.

FIX: Catches all exceptions in the receive loop, not just WebSocketDisconnect.
     Sends welcome event on connect so frontend knows connection is live.
     Handles ping/pong heartbeat to keep connection alive through proxies/firewalls.
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import decode_token
from app.services.websocket_manager import ws_manager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)


@router.websocket("/ws/{user_id}")
async def websocket_user(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(...),
):
    # ── Auth check BEFORE accepting ──────────────────────────────────────────
    payload = decode_token(token)

    if not payload or str(payload.get("sub")) != str(user_id):
        logger.warning(f"[WS] Auth failed for user_id={user_id}")
        # Must accept before closing with a custom code
        await websocket.accept()
        await websocket.close(code=4001, reason="Unauthorized")
        return

    role = payload.get("role", "citizen")

    # ── Connect ───────────────────────────────────────────────────────────────
    await ws_manager.connect(websocket, user_id)
    logger.info(f"[WS] Connected: {user_id} (role={role})")

    # Send welcome so frontend knows it's live
    try:
        await websocket.send_json({
            "event": "connected",
            "user_id": user_id,
            "role": role,
        })
    except Exception:
        pass

    # ── Main receive loop ─────────────────────────────────────────────────────
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected cleanly: {user_id}")

    except Exception as e:
        # Catches RuntimeError, ConnectionResetError, etc.
        logger.warning(f"[WS] Connection error for {user_id}: {type(e).__name__}: {e}")

    finally:
        ws_manager.disconnect(websocket, user_id)
        logger.info(f"[WS] Cleaned up: {user_id}")