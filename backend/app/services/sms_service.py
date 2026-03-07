"""
SMS Service using Fast2SMS (Indian numbers, free ₹50 credits on signup).
Falls back to console log in development mode.
"""
import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


async def send_otp_sms(phone: str, otp: str, language: str = "en") -> bool:
    """
    Send OTP via SMS. Phone must be 10 digits (without +91).
    Returns True if sent, False if failed.
    """
    # Strip +91 prefix for Fast2SMS
    digits = phone.replace("+91", "").replace(" ", "").strip()

    # OTP message in multiple languages
    messages = {
        "en": f"Your NagarMind OTP is {otp}. Valid for {settings.OTP_EXPIRE_MINUTES} minutes. Do not share.",
        "hi": f"आपका NagarMind OTP {otp} है। {settings.OTP_EXPIRE_MINUTES} मिनट में समाप्त होगा।",
        "bn": f"আপনার NagarMind OTP হল {otp}। {settings.OTP_EXPIRE_MINUTES} মিনিটের জন্য বৈধ।",
        "ta": f"உங்கள் NagarMind OTP {otp}. {settings.OTP_EXPIRE_MINUTES} நிமிடங்களுக்கு செல்லுபடியாகும்.",
        "te": f"మీ NagarMind OTP {otp}. {settings.OTP_EXPIRE_MINUTES} నిమిషాలు చెల్లుతుంది.",
        "mr": f"तुमचा NagarMind OTP {otp} आहे. {settings.OTP_EXPIRE_MINUTES} मिनिटात कालबाह्य होईल.",
    }
    message = messages.get(language, messages["en"])

    # In development — just log it
    if settings.APP_ENV == "development" or not settings.FAST2SMS_API_KEY:
        logger.info(f"[DEV SMS] To: {phone} | OTP: {otp} | Msg: {message}")
        print(f"\n{'='*50}")
        print(f"[DEV SMS] To: {phone} | OTP = {otp}")
        print(f"{'='*50}\n")
        return True

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                FAST2SMS_URL,
                headers={"authorization": settings.FAST2SMS_API_KEY},
                json={
                    "route": "otp",
                    "variables_values": otp,
                    "numbers": digits,
                    "flash": 0,
                },
            )
            data = resp.json()
            if data.get("return"):
                logger.info(f"SMS sent to {phone}")
                return True
            else:
                logger.error(f"Fast2SMS error: {data}")
                return False
    except Exception as e:
        logger.error(f"SMS send failed: {e}")
        return False


async def send_notification_sms(phone: str, message: str) -> bool:
    """Send general notification SMS (status updates etc)."""
    digits = phone.replace("+91", "").replace(" ", "").strip()

    if settings.APP_ENV == "development" or not settings.FAST2SMS_API_KEY:
        logger.info(f"[DEV SMS] To: {phone} | {message}")
        return True

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                FAST2SMS_URL,
                headers={"authorization": settings.FAST2SMS_API_KEY},
                json={
                    "route": "dlt",
                    "message": message[:160],
                    "numbers": digits,
                    "flash": 0,
                },
            )
            return resp.json().get("return", False)
    except Exception as e:
        logger.error(f"Notification SMS failed: {e}")
        return False