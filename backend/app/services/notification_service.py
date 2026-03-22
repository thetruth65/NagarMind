"""
Notification service — in-app + SMS notifications.
Called whenever complaint status changes.
"""
import logging
from uuid import UUID, uuid4
from app.services.websocket_manager import ws_manager
from app.services.sms_service import send_notification_sms

logger = logging.getLogger(__name__)

SMS_TEMPLATES = {
    "complaint_submitted":   "NagarMind: Your complaint #{short_id} has been submitted. Track at nagarmind.vercel.app/track/{complaint_id}",
    "complaint_assigned":    "NagarMind: Complaint #{short_id} assigned to an officer. Expected resolution by {sla_deadline}.",
    "complaint_in_progress": "NagarMind: Work has started on your complaint #{short_id}. Officer update: {notes}",
    "complaint_resolved":    "NagarMind: Complaint #{short_id} marked resolved. Please rate your experience at nagarmind.vercel.app/track/{complaint_id}",
    "complaint_closed":      "NagarMind: Complaint #{short_id} closed. Thank you for using NagarMind.",
    "sla_breach":            "NagarMind ALERT: Complaint #{short_id} has exceeded SLA. Escalation initiated.",
    "dispute_opened":        "NagarMind: Your dispute for complaint #{short_id} has been received and is under review.",
    "dispute_resolved":      "NagarMind: Dispute for #{short_id} resolved. Outcome: {outcome}.",
}


async def notify_citizen(
    pool,
    citizen_id: str,
    citizen_phone: str,
    complaint_id: str,
    notif_type: str,
    title: str,
    message: str,
    language: str = "en",
    send_sms: bool = True,
    sms_data: dict = None,
):
    """Create in-app notification + send SMS + push WebSocket event."""
    notif_id = str(uuid4())

    # Store in DB — column is 'body' in schema, parameter was misnamed 'message'
    await pool.execute(
        """INSERT INTO notifications
           (notification_id, user_id, user_role, complaint_id, type, title, body)
           VALUES ($1, $2, 'citizen', $3, $4, $5, $6)""",
        notif_id, citizen_id, complaint_id, notif_type, title, message,
    )

    # WebSocket push
    await ws_manager.send_to_user(citizen_id, {
        "event":        "notification",
        "notif_id":     notif_id,
        "type":         notif_type,
        "title":        title,
        "message":      message,
        "complaint_id": complaint_id,
    })

    # SMS
    if send_sms and citizen_phone and SMS_TEMPLATES.get(notif_type):
        template = SMS_TEMPLATES[notif_type]
        short_id = str(complaint_id)[-6:].upper()
        try:
            formatted = template.format(
                short_id=short_id,
                complaint_id=complaint_id,
                **(sms_data or {}),
            )
            await send_notification_sms(citizen_phone, formatted)
        except KeyError:
            # Template has placeholders not supplied — skip SMS silently
            logger.warning(f"SMS template missing keys for type={notif_type}, skipping SMS")


async def notify_officer(
    pool,
    officer_id: str,
    complaint_id: str,
    notif_type: str,
    title: str,
    message: str,
):
    """Notify an officer of new assignment or SLA breach."""
    notif_id = str(uuid4())

    await pool.execute(
        """INSERT INTO notifications
           (notification_id, user_id, user_role, complaint_id, type, title, body)
           VALUES ($1, $2, 'officer', $3, $4, $5, $6)""",
        notif_id, officer_id, complaint_id, notif_type, title, message,
    )

    await ws_manager.send_to_user(str(officer_id), {
        "event":        "notification",
        "notif_id":     notif_id,
        "type":         notif_type,
        "title":        title,
        "message":      message,
        "complaint_id": complaint_id,
    })


async def get_unread_count(pool, user_id: str) -> int:
    return await pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE",
        user_id,
    )


async def mark_all_read(pool, user_id: str):
    await pool.execute(
        "UPDATE notifications SET is_read=TRUE WHERE user_id=$1",
        user_id,
    )