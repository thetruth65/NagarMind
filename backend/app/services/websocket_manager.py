"""Real-time WebSocket broadcast manager."""
import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Maps user_id → list of WebSocket connections (multiple tabs)
        self._connections: Dict[str, List[WebSocket]] = {}
        # Public room connections (admin dashboard etc.)
        self._rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self._connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def send_to_user(self, user_id: str, data: dict):
        """Send to all connections of a specific user."""
        msg = json.dumps(data, default=str)
        dead = []
        for ws in self._connections.get(user_id, []):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast_room(self, room: str, data: dict):
        """Broadcast to all connections in a room (e.g. 'admin', 'ward_47')."""
        msg = json.dumps(data, default=str)
        dead = []
        for ws in self._rooms.get(room, []):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._rooms[room].remove(ws)

    async def join_room(self, websocket: WebSocket, room: str):
        await websocket.accept()
        self._rooms.setdefault(room, []).append(websocket)

    def leave_room(self, websocket: WebSocket, room: str):
        if websocket in self._rooms.get(room, []):
            self._rooms[room].remove(websocket)


ws_manager = ConnectionManager()