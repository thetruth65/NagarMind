"""
Complaint AI Pipeline: classify → summarize → assign → notify.
Runs as background task after submission.
"""
import logging
import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.services.gemini_service import classify_complaint, generate_officer_summary, translate_with_gemini
from app.services.groq_service import classify_with_groq as classify_complaint
from app.services.groq_service import summarize_with_groq as generate_officer_summary
from app.services.sarvam_service import translate_single
from app.services.notification_service import notify_citizen, notify_officer
from app.services.ward_health_service import recalculate_ward_health

logger = logging.getLogger(__name__)

SLA_TABLE = {
    "pothole":      {"critical": 24,  "high": 48,  "medium": 120, "low": 168},
    "garbage":      {"critical": 6,   "high": 12,  "medium": 24,  "low": 48},
    "sewage":       {"critical": 12,  "high": 24,  "medium": 72,  "low": 120},
    "water_supply": {"critical": 6,   "high": 12,  "medium": 48,  "low": 96},
    "streetlight":  {"critical": 24,  "high": 48,  "medium": 120, "low": 240},
    "tree":         {"critical": 12,  "high": 48,  "medium": 168, "low": 336},
    "stray_animals":{"critical": 24,  "high": 72,  "medium": 168, "low": 336},
    "encroachment": {"critical": 48,  "high": 96,  "medium": 168, "low": 336},
    "noise":        {"critical": 12,  "high": 48,  "medium": 120, "low": 240},
    "other":        {"critical": 48,  "high": 72,  "medium": 168, "low": 336},
}


def geo_hash(lat: float, lng: float, precision: int = 4) -> str:
    """Simple geohash for clustering nearby complaints."""
    return f"{round(lat, precision)}_{round(lng, precision)}"


async def run_pipeline(pool, complaint_id: str):
    """Full AI pipeline for a submitted complaint."""
    try:
        # Fetch complaint
        complaint = await pool.fetchrow(
            """SELECT c.*, ci.phone_number, ci.full_name AS citizen_name,
                      ci.preferred_language, w.ward_name
               FROM complaints c
               JOIN citizens ci ON c.citizen_id = ci.citizen_id
               JOIN wards w ON c.ward_id = w.ward_id
               WHERE c.complaint_id = $1""",
            complaint_id,
        )
        if not complaint:
            logger.error(f"Complaint {complaint_id} not found for pipeline")
            return

        # Step 1: Translate if needed
        desc = complaint["description"]
        lang = complaint["original_language"]
        if lang != "en":
            desc = await translate_with_gemini(desc, lang, "en")
            await pool.execute(
                "UPDATE complaints SET description_translated=$1 WHERE complaint_id=$2",
                desc, complaint_id,
            )

        # Step 2: AI Classification
        cls = await classify_complaint(
            title=complaint["title"],
            description=desc,
            ward_name=complaint["ward_name"],
            photo_count=len(complaint["photo_urls"] or []),
        )

        # Step 3: SLA hours
        urgency = cls.get("urgency", "medium")
        category = cls.get("category", "other")
        sla_hours = SLA_TABLE.get(category, SLA_TABLE["other"]).get(urgency, 120)

        # Step 4: AI officer summary
        summary = await generate_officer_summary(
            title=complaint["title"],
            description=desc,
            category=category,
            urgency=urgency,
            address=complaint["location_address"] or "",
            ward_name=complaint["ward_name"],
        )

        # Step 5: Update complaint with classification
        await pool.execute(
            """UPDATE complaints SET
               category=$1, sub_category=$2, department=$3, urgency=$4,
               ai_summary=$5, ai_category_confidence=$6, sla_hours=$7, status='ai_classified',
               updated_at=NOW()
               WHERE complaint_id=$8""",
            category, cls.get("sub_category"), cls.get("department"),
            urgency, summary, cls.get("confidence", 0.8),
            sla_hours, complaint_id,
        )

        # Log AI call
        import json
        await pool.execute(
            """INSERT INTO ai_classification_logs
               (complaint_id, raw_response)
               VALUES ($1, $2)""",
            complaint_id, json.dumps({
                "model": "gemini-1.5-flash",
                "category": category,
                "urgency": urgency,
                "confidence": cls.get("confidence", 0.8),
                "summary": summary[:200]
            }),
        )

        # Step 6: Auto-assign best available officer
        officer = await pool.fetchrow(
            """SELECT o.officer_id, o.full_name, o.phone_number
               FROM officers o
               WHERE o.ward_id = $1
                 AND o.is_active = TRUE
                 AND (o.department = $2 OR o.department LIKE '%General%')
               ORDER BY o.total_assigned ASC
               LIMIT 1""",
            complaint["ward_id"], cls.get("department", ""),
        )

        # FIX: initialise sla_deadline to None so it's always defined
        # even when no officer is found — used later in notify_citizen call
        sla_deadline = None

        if officer:
            sla_deadline = datetime.now(timezone.utc) + timedelta(hours=sla_hours)
            await pool.execute(
                """UPDATE complaints SET
                   assigned_officer_id=$1, assigned_at=NOW(),
                   sla_deadline=$2, status='assigned', updated_at=NOW()
                   WHERE complaint_id=$3""",
                officer["officer_id"], sla_deadline, complaint_id,
            )
            # Increment officer total_assigned
            await pool.execute(
                "UPDATE officers SET total_assigned = total_assigned + 1 WHERE officer_id = $1",
                officer["officer_id"],
            )
            # Status history
            await pool.execute(
                """INSERT INTO complaint_status_history
                   (complaint_id, old_status, new_status, changed_by_id, changed_by_role, note)
                   VALUES ($1,'ai_classified','assigned',$2,'system',$3)""",
                complaint_id, officer["officer_id"], f"Auto-assigned to {officer['full_name']}",
            )
            # Notify officer
            await notify_officer(
                pool, str(officer["officer_id"]), complaint_id,
                "new_assignment",
                f"New {urgency.upper()} complaint assigned",
                f"{category.title()}: {complaint['title']} — SLA: {sla_hours}h",
            )

        # Step 7: Notify citizen
        # FIX: sla_deadline is now always defined (None when no officer found)
        deadline_str = sla_deadline.strftime('%d %b, %I:%M %p') if sla_deadline else ""
        deadline_sms = sla_deadline.strftime("%d %b %I:%M%p") if sla_deadline else ""

        await notify_citizen(
            pool,
            str(complaint["citizen_id"]),
            complaint["phone_number"],
            complaint_id,
            "complaint_assigned" if officer else "complaint_submitted",
            "Complaint Received & Classified",
            f"Your complaint has been classified as {category.replace('_',' ').title()} "
            + (f"and assigned to an officer. Expected by {deadline_str}." if officer else ""),
            language=lang,
            sms_data={"sla_deadline": deadline_sms},
        )

        # Step 8: Recalculate ward health
        await recalculate_ward_health(pool, complaint["ward_id"])

        logger.info(f"Pipeline complete for {complaint_id}: {category}/{urgency}, SLA={sla_hours}h")

    except Exception as e:
        logger.error(f"Pipeline failed for {complaint_id}: {e}", exc_info=True)
        await pool.execute(
            "UPDATE complaints SET status='submitted' WHERE complaint_id=$1",
            complaint_id,
        )