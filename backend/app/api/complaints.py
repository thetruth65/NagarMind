# """
# Complaints API — NagarMind
# All complaint CRUD + notifications endpoints.

# Routes:
#   POST   /api/complaints                          → Submit complaint
#   GET    /api/complaints/my                       → My complaints (citizen)
#   GET    /api/complaints/officer/inbox            → Officer inbox
#   GET    /api/complaints/notifications/mine       → My notifications ✅ FIXED
#   POST   /api/complaints/notifications/read-all   → Mark all read ✅ FIXED
#   PATCH  /api/complaints/notifications/:id/read   → Mark one read ✅ FIXED
#   GET    /api/complaints/:id                      → Get complaint detail
#   GET    /api/complaints/:id/public               → Public tracking (no auth)
#   PATCH  /api/complaints/:id/status               → Update status (officer)
#   POST   /api/complaints/:id/rate                 → Rate resolution (citizen)
#   POST   /api/complaints/:id/dispute              → Dispute resolution (citizen)
# """

# import logging
# from datetime import datetime, timezone
# from typing import Optional
# from uuid import uuid4

# from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
# from app.core.database import get_db
# from app.middleware.auth_middleware import require_citizen, require_officer, require_any
# from app.schemas.complaint_schemas import (
#     ComplaintCreateRequest,
#     StatusUpdateRequest,
#     DisputeRequest,
#     RatingRequest,
# )
# from app.services.complaint_pipeline import run_pipeline

# router = APIRouter(tags=["complaints"])
# logger = logging.getLogger(__name__)


# # ─── SUBMIT COMPLAINT ─────────────────────────────────────────────────────────
# @router.post("")
# async def submit_complaint(
#     body: ComplaintCreateRequest,
#     background_tasks: BackgroundTasks,
#     payload=Depends(require_citizen),
#     pool=Depends(get_db),
# ):
#     citizen_id = payload["sub"]

#     # Get citizen's ward
#     citizen = await pool.fetchrow(
#         "SELECT ward_id FROM citizens WHERE citizen_id=$1", citizen_id
#     )
#     if not citizen:
#         raise HTTPException(404, "Citizen not found")

#     ward_id = citizen["ward_id"]

#     import hashlib
#     def geo_hash(lat: float, lng: float) -> str:
#         return hashlib.md5(f"{round(lat,4)},{round(lng,4)}".encode()).hexdigest()[:8]

#     location_hash = geo_hash(body.location_lat, body.location_lng)

#     complaint_id = await pool.fetchval(
#         """INSERT INTO complaints
#            (citizen_id, ward_id, title, description, original_language,
#             category, location_lat, location_lng, location_address,
#             location_hash, photo_urls, audio_url, voice_transcript,
#             status, submitted_at)
#            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'submitted',NOW())
#            RETURNING complaint_id""",
#         citizen_id, ward_id,
#         body.title, body.description, body.original_language,
#         body.category,
#         body.location_lat, body.location_lng, body.location_address,
#         location_hash,
#         body.photos or [],
#         body.voice_audio_url,
#         body.voice_transcript,
#     )

#     # Update citizen complaint count
#     await pool.execute(
#         "UPDATE citizens SET total_complaints = total_complaints + 1 WHERE citizen_id=$1",
#         citizen_id
#     )

#     # Run AI pipeline in background
#     background_tasks.add_task(run_pipeline, pool, str(complaint_id))

#     return {
#         "complaint_id": str(complaint_id),
#         "status": "submitted",
#         "message": "Complaint submitted. AI is classifying it now.",
#     }


# # ─── MY COMPLAINTS (Citizen) ──────────────────────────────────────────────────
# @router.get("/my")
# async def my_complaints(
#     status: Optional[str] = Query(None),
#     page: int = Query(1, ge=1),
#     limit: int = Query(20, le=50),
#     payload=Depends(require_citizen),
#     pool=Depends(get_db),
# ):
#     offset = (page - 1) * limit
#     cid = payload["sub"]

#     where = "WHERE c.citizen_id=$1"
#     params: list = [cid]
#     if status:
#         where += f" AND c.status=$2"
#         params.append(status)

#     rows = await pool.fetch(
#         f"""SELECT c.*,
#                    w.ward_name,
#                    o.full_name AS officer_name,
#                    EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
#             FROM complaints c
#             LEFT JOIN wards w ON c.ward_id = w.ward_id
#             LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
#             {where}
#             ORDER BY c.created_at DESC
#             LIMIT {limit} OFFSET {offset}""",
#         *params,
#     )
#     total = await pool.fetchval(
#         f"SELECT COUNT(*) FROM complaints c {where}", *params
#     )

#     return {
#         "complaints": [dict(r) for r in rows],
#         "total": total,
#         "page": page,
#         "pages": (total + limit - 1) // limit,
#     }


# # ─── OFFICER INBOX ────────────────────────────────────────────────────────────
# @router.get("/officer/inbox")
# async def officer_inbox(
#     status: Optional[str] = Query(None),
#     urgency: Optional[str] = Query(None),
#     page: int = Query(1, ge=1),
#     limit: int = Query(20, le=50),
#     payload=Depends(require_officer),
#     pool=Depends(get_db),
# ):
#     offset = (page - 1) * limit
#     officer_id = payload["sub"]

#     conditions = ["c.assigned_officer_id=$1"]
#     params: list = [officer_id]

#     if status:
#         params.append(status)
#         conditions.append(f"c.status=${len(params)}")
#     if urgency:
#         params.append(urgency)
#         conditions.append(f"c.urgency=${len(params)}")

#     where = "WHERE " + " AND ".join(conditions)

#     rows = await pool.fetch(
#         f"""SELECT c.*,
#                    w.ward_name,
#                    ci.full_name AS citizen_name,
#                    ci.phone_number AS citizen_phone,
#                    EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
#             FROM complaints c
#             LEFT JOIN wards w ON c.ward_id = w.ward_id
#             LEFT JOIN citizens ci ON c.citizen_id = ci.citizen_id
#             {where}
#             ORDER BY
#               CASE c.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
#               c.sla_deadline ASC NULLS LAST,
#               c.created_at DESC
#             LIMIT {limit} OFFSET {offset}""",
#         *params,
#     )
#     total = await pool.fetchval(
#         f"SELECT COUNT(*) FROM complaints c {where}", *params
#     )

#     return {
#         "complaints": [dict(r) for r in rows],
#         "total": total,
#         "page": page,
#         "pages": (total + limit - 1) // limit,
#     }


# # ─── NOTIFICATIONS — MINE ─────────────────────────────────────────────────────
# # ✅ FIX: This MUST come before /{complaint_id} routes to avoid path conflicts
# @router.get("/notifications/mine")
# async def my_notifications(
#     payload=Depends(require_any),
#     pool=Depends(get_db),
# ):
#     """
#     Get notifications for the current user.
#     Works for citizen, officer, and admin roles.
#     """
#     user_id = payload["sub"]

#     rows = await pool.fetch(
#         """SELECT * FROM notifications
#            WHERE user_id = $1
#            ORDER BY created_at DESC
#            LIMIT 50""",
#         user_id,
#     )
#     unread_count = sum(1 for r in rows if not r["is_read"])

#     return {
#         "notifications": [dict(r) for r in rows],
#         "unread_count": unread_count,
#     }


# # ─── NOTIFICATIONS — MARK ALL READ ────────────────────────────────────────────
# @router.post("/notifications/read-all")
# async def mark_all_notifications_read(
#     payload=Depends(require_any),
#     pool=Depends(get_db),
# ):
#     user_id = payload["sub"]
#     await pool.execute(
#         "UPDATE notifications SET is_read=TRUE WHERE user_id=$1",
#         user_id,
#     )
#     return {"success": True}


# # ─── NOTIFICATIONS — MARK ONE READ ────────────────────────────────────────────
# @router.patch("/notifications/{notif_id}/read")
# async def mark_notification_read(
#     notif_id: str,
#     payload=Depends(require_any),
#     pool=Depends(get_db),
# ):
#     user_id = payload["sub"]
#     await pool.execute(
#         "UPDATE notifications SET is_read=TRUE WHERE notification_id=$1 AND user_id=$2",
#         notif_id, user_id,
#     )
#     return {"success": True}


# # # ─── TRANSCRIBE URL ───────────────────────────────────────────────────────────
# # # Called by frontend after uploading audio to R2
# # @router.post("/transcribe-url")
# # async def transcribe_audio_url(
# #     audio_url: str = Query(..., description="Public URL of the uploaded audio file"),
# #     language_hint: str = Query(None, description="Language hint e.g. 'hi', 'ta', 'bn'"),
# #     payload=Depends(require_citizen),
# # ):
# #     """
# #     Transcribe audio from a URL using Sarvam STT.
# #     Frontend uploads audio to R2, passes the public URL here.
# #     Returns transcript + detected language.
# #     """
# #     from app.services.sarvam_service import speech_to_text_from_url
# #     result = await speech_to_text_from_url(audio_url, language_hint)
# #     return {
# #         "transcript":    result["transcript"],
# #         "language_code": result["language_code"],
# #         "confidence":    result["confidence"],
# #     }

# @router.post("/transcribe-url")
# async def transcribe_audio_url(
#     audio_url: str,
#     language_hint: str | None = None,
#     payload=Depends(require_any),
# ):
#     """
#     Download audio from R2 URL and transcribe via Groq Whisper (free tier).
#     Replaces Sarvam STT which was returning empty transcripts.
#     """
#     import httpx, tempfile, os
#     from groq import Groq

#     groq_key = os.getenv("GROQ_API_KEY")
#     if not groq_key:
#         raise HTTPException(500, "GROQ_API_KEY not configured")

#     # Download audio from R2
#     try:
#         async with httpx.AsyncClient(timeout=30) as client:
#             r = await client.get(audio_url)
#             r.raise_for_status()
#             audio_bytes = r.content
#     except Exception as e:
#         raise HTTPException(400, f"Could not fetch audio: {e}")

#     if len(audio_bytes) < 1000:
#         raise HTTPException(400, "Audio file too small — no speech recorded")

#     # Write to temp file (Groq SDK needs a file object)
#     with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
#         tmp.write(audio_bytes)
#         tmp_path = tmp.name

#     try:
#         client = Groq(api_key=groq_key)
#         with open(tmp_path, "rb") as f:
#             result = client.audio.transcriptions.create(
#                 file=("voice.webm", f, "audio/webm"),
#                 model="whisper-large-v3-turbo",  # free, fast, multilingual
#                 language=language_hint[:2] if language_hint else None,  # 'hi', 'bn' etc
#                 response_format="text",
#             )
#         transcript = result if isinstance(result, str) else result.text
#         return {"transcript": transcript.strip(), "language": language_hint}
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(500, f"Transcription failed: {e}")
#     finally:
#         os.unlink(tmp_path)

# """
# UPDATED ComplaintCreateRequest schema — add these fields to complaint_schemas.py:

# class ComplaintCreateRequest(BaseModel):
#     title: str
#     description: str
#     title_original: Optional[str] = None          # ← NEW: native language title
#     description_original: Optional[str] = None    # ← NEW: native language description  
#     original_language: str = "en"
#     category: Optional[str] = None
#     location_lat: float
#     location_lng: float
#     location_address: str
#     photos: Optional[List[str]] = None
#     voice_audio_url: Optional[str] = None
#     voice_transcript: Optional[str] = None

# UPDATED submit_complaint INSERT — add title_original and description_original columns.
# Make sure your DB has these columns:
#   ALTER TABLE complaints ADD COLUMN IF NOT EXISTS title_original TEXT;
#   ALTER TABLE complaints ADD COLUMN IF NOT EXISTS description_original TEXT;

# Then update the INSERT in submit_complaint:

#     complaint_id = await pool.fetchval(
#         \"""INSERT INTO complaints
#            (citizen_id, ward_id, 
#             title, description,                         -- English versions (primary)
#             title_original, description_original,       -- Native language versions
#             original_language,
#             category, location_lat, location_lng, location_address,
#             location_hash, photo_urls, audio_url, voice_transcript,
#             status, submitted_at)
#            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'submitted',NOW())
#            RETURNING complaint_id\""",
#         citizen_id, ward_id,
#         body.title, body.description,
#         body.title_original, body.description_original,
#         body.original_language,
#         body.category,
#         body.location_lat, body.location_lng, body.location_address,
#         location_hash,
#         body.photos or [],
#         body.voice_audio_url,
#         body.voice_transcript,
#     )
# """

# # ─── GET COMPLAINT (authenticated) ───────────────────────────────────────────
# @router.get("/{complaint_id}")
# async def get_complaint(
#     complaint_id: str,
#     payload=Depends(require_any),
#     pool=Depends(get_db),
# ):
#     user_id = payload["sub"]
#     role = payload.get("role")

#     row = await pool.fetchrow(
#         """SELECT c.*,
#                   w.ward_name,
#                   o.full_name AS officer_name,
#                   o.designation AS officer_designation,
#                   o.phone_number AS officer_phone,
#                   ci.full_name AS citizen_name,
#                   EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
#            FROM complaints c
#            LEFT JOIN wards w ON c.ward_id = w.ward_id
#            LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
#            LEFT JOIN citizens ci ON c.citizen_id = ci.citizen_id
#            WHERE c.complaint_id=$1""",
#         complaint_id,
#     )
#     if not row:
#         raise HTTPException(404, "Complaint not found")

#     d = dict(row)

#     # Fetch status history
#     history = await pool.fetch(
#         """SELECT * FROM complaint_status_history
#            WHERE complaint_id=$1
#            ORDER BY created_at ASC""",
#         complaint_id,
#     )
#     d["status_history"] = [dict(h) for h in history]

#     # Access control: citizens can only see their own complaints
#     if role == "citizen" and str(d["citizen_id"]) != str(user_id):
#         raise HTTPException(403, "Access denied")

#     return d


# # ─── GET COMPLAINT (public / no auth — for tracking links) ───────────────────
# @router.get("/{complaint_id}/public")
# async def get_complaint_public(
#     complaint_id: str,
#     pool=Depends(get_db),
# ):
#     """Public tracking endpoint — returns limited info, no auth needed."""
#     row = await pool.fetchrow(
#         """SELECT
#                c.complaint_id, c.title, c.category, c.urgency, c.status,
#                c.location_address, c.location_lat, c.location_lng,
#                c.created_at, c.updated_at, c.resolved_at,
#                c.sla_deadline, c.sla_breached, c.ai_summary,
#                c.resolution_note, c.photo_urls,
#                w.ward_name,
#                o.full_name AS officer_name,
#                o.designation AS officer_designation,
#                EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
#            FROM complaints c
#            LEFT JOIN wards w ON c.ward_id = w.ward_id
#            LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
#            WHERE c.complaint_id=$1""",
#         complaint_id,
#     )
#     if not row:
#         raise HTTPException(404, "Complaint not found")

#     d = dict(row)

#     history = await pool.fetch(
#         """SELECT old_status, new_status, note, changed_by_role, created_at
#            FROM complaint_status_history
#            WHERE complaint_id=$1
#            ORDER BY created_at ASC""",
#         complaint_id,
#     )
#     d["status_history"] = [dict(h) for h in history]

#     return d


# # ─── UPDATE STATUS (Officer/Admin) ────────────────────────────────────────────
# @router.patch("/{complaint_id}/status")
# async def update_complaint_status(
#     complaint_id: str,
#     body: StatusUpdateRequest,
#     payload=Depends(require_officer),
#     pool=Depends(get_db),
# ):
#     officer_id = payload["sub"]

#     complaint = await pool.fetchrow(
#         "SELECT * FROM complaints WHERE complaint_id=$1",
#         complaint_id,
#     )
#     if not complaint:
#         raise HTTPException(404, "Complaint not found")

#     old_status = complaint["status"]

#     # Update complaint
#     update_fields = {"status": body.status, "updated_at": datetime.now(timezone.utc)}
#     if body.status == "acknowledged" and not complaint["acknowledged_at"]:
#         update_fields["acknowledged_at"] = datetime.now(timezone.utc)
#     if body.status == "resolved" and not complaint["resolved_at"]:
#         update_fields["resolved_at"] = datetime.now(timezone.utc)
#         # Update officer stats
#         await pool.execute(
#             """UPDATE officers SET
#                total_resolved = total_resolved + 1,
#                sla_compliance_rate = (
#                  SELECT ROUND(
#                    COUNT(*) FILTER (WHERE NOT sla_breached)::decimal /
#                    NULLIF(COUNT(*), 0) * 100, 2
#                  )
#                  FROM complaints
#                  WHERE assigned_officer_id=$1
#                    AND status IN ('resolved','closed')
#                )
#                WHERE officer_id=$1""",
#             officer_id,
#         )

#     if body.notes:
#         update_fields["resolution_note"] = body.notes

#     if body.photos_added:
#         existing_photos = complaint["photo_urls"] or []
#         update_fields["photo_urls"] = existing_photos + body.photos_added

#     set_parts = [f"{k}=${i+2}" for i, k in enumerate(update_fields.keys())]
#     values = list(update_fields.values())

#     await pool.execute(
#         f"UPDATE complaints SET {', '.join(set_parts)} WHERE complaint_id=$1",
#         complaint_id, *values,
#     )

#     # Status history
#     await pool.execute(
#         """INSERT INTO complaint_status_history
#            (complaint_id, old_status, new_status, changed_by_id, changed_by_role, note)
#            VALUES ($1,$2,$3,$4,'officer',$5)""",
#         complaint_id, old_status, body.status, officer_id, body.notes,
#     )

#     # Notify citizen
#     from app.services.notification_service import notify_citizen
#     citizen = await pool.fetchrow(
#         "SELECT citizen_id, phone_number, preferred_language FROM citizens WHERE citizen_id=$1",
#         complaint["citizen_id"],
#     )
#     if citizen:
#         status_messages = {
#             "acknowledged": "Your complaint has been acknowledged by the officer.",
#             "in_progress": f"Work has started: {body.notes or 'Officer is on-site.'}",
#             "resolved": f"Your complaint has been resolved. {body.notes or ''}",
#             "closed": "Your complaint has been closed.",
#         }
#         await notify_citizen(
#             pool,
#             str(citizen["citizen_id"]),
#             citizen["phone_number"],
#             complaint_id,
#             f"complaint_{body.status}",
#             f"Complaint {body.status.replace('_', ' ').title()}",
#             status_messages.get(body.status, f"Status updated to {body.status}"),
#             language=citizen["preferred_language"],
#         )

#     # Recalculate ward health
#     from app.services.ward_health_service import recalculate_ward_health
#     await recalculate_ward_health(pool, complaint["ward_id"])

#     return {"success": True, "status": body.status}


# # ─── RATE COMPLAINT ───────────────────────────────────────────────────────────
# @router.post("/{complaint_id}/rate")
# async def rate_complaint(
#     complaint_id: str,
#     body: RatingRequest,
#     payload=Depends(require_citizen),
#     pool=Depends(get_db),
# ):
#     citizen_id = payload["sub"]

#     complaint = await pool.fetchrow(
#         "SELECT * FROM complaints WHERE complaint_id=$1 AND citizen_id=$2",
#         complaint_id, citizen_id,
#     )
#     if not complaint:
#         raise HTTPException(404, "Complaint not found or not yours")
#     if complaint["status"] not in ("resolved", "closed"):
#         raise HTTPException(400, "Can only rate resolved complaints")
#     if complaint["citizen_rating"]:
#         raise HTTPException(400, "Already rated")

#     await pool.execute(
#         "UPDATE complaints SET citizen_rating=$1, citizen_feedback=$2, status='closed' WHERE complaint_id=$3",
#         body.rating, body.feedback, complaint_id,
#     )

#     # Update officer rating average
#     if complaint["assigned_officer_id"]:
#         await pool.execute(
#             """UPDATE officers SET
#                citizen_rating_avg = (
#                  SELECT ROUND(AVG(citizen_rating)::decimal, 3)
#                  FROM complaints
#                  WHERE assigned_officer_id=$1 AND citizen_rating IS NOT NULL
#                )
#                WHERE officer_id=$1""",
#             complaint["assigned_officer_id"],
#         )

#     return {"success": True, "rating": body.rating}


# # ─── DISPUTE ─────────────────────────────────────────────────────────────────
# @router.post("/{complaint_id}/dispute")
# async def dispute_complaint(
#     complaint_id: str,
#     body: DisputeRequest,
#     payload=Depends(require_citizen),
#     pool=Depends(get_db),
# ):
#     citizen_id = payload["sub"]

#     complaint = await pool.fetchrow(
#         "SELECT * FROM complaints WHERE complaint_id=$1 AND citizen_id=$2",
#         complaint_id, citizen_id,
#     )
#     if not complaint:
#         raise HTTPException(404, "Complaint not found or not yours")
#     if complaint["status"] not in ("resolved", "closed"):
#         raise HTTPException(400, "Can only dispute resolved/closed complaints")
#     if complaint["disputed"]:
#         raise HTTPException(400, "Already disputed")

#     # Add dispute photos to existing
#     existing_photos = complaint["photo_urls"] or []
#     all_photos = existing_photos + (body.dispute_photos or [])

#     await pool.execute(
#         """UPDATE complaints SET
#            disputed=TRUE, dispute_reason=$1, status='disputed',
#            photo_urls=$2, updated_at=NOW()
#            WHERE complaint_id=$3""",
#         body.reason, all_photos, complaint_id,
#     )

#     await pool.execute(
#         """INSERT INTO complaint_status_history
#            (complaint_id, old_status, new_status, changed_by_id, changed_by_role, note)
#            VALUES ($1,$2,'disputed',$3,'citizen',$4)""",
#         complaint_id, complaint["status"], citizen_id, f"Dispute: {body.reason}",
#     )

#     # Notify assigned officer of dispute
#     if complaint["assigned_officer_id"]:
#         from app.services.notification_service import notify_officer
#         await notify_officer(
#             pool,
#             str(complaint["assigned_officer_id"]),
#             complaint_id,
#             "dispute_opened",
#             "⚠️ Complaint Disputed",
#             f"Citizen has disputed your resolution: {body.reason}",
#         )

#     return {"success": True, "status": "disputed"}


"""
Complaints API — NagarMind
All complaint CRUD + notifications endpoints.

Routes:
  POST   /api/complaints                          → Submit complaint
  GET    /api/complaints/my                       → My complaints (citizen)
  GET    /api/complaints/officer/inbox            → Officer inbox
  GET    /api/complaints/notifications/mine       → My notifications
  POST   /api/complaints/notifications/read-all   → Mark all read
  PATCH  /api/complaints/notifications/:id/read   → Mark one read
  POST   /api/complaints/transcribe-url           → Transcribe audio (base64 or URL)
  GET    /api/complaints/:id                      → Get complaint detail
  GET    /api/complaints/:id/public               → Public tracking (no auth)
  PATCH  /api/complaints/:id/status               → Update status (officer)
  POST   /api/complaints/:id/rate                 → Rate resolution (citizen)
  POST   /api/complaints/:id/dispute              → Dispute resolution (citizen)
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app.core.config import settings
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from app.core.database import get_db
from app.middleware.auth_middleware import require_citizen, require_officer, require_any
from app.schemas.complaint_schemas import (
    ComplaintCreateRequest,
    StatusUpdateRequest,
    DisputeRequest,
    RatingRequest,
)
from app.services.complaint_pipeline import run_pipeline

router = APIRouter(tags=["complaints"])
logger = logging.getLogger(__name__)


# ─── SUBMIT COMPLAINT ─────────────────────────────────────────────────────────
@router.post("")
async def submit_complaint(
    body: ComplaintCreateRequest,
    background_tasks: BackgroundTasks,
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    citizen_id = payload["sub"]

    citizen = await pool.fetchrow(
        "SELECT ward_id FROM citizens WHERE citizen_id=$1", citizen_id
    )
    if not citizen:
        raise HTTPException(404, "Citizen not found")

    ward_id = citizen["ward_id"]

    import hashlib
    def geo_hash(lat: float, lng: float) -> str:
        return hashlib.md5(f"{round(lat,4)},{round(lng,4)}".encode()).hexdigest()[:8]

    location_hash = geo_hash(body.location_lat, body.location_lng)

    complaint_id = await pool.fetchval(
        """INSERT INTO complaints
           (citizen_id, ward_id, title, description, original_language,
            category, location_lat, location_lng, location_address,
            location_hash, photo_urls, audio_url, voice_transcript,
            status, submitted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'submitted',NOW())
           RETURNING complaint_id""",
        citizen_id, ward_id,
        body.title, body.description, body.original_language,
        body.category,
        body.location_lat, body.location_lng, body.location_address,
        location_hash,
        body.photos or [],
        body.voice_audio_url,
        body.voice_transcript,
    )

    await pool.execute(
        "UPDATE citizens SET total_complaints = total_complaints + 1 WHERE citizen_id=$1",
        citizen_id
    )

    background_tasks.add_task(run_pipeline, pool, str(complaint_id))

    return {
        "complaint_id": str(complaint_id),
        "status": "submitted",
        "message": "Complaint submitted. AI is classifying it now.",
    }


# ─── MY COMPLAINTS (Citizen) ──────────────────────────────────────────────────
@router.get("/my")
async def my_complaints(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=50),
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    offset = (page - 1) * limit
    cid = payload["sub"]

    where = "WHERE c.citizen_id=$1"
    params: list = [cid]
    if status:
        where += f" AND c.status=$2"
        params.append(status)

    rows = await pool.fetch(
        f"""SELECT c.*,
                   w.ward_name,
                   o.full_name AS officer_name,
                   EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
            FROM complaints c
            LEFT JOIN wards w ON c.ward_id = w.ward_id
            LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
            {where}
            ORDER BY c.created_at DESC
            LIMIT {limit} OFFSET {offset}""",
        *params,
    )
    total = await pool.fetchval(
        f"SELECT COUNT(*) FROM complaints c {where}", *params
    )

    return {
        "complaints": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


# ─── OFFICER INBOX ────────────────────────────────────────────────────────────
@router.get("/officer/inbox")
async def officer_inbox(
    status: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=50),
    payload=Depends(require_officer),
    pool=Depends(get_db),
):
    offset = (page - 1) * limit
    officer_id = payload["sub"]

    conditions = ["c.assigned_officer_id=$1"]
    params: list = [officer_id]

    if status:
        params.append(status)
        conditions.append(f"c.status=${len(params)}")
    if urgency:
        params.append(urgency)
        conditions.append(f"c.urgency=${len(params)}")

    where = "WHERE " + " AND ".join(conditions)

    rows = await pool.fetch(
        f"""SELECT c.*,
                   w.ward_name,
                   ci.full_name AS citizen_name,
                   ci.phone_number AS citizen_phone,
                   EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
            FROM complaints c
            LEFT JOIN wards w ON c.ward_id = w.ward_id
            LEFT JOIN citizens ci ON c.citizen_id = ci.citizen_id
            {where}
            ORDER BY
              CASE c.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
              c.sla_deadline ASC NULLS LAST,
              c.created_at DESC
            LIMIT {limit} OFFSET {offset}""",
        *params,
    )
    total = await pool.fetchval(
        f"SELECT COUNT(*) FROM complaints c {where}", *params
    )

    return {
        "complaints": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


# ─── NOTIFICATIONS — MINE ─────────────────────────────────────────────────────
@router.get("/notifications/mine")
async def my_notifications(
    payload=Depends(require_any),
    pool=Depends(get_db),
):
    user_id = payload["sub"]
    rows = await pool.fetch(
        """SELECT * FROM notifications
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 50""",
        user_id,
    )
    unread_count = sum(1 for r in rows if not r["is_read"])
    return {
        "notifications": [dict(r) for r in rows],
        "unread_count": unread_count,
    }


# ─── NOTIFICATIONS — MARK ALL READ ────────────────────────────────────────────
@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    payload=Depends(require_any),
    pool=Depends(get_db),
):
    user_id = payload["sub"]
    await pool.execute(
        "UPDATE notifications SET is_read=TRUE WHERE user_id=$1",
        user_id,
    )
    return {"success": True}


# ─── NOTIFICATIONS — MARK ONE READ ────────────────────────────────────────────
@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    payload=Depends(require_any),
    pool=Depends(get_db),
):
    user_id = payload["sub"]
    await pool.execute(
        "UPDATE notifications SET is_read=TRUE WHERE notification_id=$1 AND user_id=$2",
        notif_id, user_id,
    )
    return {"success": True}


# ─── TRANSCRIBE AUDIO ─────────────────────────────────────────────────────────
# Handles BOTH cases:
#   1. audio_url is a base64 data URI  (new flow, no R2)
#   2. audio_url is an https:// URL    (legacy, tries to download)
@router.post("/transcribe-url")
async def transcribe_audio_url(
    audio_url: str,
    language_hint: str | None = None,
    payload=Depends(require_any),
):
    """
    Transcribe audio. Accepts:
      - base64 data URI: data:audio/webm;base64,AAAA...
      - https:// URL (attempts download)
    Uses Groq Whisper (free tier, multilingual).
    """
    import base64, os, tempfile, httpx
    from groq import Groq

    #groq_key = os.getenv("GROQ_API_KEY", "")
    groq_key = settings.GROQ_API_KEY
    if not groq_key:
        raise HTTPException(500, "GROQ_API_KEY not configured on server")

    # ── Decode audio bytes ────────────────────────────────────────────────────
    audio_bytes: bytes = b""
    content_type = "audio/webm"
    ext = "webm"

    if audio_url.startswith("data:"):
        # Base64 data URI: data:audio/webm;base64,AAAA...
        try:
            header, b64data = audio_url.split(",", 1)
            # Extract mime type: data:audio/webm;base64 → audio/webm
            mime = header.split(":")[1].split(";")[0]
            content_type = mime
            ext_map = {
                "audio/webm": "webm", "audio/ogg": "ogg",
                "audio/mp4": "mp4",  "audio/wav": "wav",
                "audio/mpeg": "mp3", "audio/m4a": "m4a",
            }
            ext = ext_map.get(mime, "webm")
            audio_bytes = base64.b64decode(b64data)
        except Exception as e:
            raise HTTPException(400, f"Invalid base64 data URI: {e}")

    elif audio_url.startswith("http"):
        # Legacy URL download (may fail if R2 perms broken)
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(audio_url)
                r.raise_for_status()
                audio_bytes = r.content
        except Exception as e:
            raise HTTPException(400, f"Could not download audio from URL: {e}. "
                                     f"Use base64 data URI instead.")
    else:
        raise HTTPException(400, "audio_url must be a base64 data URI or https:// URL")

    if len(audio_bytes) < 500:
        raise HTTPException(400, "Audio too short or empty — please speak for at least 1 second")

    # ── Transcribe via Groq Whisper ───────────────────────────────────────────
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        client = Groq(api_key=groq_key)
        lang = language_hint[:2] if language_hint else None

        with open(tmp_path, "rb") as f:
            result = client.audio.transcriptions.create(
                file=(f"voice.{ext}", f, content_type),
                model="whisper-large-v3-turbo",
                language=lang,
                response_format="text",
            )

        transcript = result if isinstance(result, str) else (result.text or "")
        transcript = transcript.strip()
        logger.info(f"Transcribed: {len(transcript)} chars, lang={lang}")

        return {
            "transcript": transcript,
            "language":   language_hint,
        }

    except Exception as e:
        logger.exception(f"Groq transcription failed: {e}")
        raise HTTPException(500, f"Transcription failed: {e}")
    finally:
        os.unlink(tmp_path)


# ─── GET COMPLAINT (authenticated) ───────────────────────────────────────────
@router.get("/{complaint_id}")
async def get_complaint(
    complaint_id: str,
    payload=Depends(require_any),
    pool=Depends(get_db),
):
    user_id = payload["sub"]
    role = payload.get("role")

    row = await pool.fetchrow(
        """SELECT c.*,
                  w.ward_name,
                  o.full_name AS officer_name,
                  o.designation AS officer_designation,
                  o.phone_number AS officer_phone,
                  ci.full_name AS citizen_name,
                  EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
           FROM complaints c
           LEFT JOIN wards w ON c.ward_id = w.ward_id
           LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
           LEFT JOIN citizens ci ON c.citizen_id = ci.citizen_id
           WHERE c.complaint_id=$1""",
        complaint_id,
    )
    if not row:
        raise HTTPException(404, "Complaint not found")

    d = dict(row)

    history = await pool.fetch(
        """SELECT * FROM complaint_status_history
           WHERE complaint_id=$1
           ORDER BY created_at ASC""",
        complaint_id,
    )
    d["status_history"] = [dict(h) for h in history]

    if role == "citizen" and str(d["citizen_id"]) != str(user_id):
        raise HTTPException(403, "Access denied")

    return d


# ─── GET COMPLAINT (public) ───────────────────────────────────────────────────
@router.get("/{complaint_id}/public")
async def get_complaint_public(
    complaint_id: str,
    pool=Depends(get_db),
):
    row = await pool.fetchrow(
        """SELECT
               c.complaint_id, c.title, c.category, c.urgency, c.status,
               c.location_address, c.location_lat, c.location_lng,
               c.created_at, c.updated_at, c.resolved_at,
               c.sla_deadline, c.sla_breached, c.ai_summary,
               c.resolution_note, c.photo_urls,
               w.ward_name,
               o.full_name AS officer_name,
               o.designation AS officer_designation,
               EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
           FROM complaints c
           LEFT JOIN wards w ON c.ward_id = w.ward_id
           LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
           WHERE c.complaint_id=$1""",
        complaint_id,
    )
    if not row:
        raise HTTPException(404, "Complaint not found")

    d = dict(row)
    history = await pool.fetch(
        """SELECT old_status, new_status, note, changed_by_role, created_at
           FROM complaint_status_history
           WHERE complaint_id=$1
           ORDER BY created_at ASC""",
        complaint_id,
    )
    d["status_history"] = [dict(h) for h in history]
    return d


# ─── UPDATE STATUS (Officer/Admin) ────────────────────────────────────────────
@router.patch("/{complaint_id}/status")
async def update_complaint_status(
    complaint_id: str,
    body: StatusUpdateRequest,
    payload=Depends(require_officer),
    pool=Depends(get_db),
):
    officer_id = payload["sub"]

    complaint = await pool.fetchrow(
        "SELECT * FROM complaints WHERE complaint_id=$1", complaint_id,
    )
    if not complaint:
        raise HTTPException(404, "Complaint not found")

    old_status = complaint["status"]

    update_fields = {"status": body.status, "updated_at": datetime.now(timezone.utc)}
    if body.status == "acknowledged" and not complaint["acknowledged_at"]:
        update_fields["acknowledged_at"] = datetime.now(timezone.utc)
    if body.status == "resolved" and not complaint["resolved_at"]:
        update_fields["resolved_at"] = datetime.now(timezone.utc)
        await pool.execute(
            """UPDATE officers SET
               total_resolved = total_resolved + 1,
               sla_compliance_rate = (
                 SELECT ROUND(
                   COUNT(*) FILTER (WHERE NOT sla_breached)::decimal /
                   NULLIF(COUNT(*), 0) * 100, 2
                 )
                 FROM complaints
                 WHERE assigned_officer_id=$1
                   AND status IN ('resolved','closed')
               )
               WHERE officer_id=$1""",
            officer_id,
        )

    if body.notes:
        update_fields["resolution_note"] = body.notes

    if body.photos_added:
        existing_photos = complaint["photo_urls"] or []
        update_fields["photo_urls"] = existing_photos + body.photos_added

    set_parts = [f"{k}=${i+2}" for i, k in enumerate(update_fields.keys())]
    values = list(update_fields.values())

    await pool.execute(
        f"UPDATE complaints SET {', '.join(set_parts)} WHERE complaint_id=$1",
        complaint_id, *values,
    )

    await pool.execute(
        """INSERT INTO complaint_status_history
           (complaint_id, old_status, new_status, changed_by_id, changed_by_role, note)
           VALUES ($1,$2,$3,$4,'officer',$5)""",
        complaint_id, old_status, body.status, officer_id, body.notes,
    )

    from app.services.notification_service import notify_citizen
    citizen = await pool.fetchrow(
        "SELECT citizen_id, phone_number, preferred_language FROM citizens WHERE citizen_id=$1",
        complaint["citizen_id"],
    )
    if citizen:
        status_messages = {
            "acknowledged": "Your complaint has been acknowledged by the officer.",
            "in_progress":  f"Work has started: {body.notes or 'Officer is on-site.'}",
            "resolved":     f"Your complaint has been resolved. {body.notes or ''}",
            "closed":       "Your complaint has been closed.",
        }
        await notify_citizen(
            pool,
            str(citizen["citizen_id"]),
            citizen["phone_number"],
            complaint_id,
            f"complaint_{body.status}",
            f"Complaint {body.status.replace('_', ' ').title()}",
            status_messages.get(body.status, f"Status updated to {body.status}"),
            language=citizen["preferred_language"],
        )

    from app.services.ward_health_service import recalculate_ward_health
    await recalculate_ward_health(pool, complaint["ward_id"])

    return {"success": True, "status": body.status}


# ─── RATE COMPLAINT ───────────────────────────────────────────────────────────
@router.post("/{complaint_id}/rate")
async def rate_complaint(
    complaint_id: str,
    body: RatingRequest,
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    citizen_id = payload["sub"]

    complaint = await pool.fetchrow(
        "SELECT * FROM complaints WHERE complaint_id=$1 AND citizen_id=$2",
        complaint_id, citizen_id,
    )
    if not complaint:
        raise HTTPException(404, "Complaint not found or not yours")
    if complaint["status"] not in ("resolved", "closed"):
        raise HTTPException(400, "Can only rate resolved complaints")
    if complaint["citizen_rating"]:
        raise HTTPException(400, "Already rated")

    await pool.execute(
        "UPDATE complaints SET citizen_rating=$1, citizen_feedback=$2, status='closed' WHERE complaint_id=$3",
        body.rating, body.feedback, complaint_id,
    )

    if complaint["assigned_officer_id"]:
        await pool.execute(
            """UPDATE officers SET
               citizen_rating_avg = (
                 SELECT ROUND(AVG(citizen_rating)::decimal, 3)
                 FROM complaints
                 WHERE assigned_officer_id=$1 AND citizen_rating IS NOT NULL
               )
               WHERE officer_id=$1""",
            complaint["assigned_officer_id"],
        )

    return {"success": True, "rating": body.rating}


# ─── DISPUTE ─────────────────────────────────────────────────────────────────
@router.post("/{complaint_id}/dispute")
async def dispute_complaint(
    complaint_id: str,
    body: DisputeRequest,
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    citizen_id = payload["sub"]

    complaint = await pool.fetchrow(
        "SELECT * FROM complaints WHERE complaint_id=$1 AND citizen_id=$2",
        complaint_id, citizen_id,
    )
    if not complaint:
        raise HTTPException(404, "Complaint not found or not yours")
    if complaint["status"] not in ("resolved", "closed"):
        raise HTTPException(400, "Can only dispute resolved/closed complaints")
    if complaint["disputed"]:
        raise HTTPException(400, "Already disputed")

    existing_photos = complaint["photo_urls"] or []
    all_photos = existing_photos + (body.dispute_photos or [])

    await pool.execute(
        """UPDATE complaints SET
           disputed=TRUE, dispute_reason=$1, status='disputed',
           photo_urls=$2, updated_at=NOW()
           WHERE complaint_id=$3""",
        body.reason, all_photos, complaint_id,
    )

    await pool.execute(
        """INSERT INTO complaint_status_history
           (complaint_id, old_status, new_status, changed_by_id, changed_by_role, note)
           VALUES ($1,$2,'disputed',$3,'citizen',$4)""",
        complaint_id, complaint["status"], citizen_id, f"Dispute: {body.reason}",
    )

    if complaint["assigned_officer_id"]:
        from app.services.notification_service import notify_officer
        await notify_officer(
            pool,
            str(complaint["assigned_officer_id"]),
            complaint_id,
            "dispute_opened",
            "⚠️ Complaint Disputed",
            f"Citizen has disputed your resolution: {body.reason}",
        )

    return {"success": True, "status": "disputed"}