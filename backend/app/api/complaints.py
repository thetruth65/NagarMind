"""
Complaints API — submit, track, update, dispute, rate.
"""
import logging
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from app.core.database import get_db
from app.middleware.auth_middleware import require_citizen, require_officer, require_any
from app.schemas.complaint_schemas import (
    ComplaintCreateRequest, StatusUpdateRequest,
    DisputeRequest, RatingRequest,
)
from app.services.complaint_pipeline import run_pipeline
from app.services.notification_service import notify_citizen, notify_officer
from app.services.ward_health_service import recalculate_ward_health
from app.services.gemini_service import analyze_dispute

router = APIRouter(tags=["complaints"])
logger = logging.getLogger(__name__)

# ─── SUBMIT ───────────────────────────────────────────────────────────────────
@router.post("/", status_code=201)
async def submit_complaint(
    body: ComplaintCreateRequest,
    background_tasks: BackgroundTasks,
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    citizen_id = payload["sub"]
    citizen = await pool.fetchrow("SELECT ward_id, full_name, phone_number, preferred_language FROM citizens WHERE citizen_id=$1", citizen_id)
    if not citizen: raise HTTPException(404, "Citizen not found")

    complaint_id = str(uuid4())
    geo_h = f"{round(body.location_lat, 4)}_{round(body.location_lng, 4)}"

    await pool.execute(
        """INSERT INTO complaints
           (complaint_id, citizen_id, ward_id, title, description, category,
            original_language, location_address, location_lat, location_lng,
            location_hash, photo_urls, audio_url, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'submitted',NOW())""",
        complaint_id, citizen_id, citizen["ward_id"],
        body.title, body.description, body.category,
        body.original_language,
        body.location_address, body.location_lat, body.location_lng,
        geo_h, body.photos, body.voice_audio_url,
    )

    await pool.execute("UPDATE citizens SET total_complaints = total_complaints + 1 WHERE citizen_id=$1", citizen_id)
    background_tasks.add_task(run_pipeline, pool, complaint_id)

    return {"complaint_id": complaint_id, "status": "submitted", "message": "Complaint submitted."}

# ─── TRACKING ─────────────────────────────────────────────────────────────────
@router.get("/track/{complaint_id}")
async def track_complaint(complaint_id: str, pool=Depends(get_db)):
    row = await pool.fetchrow(
        """SELECT c.*, ci.full_name AS citizen_name, o.full_name AS officer_name, 
                  o.designation AS officer_designation, w.ward_name
           FROM complaints c
           JOIN citizens ci ON c.citizen_id = ci.citizen_id
           LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
           JOIN wards w ON c.ward_id = w.ward_id
           WHERE c.complaint_id = $1""", complaint_id)
    if not row: raise HTTPException(404, "Complaint not found")

    history = await pool.fetch("SELECT * FROM complaint_status_history WHERE complaint_id=$1 ORDER BY created_at ASC", complaint_id)
    
    res = dict(row)
    res["status_history"] = [dict(h) for h in history]
    
    if res.get("sla_deadline") and res["status"] not in ("resolved", "closed"):
        now = datetime.now(timezone.utc)
        deadline = res["sla_deadline"].replace(tzinfo=timezone.utc)
        res["sla_remaining_seconds"] = max(0, int((deadline - now).total_seconds()))
    
    return res

@router.get("/mine")
async def my_complaints(status: Optional[str] = Query(None), limit: int = 20, offset: int = 0, payload=Depends(require_citizen), pool=Depends(get_db)):
    where_clause = "WHERE c.citizen_id = $1"
    params = [payload["sub"]]
    if status:
        where_clause += f" AND c.status = ${len(params)+1}"
        params.append(status)

    rows = await pool.fetch(
        f"""SELECT c.*, o.full_name AS officer_name, w.ward_name
            FROM complaints c
            LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
            JOIN wards w ON c.ward_id = w.ward_id
            {where_clause} ORDER BY c.created_at DESC LIMIT {limit} OFFSET {offset}""", *params)
    return {"complaints": [dict(r) for r in rows], "total": len(rows)}

# ─── OFFICER ACTIONS ──────────────────────────────────────────────────────────
@router.patch("/{complaint_id}/status")
async def update_status(complaint_id: str, body: StatusUpdateRequest, background_tasks: BackgroundTasks, payload=Depends(require_officer), pool=Depends(get_db)):
    officer_id = payload["sub"]
    c = await pool.fetchrow("SELECT * FROM complaints WHERE complaint_id=$1", complaint_id)
    if not c or str(c["assigned_officer_id"]) != officer_id: raise HTTPException(403, "Not assigned to you")

    await pool.execute("UPDATE complaints SET status=$1, resolution_note=$2, updated_at=NOW() WHERE complaint_id=$3", body.status, body.notes, complaint_id)
    await pool.execute("INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, note) VALUES ($1,$2,$3,$4,'officer',$5)", complaint_id, c["status"], body.status, officer_id, body.notes)
    
    if body.status == 'resolved':
        await pool.execute("UPDATE officers SET total_resolved = total_resolved + 1 WHERE officer_id=$1", officer_id)
        background_tasks.add_task(recalculate_ward_health, pool, c["ward_id"])

    return {"status": body.status}

@router.get("/officer/inbox")
async def officer_inbox(status: Optional[str] = None, limit: int = 50, payload=Depends(require_officer), pool=Depends(get_db)):
    params = [payload["sub"]]
    query = "SELECT c.*, w.ward_name, ci.full_name as citizen_name FROM complaints c JOIN wards w ON c.ward_id=w.ward_id JOIN citizens ci ON c.citizen_id=ci.citizen_id WHERE c.assigned_officer_id=$1"
    if status:
        query += " AND c.status=$2"
        params.append(status)
    rows = await pool.fetch(query + " ORDER BY c.created_at DESC LIMIT 100", *params)
    
    # Calc SLA
    res = []
    now = datetime.now(timezone.utc)
    for r in rows:
        d = dict(r)
        if d.get("sla_deadline"):
            rem = (d["sla_deadline"].replace(tzinfo=timezone.utc) - now).total_seconds()
            d["sla_remaining_seconds"] = max(0, int(rem))
        res.append(d)
    return {"complaints": res}

@router.get("/officer/{complaint_id}")
async def officer_complaint_detail(complaint_id: str, payload=Depends(require_officer), pool=Depends(get_db)):
    row = await pool.fetchrow("""
        SELECT c.*, ci.full_name AS citizen_name, ci.phone_number AS citizen_phone, w.ward_name 
        FROM complaints c JOIN citizens ci ON c.citizen_id=ci.citizen_id JOIN wards w ON c.ward_id=w.ward_id
        WHERE c.complaint_id=$1 AND c.assigned_officer_id=$2""", complaint_id, payload["sub"])
    if not row: raise HTTPException(404)
    
    hist = await pool.fetch("SELECT * FROM complaint_status_history WHERE complaint_id=$1 ORDER BY created_at ASC", complaint_id)
    return {**dict(row), "status_history": [dict(h) for h in hist]}

# ─── NOTIFICATIONS (FIXED) ────────────────────────────────────────────────────
@router.get("/notifications/mine")
async def my_notifications(limit: int = 20, payload=Depends(require_any), pool=Depends(get_db)):
    """Fetch notifications for ANY authenticated user (Citizen, Officer, or Admin)."""
    rows = await pool.fetch("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2", payload["sub"], limit)
    unread = await pool.fetchval("SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE", payload["sub"])
    return {"notifications": [dict(r) for r in rows], "unread_count": unread}

@router.post("/notifications/read-all")
async def mark_read(payload=Depends(require_any), pool=Depends(get_db)):
    await pool.execute("UPDATE notifications SET is_read=TRUE WHERE user_id=$1", payload["sub"])
    return {"success": True}

@router.post("/transcribe-url")
async def transcribe(audio_url: str, language_hint: str = None):
    # Mock for dev if Sarvam keys invalid
    return {"transcript": "Sample transcript of the complaint regarding water logging.", "language_code": "en"}