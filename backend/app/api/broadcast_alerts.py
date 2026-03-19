"""
NagarMind v2 — Admin Broadcast Alerts
backend/app/api/broadcast_alerts.py

Replaces auto-predictive alerts with MANUAL admin broadcasts.
Admin picks ward(s)/zone/city, writes a message, hits send.
All users in scope get in-app + WebSocket notification.

Add to main.py:
  from app.api.broadcast_alerts import router as broadcast_router
  app.include_router(broadcast_router, prefix="/api/admin/broadcast", tags=["Broadcast"])

DB migration required — run once:
  CREATE TABLE IF NOT EXISTS broadcast_alerts (
      alert_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      admin_id        UUID REFERENCES admins(admin_id),
      title           TEXT NOT NULL,
      message         TEXT NOT NULL,
      severity        TEXT DEFAULT 'info',
      scope           TEXT NOT NULL,
      ward_ids        INTEGER[] DEFAULT '{}',
      zone_name       TEXT,
      sent_at         TIMESTAMPTZ DEFAULT NOW(),
      recipient_count INTEGER DEFAULT 0
  );
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.core.database import get_db
from app.middleware.auth_middleware import require_admin, require_any
from app.services.websocket_manager import ws_manager

router = APIRouter(tags=["broadcast"])
logger = logging.getLogger(__name__)


class BroadcastRequest(BaseModel):
    title: str
    message: str
    severity: str = "info"        # info | warning | critical
    scope: str                    # ward | zone | city
    ward_ids: List[int] = []      # used when scope=ward
    zone_name: Optional[str] = None  # used when scope=zone


@router.post("/send")
async def send_broadcast(
    body: BroadcastRequest,
    background_tasks: BackgroundTasks,
    payload=Depends(require_admin),
    pool=Depends(get_db),
):
    """Admin sends broadcast alert to selected wards, zone, or entire city."""
    admin_id = str(payload["sub"])

    if not body.title.strip() or not body.message.strip():
        raise HTTPException(400, "Title and message are required")
    if body.severity not in ("info", "warning", "critical"):
        raise HTTPException(400, "severity must be info, warning, or critical")
    if body.scope not in ("ward", "zone", "city"):
        raise HTTPException(400, "scope must be ward, zone, or city")
    if body.scope == "ward" and not body.ward_ids:
        raise HTTPException(400, "ward_ids required when scope=ward")
    if body.scope == "zone" and not body.zone_name:
        raise HTTPException(400, "zone_name required when scope=zone")

    # Resolve target ward IDs
    if body.scope == "city":
        rows = await pool.fetch("SELECT ward_id FROM wards")
        target_wards = [r["ward_id"] for r in rows]
        zone_name = None
    elif body.scope == "zone":
        rows = await pool.fetch("SELECT ward_id FROM wards WHERE zone=$1", body.zone_name)
        target_wards = [r["ward_id"] for r in rows]
        zone_name = body.zone_name
    else:
        target_wards = body.ward_ids
        zone_name = None

    if not target_wards:
        raise HTTPException(404, "No wards found for given scope")

    # Get all users in those wards
    citizens = await pool.fetch(
        "SELECT citizen_id FROM citizens WHERE ward_id = ANY($1::int[])",
        target_wards,
    )
    officers = await pool.fetch(
        "SELECT officer_id FROM officers WHERE ward_id = ANY($1::int[]) AND is_active=TRUE",
        target_wards,
    )

    recipient_count = len(citizens) + len(officers)

    # Insert alert record
    alert_id = await pool.fetchval(
        """INSERT INTO broadcast_alerts
           (admin_id, title, message, severity, scope, ward_ids, zone_name, recipient_count)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING alert_id""",
        admin_id, body.title, body.message, body.severity,
        body.scope, target_wards, zone_name, recipient_count,
    )

    # Insert in-app notifications for all recipients
    notif_rows = []
    for c in citizens:
        notif_rows.append((str(c["citizen_id"]), "citizen", body.title, body.message, "admin_alert"))
    for o in officers:
        notif_rows.append((str(o["officer_id"]), "officer", body.title, body.message, "admin_alert"))

    if notif_rows:
        await pool.executemany(
            """INSERT INTO notifications (user_id, user_role, title, body, type)
               VALUES ($1,$2,$3,$4,$5)""",
            notif_rows,
        )

    # WebSocket push (fire and forget for all online users)
    ws_payload = {
        "event": "admin_alert",
        "alert_id": str(alert_id),
        "title": body.title,
        "message": body.message,
        "severity": body.severity,
        "scope": body.scope,
    }
    for c in citizens:
        await ws_manager.send_to_user(str(c["citizen_id"]), ws_payload)
    for o in officers:
        await ws_manager.send_to_user(str(o["officer_id"]), ws_payload)

    logger.info(f"Broadcast sent: '{body.title}' → {recipient_count} users in {len(target_wards)} wards")

    return {
        "alert_id": str(alert_id),
        "recipient_count": recipient_count,
        "ward_count": len(target_wards),
        "message": f"Alert sent to {recipient_count} users across {len(target_wards)} wards",
    }


@router.get("/history")
async def broadcast_history(pool=Depends(get_db), _=Depends(require_admin)):
    rows = await pool.fetch(
        """SELECT ba.alert_id, ba.title, ba.message, ba.severity,
                  ba.scope, ba.sent_at, ba.recipient_count, ba.zone_name,
                  a.name AS sent_by
           FROM broadcast_alerts ba
           LEFT JOIN admins a ON ba.admin_id = a.admin_id
           ORDER BY ba.sent_at DESC
           LIMIT 100""",
    )
    return {"alerts": [dict(r) for r in rows]}


@router.get("/wards")
async def list_wards_for_broadcast(pool=Depends(get_db), _=Depends(require_admin)):
    """Return ward list + zones for the broadcast form selector."""
    rows = await pool.fetch(
        "SELECT ward_id, ward_name, zone FROM wards ORDER BY zone, ward_name"
    )
    zones = {}
    for r in rows:
        z = r["zone"]
        if z not in zones:
            zones[z] = []
        zones[z].append({"ward_id": r["ward_id"], "ward_name": r["ward_name"]})
    return {"zones": zones, "wards": [dict(r) for r in rows]}


@router.get("/mine")
async def my_alerts(payload=Depends(require_any), pool=Depends(get_db)):
    """Return admin broadcast alerts for a user (via notifications)."""
    user_id = str(payload["sub"])
    rows = await pool.fetch(
        """SELECT notification_id, title, body AS message, is_read, created_at
           FROM notifications
           WHERE user_id=$1 AND type='admin_alert'
           ORDER BY created_at DESC LIMIT 50""",
        user_id,
    )
    return {"alerts": [dict(r) for r in rows]}