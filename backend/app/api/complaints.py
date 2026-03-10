# """
# Complaints API — NagarMind
# All complaint CRUD + notifications endpoints.

# Routes:
#   POST   /api/complaints                          → Submit complaint
#   GET    /api/complaints/my                       → My complaints (citizen)
#   GET    /api/complaints/officer/inbox            → Officer inbox
#   GET    /api/complaints/notifications/mine       → My notifications
#   POST   /api/complaints/notifications/read-all   → Mark all read
#   PATCH  /api/complaints/notifications/:id/read   → Mark one read
#   POST   /api/complaints/transcribe-url           → Transcribe audio (base64 or URL)
#   GET    /api/complaints/:id                      → Get complaint detail
#   GET    /api/complaints/:id/public               → Public tracking (no auth)
#   PATCH  /api/complaints/:id/status               → Update status (officer)
#   POST   /api/complaints/:id/rate                 → Rate resolution (citizen)
#   POST   /api/complaints/:id/dispute              → Dispute resolution (citizen)
# """

# import logging
# from datetime import datetime, timezone
# from typing import Optional

# from app.core.config import settings
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

#     citizen = await pool.fetchrow(
#         "SELECT ward_id FROM citizens WHERE citizen_id=$1", citizen_id
#     )
#     if not citizen:
#         raise HTTPException(404, "Citizen not found")

#     ward_id = citizen["ward_id"]

#     complaint_id = await pool.fetchval(
#         """INSERT INTO complaints
#            (citizen_id, ward_id, title, description,
#             category, latitude, longitude, address,
#             photo_urls, voice_transcript,
#             status, submitted_at)
#            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'submitted',NOW())
#            RETURNING complaint_id""",
#         citizen_id, ward_id,
#         body.title, body.description,
#         body.category,
#         body.location_lat, body.location_lng, body.location_address,
#         body.photos or [],
#         body.voice_transcript,
#     )

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
#     limit: int = Query(20, le=200),
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
#                    o.name AS officer_name,
#                    EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
#             FROM complaints c
#             LEFT JOIN wards w ON c.ward_id = w.ward_id
#             LEFT JOIN officers o ON c.officer_id = o.officer_id
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
#     limit: int = Query(20, le=200),
#     payload=Depends(require_officer),
#     pool=Depends(get_db),
# ):
#     offset = (page - 1) * limit
#     officer_id = payload["sub"]

#     conditions = ["c.officer_id=$1"]
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
#                    ci.name AS citizen_name,
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
# @router.get("/notifications/mine")
# async def my_notifications(
#     payload=Depends(require_any),
#     pool=Depends(get_db),
# ):
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


# # ─── TRANSCRIBE AUDIO ─────────────────────────────────────────────────────────
# @router.post("/transcribe-url")
# async def transcribe_audio_url(
#     audio_url: str,
#     language_hint: str | None = None,
#     payload=Depends(require_any),
# ):
#     """
#     Transcribe audio. Accepts:
#       - base64 data URI: data:audio/webm;base64,AAAA...
#       - https:// URL (attempts download)
#     Uses Groq Whisper (free tier, multilingual).
#     """
#     import base64, os, tempfile, httpx
#     from groq import Groq

#     groq_key = settings.GROQ_API_KEY
#     if not groq_key:
#         raise HTTPException(500, "GROQ_API_KEY not configured on server")

#     audio_bytes: bytes = b""
#     content_type = "audio/webm"
#     ext = "webm"

#     if audio_url.startswith("data:"):
#         try:
#             header, b64data = audio_url.split(",", 1)
#             mime = header.split(":")[1].split(";")[0]
#             content_type = mime
#             ext_map = {
#                 "audio/webm": "webm", "audio/ogg": "ogg",
#                 "audio/mp4": "mp4",  "audio/wav": "wav",
#                 "audio/mpeg": "mp3", "audio/m4a": "m4a",
#             }
#             ext = ext_map.get(mime, "webm")
#             audio_bytes = base64.b64decode(b64data)
#         except Exception as e:
#             raise HTTPException(400, f"Invalid base64 data URI: {e}")

#     elif audio_url.startswith("http"):
#         try:
#             async with httpx.AsyncClient(timeout=20) as client:
#                 r = await client.get(audio_url)
#                 r.raise_for_status()
#                 audio_bytes = r.content
#         except Exception as e:
#             raise HTTPException(400, f"Could not download audio from URL: {e}. "
#                                      f"Use base64 data URI instead.")
#     else:
#         raise HTTPException(400, "audio_url must be a base64 data URI or https:// URL")

#     if len(audio_bytes) < 500:
#         raise HTTPException(400, "Audio too short or empty — please speak for at least 1 second")

#     with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
#         tmp.write(audio_bytes)
#         tmp_path = tmp.name

#     try:
#         client = Groq(api_key=groq_key)
#         lang = language_hint[:2] if language_hint else None

#         with open(tmp_path, "rb") as f:
#             result = client.audio.transcriptions.create(
#                 file=(f"voice.{ext}", f, content_type),
#                 model="whisper-large-v3",
#                 language=lang,
#                 response_format="text",
#             )

#         transcript = result if isinstance(result, str) else (result.text or "")
#         transcript = transcript.strip()
#         logger.info(f"Transcribed: {len(transcript)} chars, lang={lang}")

#         return {
#             "transcript": transcript,
#             "language":   language_hint,
#         }

#     except Exception as e:
#         logger.exception(f"Groq transcription failed: {e}")
#         raise HTTPException(500, f"Transcription failed: {e}")
#     finally:
#         os.unlink(tmp_path)


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
#                   o.name AS officer_name,
#                   o.designation AS officer_designation,
#                   o.phone_number AS officer_phone,
#                   ci.name AS citizen_name,
#                   EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
#            FROM complaints c
#            LEFT JOIN wards w ON c.ward_id = w.ward_id
#            LEFT JOIN officers o ON c.officer_id = o.officer_id
#            LEFT JOIN citizens ci ON c.citizen_id = ci.citizen_id
#            WHERE c.complaint_id=$1""",
#         complaint_id,
#     )
#     if not row:
#         raise HTTPException(404, "Complaint not found")

#     d = dict(row)

#     history = await pool.fetch(
#         """SELECT * FROM complaint_status_history
#            WHERE complaint_id=$1
#            ORDER BY created_at ASC""",
#         complaint_id,
#     )
#     d["status_history"] = [dict(h) for h in history]

#     if role == "citizen" and str(d["citizen_id"]) != str(user_id):
#         raise HTTPException(403, "Access denied")

#     return d


# # ─── GET COMPLAINT (public) ───────────────────────────────────────────────────
# @router.get("/{complaint_id}/public")
# async def get_complaint_public(
#     complaint_id: str,
#     pool=Depends(get_db),
# ):
#     row = await pool.fetchrow(
#         """SELECT
#                c.complaint_id, c.title, c.category, c.urgency, c.status,
#                c.address, c.latitude, c.longitude,
#                c.created_at, c.updated_at, c.resolved_at,
#                c.sla_deadline, c.sla_breached, c.ai_summary,
#                c.resolution_note, c.photo_urls,
#                w.ward_name,
#                o.name AS officer_name,
#                o.designation AS officer_designation,
#                EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
#            FROM complaints c
#            LEFT JOIN wards w ON c.ward_id = w.ward_id
#            LEFT JOIN officers o ON c.officer_id = o.officer_id
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
#         "SELECT * FROM complaints WHERE complaint_id=$1", complaint_id,
#     )
#     if not complaint:
#         raise HTTPException(404, "Complaint not found")

#     old_status = complaint["status"]

#     update_fields = {"status": body.status, "updated_at": datetime.now(timezone.utc)}
#     # NOTE: acknowledged_at and disputed columns removed in v7 — skip those updates
#     if body.status == "resolved" and not complaint["resolved_at"]:
#         update_fields["resolved_at"] = datetime.now(timezone.utc)

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

#     await pool.execute(
#         """INSERT INTO complaint_status_history
#            (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
#            VALUES ($1,$2,$3,$4,'officer',$5)""",
#         complaint_id, old_status, body.status, officer_id, body.notes,
#     )

#     from app.services.notification_service import notify_citizen
#     citizen = await pool.fetchrow(
#         "SELECT citizen_id, phone_number FROM citizens WHERE citizen_id=$1",
#         complaint["citizen_id"],
#     )
#     if citizen:
#         status_messages = {
#             "acknowledged": "Your complaint has been acknowledged by the officer.",
#             "in_progress":  f"Work has started: {body.notes or 'Officer is on-site.'}",
#             "resolved":     f"Your complaint has been resolved. {body.notes or ''}",
#             "closed":       "Your complaint has been closed.",
#         }
#         await notify_citizen(
#             pool,
#             str(citizen["citizen_id"]),
#             citizen["phone_number"],
#             complaint_id,
#             f"complaint_{body.status}",
#             f"Complaint {body.status.replace('_', ' ').title()}",
#             status_messages.get(body.status, f"Status updated to {body.status}"),
#             language="en",
#         )

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

#     # officer citizen_rating_avg is computed live — no stored column to update
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

#     existing_photos = complaint["photo_urls"] or []
#     all_photos = existing_photos + (body.dispute_photos or [])

#     await pool.execute(
#         """UPDATE complaints SET
#            status='disputed', resolution_note=$1,
#            photo_urls=$2, updated_at=NOW()
#            WHERE complaint_id=$3""",
#         f"Disputed: {body.reason}", all_photos, complaint_id,
#     )

#     await pool.execute(
#         """INSERT INTO complaint_status_history
#            (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
#            VALUES ($1,$2,'disputed',$3,'citizen',$4)""",
#         complaint_id, complaint["status"], citizen_id, f"Dispute: {body.reason}",
#     )

#     if complaint["officer_id"]:
#         from app.services.notification_service import notify_officer
#         await notify_officer(
#             pool,
#             str(complaint["officer_id"]),
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
  POST   /api/complaints/transcribe-url           → Transcribe audio
  GET    /api/complaints/:id                      → Get complaint detail
  GET    /api/complaints/:id/public               → Public tracking (no auth)
  PATCH  /api/complaints/:id/status               → Update status (officer)
  POST   /api/complaints/:id/assign               → Officer self-assigns a complaint
  POST   /api/complaints/:id/rate                 → Rate resolution (citizen)
  POST   /api/complaints/:id/dispute              → Dispute resolution (citizen)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

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

    complaint_id = await pool.fetchval(
        """INSERT INTO complaints
           (citizen_id, ward_id, title, description,
            category, latitude, longitude, address,
            photo_urls, voice_transcript,
            status, submitted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'submitted',NOW())
           RETURNING complaint_id""",
        citizen_id, ward_id,
        body.title, body.description,
        body.category,
        body.location_lat, body.location_lng, body.location_address,
        body.photos or [],
        body.voice_transcript,
    )

    # Insert initial status history
    await pool.execute(
        """INSERT INTO complaint_status_history
           (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
           VALUES ($1, NULL, 'submitted', $2, 'citizen', 'Complaint submitted by citizen')""",
        str(complaint_id), citizen_id,
    )

    # Notify citizen immediately that submission was received
    from app.services.notification_service import notify_citizen as _notify_citizen
    citizen_row = await pool.fetchrow(
        "SELECT phone_number FROM citizens WHERE citizen_id=$1", citizen_id
    )
    if citizen_row:
        await _notify_citizen(
            pool,
            str(citizen_id),
            citizen_row["phone_number"],
            str(complaint_id),
            "complaint_submitted",
            "Complaint Submitted ✓",
            f"Your complaint '{body.title}' has been received. We will classify and assign it shortly.",
            language="en",
            send_sms=True,
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
    limit: int = Query(20, le=200),
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
                   w.zone AS ward_zone,
                   o.name AS officer_name,
                   o.email AS officer_email,
                   o.phone_number AS officer_phone,
                   o.designation AS officer_designation,
                   EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
            FROM complaints c
            LEFT JOIN wards w ON c.ward_id = w.ward_id
            LEFT JOIN officers o ON c.officer_id = o.officer_id
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
    limit: int = Query(20, le=200),
    payload=Depends(require_officer),
    pool=Depends(get_db),
):
    offset = (page - 1) * limit
    officer_id = payload["sub"]

    # Get officer's ward_id to also show unassigned complaints in the ward
    officer_row = await pool.fetchrow(
        "SELECT ward_id FROM officers WHERE officer_id=$1", officer_id
    )
    ward_id = officer_row["ward_id"] if officer_row else None

    # Complaints assigned to this officer
    conditions = ["c.officer_id=$1"]
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
                   w.zone AS ward_zone,
                   ci.name AS citizen_name,
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

    # Also fetch unassigned complaints in the officer's ward (so officer can self-assign)
    unassigned = []
    if ward_id and not status:
        unassigned_rows = await pool.fetch(
            """SELECT c.*,
                      w.ward_name, w.zone AS ward_zone,
                      ci.name AS citizen_name, ci.phone_number AS citizen_phone,
                      EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
               FROM complaints c
               LEFT JOIN wards w ON c.ward_id = w.ward_id
               LEFT JOIN citizens ci ON c.citizen_id = ci.citizen_id
               WHERE c.ward_id=$1
                 AND c.officer_id IS NULL
                 AND c.status IN ('submitted','ai_classified')
               ORDER BY
                 CASE c.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
                 c.created_at DESC
               LIMIT 20""",
            ward_id,
        )
        unassigned = [dict(r) for r in unassigned_rows]

    return {
        "complaints": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "unassigned_in_ward": unassigned,
    }


# ─── OFFICER SELF-ASSIGN ──────────────────────────────────────────────────────
@router.post("/{complaint_id}/assign")
async def officer_self_assign(
    complaint_id: str,
    payload=Depends(require_officer),
    pool=Depends(get_db),
):
    """Officer explicitly picks up an unassigned complaint from their ward."""
    officer_id = payload["sub"]

    complaint = await pool.fetchrow(
        "SELECT * FROM complaints WHERE complaint_id=$1", complaint_id
    )
    if not complaint:
        raise HTTPException(404, "Complaint not found")

    # Verify officer's ward matches
    officer = await pool.fetchrow(
        "SELECT ward_id, name, email, phone_number, designation FROM officers WHERE officer_id=$1",
        officer_id
    )
    if not officer:
        raise HTTPException(404, "Officer not found")

    if complaint["ward_id"] != officer["ward_id"]:
        raise HTTPException(403, "This complaint is not in your ward")

    if complaint["officer_id"]:
        raise HTTPException(400, "Complaint already assigned to another officer")

    from datetime import timedelta
    from app.services.complaint_pipeline import SLA_TABLE
    category   = complaint["category"] or "other"
    urgency    = complaint["urgency"] or "medium"
    sla_hours  = complaint["sla_hours"] or SLA_TABLE.get(category, SLA_TABLE["other"]).get(urgency, 72)
    sla_deadline = datetime.now(timezone.utc) + timedelta(hours=sla_hours)

    old_status = complaint["status"]

    await pool.execute(
        """UPDATE complaints SET
           officer_id=$1, sla_deadline=$2, status='assigned', updated_at=NOW()
           WHERE complaint_id=$3""",
        officer_id, sla_deadline, complaint_id,
    )

    await pool.execute(
        """INSERT INTO complaint_status_history
           (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
           VALUES ($1,$2,'assigned',$3,'officer','Officer self-assigned this complaint')""",
        complaint_id, old_status, officer_id,
    )

    # Notify officer of assignment
    from app.services.notification_service import notify_officer, notify_citizen
    await notify_officer(
        pool, str(officer_id), complaint_id,
        "self_assigned",
        "✅ You have taken up this complaint",
        f"SLA: {sla_hours}h — Deadline: {sla_deadline.strftime('%d %b %I:%M %p')}. Category: {category}.",
    )

    # Notify citizen that an officer has been assigned
    citizen = await pool.fetchrow(
        "SELECT citizen_id, phone_number FROM citizens WHERE citizen_id=$1",
        complaint["citizen_id"],
    )
    if citizen:
        await notify_citizen(
            pool,
            str(citizen["citizen_id"]),
            citizen["phone_number"],
            complaint_id,
            "complaint_assigned",
            "Officer Assigned 👷",
            f"An officer ({officer['name']}) has been assigned to your complaint. "
            f"Expected resolution by {sla_deadline.strftime('%d %b, %I:%M %p')}.",
            language="en",
            send_sms=True,
            sms_data={"sla_deadline": sla_deadline.strftime("%d %b %I:%M%p")},
        )

    return {
        "success": True,
        "officer_name": officer["name"],
        "sla_deadline": sla_deadline.isoformat(),
        "sla_hours": sla_hours,
    }


# ─── NOTIFICATIONS — MINE ─────────────────────────────────────────────────────
@router.get("/notifications/mine")
async def my_notifications(
    payload=Depends(require_any),
    pool=Depends(get_db),
):
    user_id = payload["sub"]
    rows = await pool.fetch(
        """SELECT n.*,
                  c.title AS complaint_title,
                  c.category AS complaint_category,
                  c.status AS complaint_status
           FROM notifications n
           LEFT JOIN complaints c ON n.complaint_id = c.complaint_id
           WHERE n.user_id = $1
           ORDER BY n.created_at DESC
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
@router.post("/transcribe-url")
async def transcribe_audio_url(
    audio_url: str,
    language_hint: str | None = None,
    payload=Depends(require_any),
):
    import base64, os, tempfile, httpx
    from groq import Groq

    groq_key = settings.GROQ_API_KEY
    if not groq_key:
        raise HTTPException(500, "GROQ_API_KEY not configured on server")

    audio_bytes: bytes = b""
    content_type = "audio/webm"
    ext = "webm"

    if audio_url.startswith("data:"):
        try:
            header, b64data = audio_url.split(",", 1)
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
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(audio_url)
                r.raise_for_status()
                audio_bytes = r.content
        except Exception as e:
            raise HTTPException(400, f"Could not download audio: {e}")
    else:
        raise HTTPException(400, "audio_url must be a base64 data URI or https:// URL")

    if len(audio_bytes) < 500:
        raise HTTPException(400, "Audio too short")

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        client = Groq(api_key=groq_key)
        lang = language_hint[:2] if language_hint else None
        with open(tmp_path, "rb") as f:
            result = client.audio.transcriptions.create(
                file=(f"voice.{ext}", f, content_type),
                model="whisper-large-v3",
                language=lang,
                response_format="text",
            )
        transcript = result if isinstance(result, str) else (result.text or "")
        return {"transcript": transcript.strip(), "language": language_hint}
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
                  w.zone AS ward_zone,
                  o.name AS officer_name,
                  o.designation AS officer_designation,
                  o.phone_number AS officer_phone,
                  o.email AS officer_email,
                  ci.name AS citizen_name,
                  EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
           FROM complaints c
           LEFT JOIN wards w ON c.ward_id = w.ward_id
           LEFT JOIN officers o ON c.officer_id = o.officer_id
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
               c.address, c.latitude, c.longitude,
               c.created_at, c.updated_at, c.resolved_at, c.submitted_at,
               c.sla_deadline, c.sla_breached, c.ai_summary,
               c.resolution_note, c.photo_urls,
               c.citizen_rating,
               c.ward_id,
               w.ward_name,
               w.zone AS ward_zone,
               o.name AS officer_name,
               o.designation AS officer_designation,
               o.phone_number AS officer_phone,
               o.email AS officer_email,
               EXTRACT(EPOCH FROM (c.sla_deadline - NOW())) AS sla_remaining_seconds
           FROM complaints c
           LEFT JOIN wards w ON c.ward_id = w.ward_id
           LEFT JOIN officers o ON c.officer_id = o.officer_id
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
    if body.status == "resolved" and not complaint["resolved_at"]:
        update_fields["resolved_at"] = datetime.now(timezone.utc)

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
           (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
           VALUES ($1,$2,$3,$4,'officer',$5)""",
        complaint_id, old_status, body.status, officer_id, body.notes,
    )

    # Notify citizen + officer of status change
    from app.services.notification_service import notify_citizen, notify_officer
    citizen = await pool.fetchrow(
        "SELECT citizen_id, phone_number FROM citizens WHERE citizen_id=$1",
        complaint["citizen_id"],
    )

    status_messages = {
        "acknowledged": "Your complaint has been acknowledged by the officer.",
        "in_progress":  f"Work has started on your complaint. {body.notes or 'Officer is on-site.'}",
        "resolved":     f"Your complaint has been resolved. {body.notes or ''} Please verify and rate.",
        "closed":       "Your complaint has been closed. Thank you for using NagarMind.",
    }

    status_titles = {
        "acknowledged": "Complaint Acknowledged 📋",
        "in_progress":  "Work Started 🔧",
        "resolved":     "Complaint Resolved ✅ — Please Rate",
        "closed":       "Complaint Closed 🎉",
    }

    if citizen:
        await notify_citizen(
            pool,
            str(citizen["citizen_id"]),
            citizen["phone_number"],
            complaint_id,
            f"complaint_{body.status}",
            status_titles.get(body.status, f"Status: {body.status.replace('_', ' ').title()}"),
            status_messages.get(body.status, f"Status updated to {body.status}"),
            language="en",
        )

    # Notify officer of their own status update (confirmation)
    if body.status == "resolved":
        await notify_officer(
            pool, str(officer_id), complaint_id,
            "complaint_resolved",
            "✅ Resolution Submitted",
            f"Complaint marked resolved. Waiting for citizen verification. {body.notes or ''}",
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
        "UPDATE complaints SET citizen_rating=$1, citizen_feedback=$2, status='closed', updated_at=NOW() WHERE complaint_id=$3",
        body.rating, body.feedback, complaint_id,
    )

    # Add status history entry for close
    await pool.execute(
        """INSERT INTO complaint_status_history
           (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
           VALUES ($1,'resolved','closed',$2,'citizen','Citizen rated and closed the complaint')""",
        complaint_id, citizen_id,
    )

    # Notify officer that citizen verified the resolution
    if complaint["officer_id"]:
        stars = "⭐" * body.rating
        from app.services.notification_service import notify_officer
        await notify_officer(
            pool, str(complaint["officer_id"]), complaint_id,
            "complaint_rated",
            f"Complaint Rated {stars}",
            f"Citizen gave {body.rating}/5 stars. "
            + (f'Feedback: "{body.feedback}"' if body.feedback else "Complaint fully closed."),
        )

    # Notify citizen of closure
    citizen = await pool.fetchrow(
        "SELECT phone_number FROM citizens WHERE citizen_id=$1", citizen_id
    )
    if citizen:
        from app.services.notification_service import notify_citizen
        await notify_citizen(
            pool, str(citizen_id), citizen["phone_number"],
            complaint_id,
            "complaint_closed",
            "Complaint Closed 🎉",
            f"Thank you for rating! Your complaint is now fully closed.",
            language="en",
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

    existing_photos = complaint["photo_urls"] or []
    all_photos = existing_photos + (body.dispute_photos or [])

    await pool.execute(
        """UPDATE complaints SET
           status='disputed', resolution_note=$1,
           photo_urls=$2, updated_at=NOW()
           WHERE complaint_id=$3""",
        f"Disputed: {body.reason}", all_photos, complaint_id,
    )

    await pool.execute(
        """INSERT INTO complaint_status_history
           (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
           VALUES ($1,$2,'disputed',$3,'citizen',$4)""",
        complaint_id, complaint["status"], citizen_id, f"Dispute: {body.reason}",
    )

    if complaint["officer_id"]:
        from app.services.notification_service import notify_officer
        await notify_officer(
            pool,
            str(complaint["officer_id"]),
            complaint_id,
            "dispute_opened",
            "⚠️ Complaint Disputed",
            f"Citizen has disputed your resolution: {body.reason}",
        )

    return {"success": True, "status": "disputed"}
