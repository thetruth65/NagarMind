"""
NagarMind v2 — Complaint Chat (Officer ↔ Citizen)
backend/app/api/complaint_chat.py

Add to main.py:
  from app.api.complaint_chat import router as chat_router
  app.include_router(chat_router, prefix="/api/complaints", tags=["Chat"])

Uses existing complaint_messages table (already seeded).
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_db
from app.middleware.auth_middleware import require_any
from app.services.websocket_manager import ws_manager
from app.services.notification_service import notify_citizen, notify_officer

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


class SendMessageRequest(BaseModel):
    message: str


@router.get("/{complaint_id}/messages")
async def get_messages(
    complaint_id: str,
    payload=Depends(require_any),
    pool=Depends(get_db),
):
    """Get full chat history for a complaint."""
    user_id = str(payload["sub"])
    role = payload.get("role")

    complaint = await pool.fetchrow(
        "SELECT citizen_id, officer_id, title FROM complaints WHERE complaint_id=$1",
        complaint_id,
    )
    if not complaint:
        raise HTTPException(404, "Complaint not found")

    # Access check
    is_citizen = str(complaint["citizen_id"]) == user_id
    is_officer = str(complaint["officer_id"]) == user_id if complaint["officer_id"] else False
    is_admin = role == "admin"
    if not (is_citizen or is_officer or is_admin):
        raise HTTPException(403, "Access denied")

    rows = await pool.fetch(
        """SELECT message_id, complaint_id, sender_id, sender_role,
                  sender_name, message_text, is_read, created_at
           FROM complaint_messages
           WHERE complaint_id=$1
           ORDER BY created_at ASC""",
        complaint_id,
    )

    # Mark unread messages as read for this viewer
    await pool.execute(
        """UPDATE complaint_messages
           SET is_read=TRUE
           WHERE complaint_id=$1 AND sender_id != $2 AND is_read=FALSE""",
        complaint_id, user_id,
    )

    return {"messages": [dict(r) for r in rows], "complaint_id": complaint_id}


@router.post("/{complaint_id}/messages")
async def send_message(
    complaint_id: str,
    body: SendMessageRequest,
    payload=Depends(require_any),
    pool=Depends(get_db),
):
    """Send a chat message on a complaint."""
    user_id = str(payload["sub"])
    role = payload.get("role", "citizen")

    if not body.message or not body.message.strip():
        raise HTTPException(400, "Message cannot be empty")
    if len(body.message) > 1000:
        raise HTTPException(400, "Message too long (max 1000 chars)")

    complaint = await pool.fetchrow(
        "SELECT citizen_id, officer_id, title FROM complaints WHERE complaint_id=$1",
        complaint_id,
    )
    if not complaint:
        raise HTTPException(404, "Complaint not found")

    is_citizen = str(complaint["citizen_id"]) == user_id
    is_officer = str(complaint["officer_id"]) == user_id if complaint["officer_id"] else False
    is_admin = role == "admin"
    if not (is_citizen or is_officer or is_admin):
        raise HTTPException(403, "You cannot message on this complaint")

    # Get sender name
    if role == "citizen":
        row = await pool.fetchrow("SELECT name FROM citizens WHERE citizen_id=$1", user_id)
    else:
        row = await pool.fetchrow("SELECT name FROM officers WHERE officer_id=$1", user_id)
        if not row:
            row = await pool.fetchrow("SELECT name FROM admins WHERE admin_id=$1", user_id)
    sender_name = row["name"] if row else role.title()

    msg_id = await pool.fetchval(
        """INSERT INTO complaint_messages
           (complaint_id, sender_id, sender_role, sender_name, message_text)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING message_id""",
        complaint_id, user_id, role, sender_name, body.message.strip(),
    )

    ws_payload = {
        "event": "new_message",
        "message_id": str(msg_id),
        "complaint_id": complaint_id,
        "sender_id": user_id,
        "sender_role": role,
        "sender_name": sender_name,
        "message_text": body.message.strip(),
    }

    # Push to the OTHER party
    if role == "citizen" and complaint["officer_id"]:
        officer_id = str(complaint["officer_id"])
        await ws_manager.send_to_user(officer_id, ws_payload)
        await notify_officer(
            pool, officer_id, complaint_id,
            "new_message",
            f"💬 {sender_name} on '{complaint['title']}'",
            body.message.strip()[:120],
        )
    elif role in ("officer", "admin"):
        citizen_id = str(complaint["citizen_id"])
        await ws_manager.send_to_user(citizen_id, ws_payload)
        cit = await pool.fetchrow(
            "SELECT phone_number FROM citizens WHERE citizen_id=$1", citizen_id
        )
        if cit:
            await notify_citizen(
                pool, citizen_id, cit["phone_number"],
                complaint_id, "new_message",
                f"💬 Officer update on '{complaint['title']}'",
                body.message.strip()[:120],
                language="en", send_sms=False,
            )

    return {"message_id": str(msg_id), "sent": True, "sender_name": sender_name}


@router.get("/messages/unread-count")
async def unread_count(payload=Depends(require_any), pool=Depends(get_db)):
    user_id = str(payload["sub"])
    role = payload.get("role")

    if role == "citizen":
        count = await pool.fetchval(
            """SELECT COUNT(*) FROM complaint_messages cm
               JOIN complaints c ON cm.complaint_id = c.complaint_id
               WHERE c.citizen_id=$1 AND cm.sender_id != $1 AND cm.is_read=FALSE""",
            user_id,
        )
    else:
        count = await pool.fetchval(
            """SELECT COUNT(*) FROM complaint_messages cm
               JOIN complaints c ON cm.complaint_id = c.complaint_id
               WHERE c.officer_id=$1 AND cm.sender_id != $1 AND cm.is_read=FALSE""",
            user_id,
        )

    return {"unread_messages": count or 0}