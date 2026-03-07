from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import decode_token
from app.services.websocket_manager import ws_manager
import logging

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

@router.websocket("/ws/{user_id}")
async def websocket_user(websocket: WebSocket, user_id: str, token: str = Query(...)):
    """Per-user WebSocket — receives real-time notifications."""
    payload = decode_token(token)
    
    # EXACT string match to prevent UUID vs String object mismatches
    if not payload or str(payload.get("sub")) != str(user_id):
        logger.error(f"WS Auth Failed. Expected: {user_id}, Got: {payload.get('sub')}")
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id)
    logger.info(f"WS connected: {user_id}")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
        logger.info(f"WS disconnected: {user_id}")