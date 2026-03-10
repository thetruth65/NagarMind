"""SLA breach checker — runs every 15 minutes via scheduler."""
import logging
from datetime import datetime, timezone
from app.services.notification_service import notify_citizen, notify_officer

logger = logging.getLogger(__name__)


async def check_sla_breaches(pool):
    # 1. Find approaching SLA (< 2 hours left) — notify assigned officer
    # v7: assigned_officer_id → officer_id
    approaching = await pool.fetch(
        """SELECT c.complaint_id, c.title, c.officer_id,
                  ci.phone_number, ci.citizen_id, c.sla_deadline
           FROM complaints c
           JOIN citizens ci ON c.citizen_id = ci.citizen_id
           WHERE c.status NOT IN ('resolved', 'closed')
             AND c.sla_deadline BETWEEN NOW() AND NOW() + INTERVAL '2 hours'
             AND c.sla_breached = FALSE
             AND c.officer_id IS NOT NULL""",
    )
    for c in approaching:
        await notify_officer(
            pool, str(c["officer_id"]), str(c["complaint_id"]),
            "sla_warning", "⚠️ SLA Approaching",
            f"Complaint '{c['title']}' SLA expires in under 2 hours.",
        )

    # 2. Find freshly breached complaints — mark and notify both parties
    # v7: assigned_officer_id → officer_id, removed preferred_language + sla_breach_notified
    breached = await pool.fetch(
        """SELECT c.complaint_id, c.title, c.officer_id, c.citizen_id,
                  ci.phone_number
           FROM complaints c
           JOIN citizens ci ON c.citizen_id = ci.citizen_id
           WHERE c.status NOT IN ('resolved', 'closed')
             AND c.sla_deadline < NOW()
             AND c.sla_breached = FALSE""",
    )
    for c in breached:
        await pool.execute(
            "UPDATE complaints SET sla_breached=TRUE, updated_at=NOW() WHERE complaint_id=$1",
            c["complaint_id"],
        )
        if c["officer_id"]:
            await notify_officer(
                pool, str(c["officer_id"]), str(c["complaint_id"]),
                "sla_breach", "🚨 SLA BREACHED",
                f"Complaint '{c['title']}' has exceeded its SLA deadline. Supervisor notified.",
            )
        await notify_citizen(
            pool, str(c["citizen_id"]), c["phone_number"], str(c["complaint_id"]),
            "sla_breach", "Complaint Delayed",
            "Your complaint has exceeded the expected resolution time. We've escalated it to a supervisor.",
            language="en",  # v7: no preferred_language column — default to en
            send_sms=True,
        )

    if approaching or breached:
        logger.info(f"SLA check: {len(approaching)} approaching, {len(breached)} newly breached")