# """
# NagarMind Auth API
# - POST /api/auth/send-otp       → Send OTP (returns otp_preview in dev mode)
# - POST /api/auth/verify-otp     → Verify OTP → returns token + user existence
# - POST /api/auth/register/citizen → Complete citizen registration
# - POST /api/auth/register/officer → Complete officer registration
# - POST /api/auth/officer/login   → Officer/Admin password login
# - POST /api/auth/admin/login     → Admin login (separate admins table)
# - POST /api/auth/admin/register  → Register new admin (secret URL)
# - GET  /api/auth/me             → Get current user profile
# - POST /api/auth/refresh-otp    → Resend OTP
# """
# import logging
# from datetime import datetime, timedelta, timezone
# from typing import Optional

# from fastapi import APIRouter, Depends, HTTPException
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# from app.core.config import settings
# from app.core.database import get_db
# from app.core.security import (
#     generate_otp, hash_otp, verify_otp_hash,
#     create_token, decode_token, normalize_phone,
#     hash_password, verify_password
# )
# from app.schemas.auth_schemas import (
#     SendOTPRequest, VerifyOTPRequest,
#     CitizenLoginRequest, CitizenRegisterRequest, OfficerRegisterRequest,
#     TokenResponse, OTPResponse,
# )
# from app.services.sms_service import send_otp_sms

# router = APIRouter(tags=["auth"])
# security = HTTPBearer(auto_error=False)
# logger = logging.getLogger(__name__)

# # In-memory rate limit: {phone: {"last_sent": dt, "attempts": n}}
# _otp_rate_limit: dict = {}

# # Store OTP in memory for dev-mode response (phone → otp)
# _dev_otp_store: dict = {}


# def _check_rate_limit(phone: str):
#     now = datetime.now(timezone.utc)
#     info = _otp_rate_limit.get(phone, {})
#     last = info.get("last_sent")
#     if last:
#         elapsed = (now - last).total_seconds()
#         cooldown = settings.OTP_RESEND_COOLDOWN_SECONDS
#         if elapsed < cooldown:
#             return False, int(cooldown - elapsed)
#     return True, 0


# def _record_otp_sent(phone: str):
#     _otp_rate_limit[phone] = {"last_sent": datetime.now(timezone.utc), "attempts": 0}


# def _record_otp_attempt(phone: str) -> int:
#     info = _otp_rate_limit.get(phone, {"attempts": 0})
#     info["attempts"] = info.get("attempts", 0) + 1
#     _otp_rate_limit[phone] = info
#     return info["attempts"]


# def _is_dev() -> bool:
#     return getattr(settings, "APP_ENV", "development") == "development"


# # ─── TEST ENDPOINT - diagnose OTP issue ─────────────────────────────────────
# @router.post("/test-otp-insert")
# async def test_otp_insert(pool=Depends(get_db)):
#     """Test endpoint to diagnose OTP insertion issue."""
#     try:
#         from datetime import datetime, timezone, timedelta
#         phone = "9876543210"
#         otp_hash = "test_hash"
#         role = "citizen"
#         expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

#         # Try to insert
#         result = await pool.execute(
#             """
#             INSERT INTO otp_sessions (phone_number, otp_hash, role, expires_at, created_at)
#             VALUES ($1, $2, $3, $4, NOW())
#             ON CONFLICT (phone_number) DO UPDATE SET
#                 otp_hash     = EXCLUDED.otp_hash,
#                 role         = EXCLUDED.role,
#                 expires_at   = EXCLUDED.expires_at,
#                 created_at   = NOW(),
#                 attempt_count = 0,
#                 used         = FALSE
#             """,
#             phone, otp_hash, role, expires_at,
#         )
#         return {"status": "success", "result": str(result)}
#     except Exception as e:
#         logger.exception(f"test_otp_insert error: {e}")
#         return {"status": "error", "error": str(e), "type": type(e).__name__}



# @router.post("/send-otp", response_model=OTPResponse)
# async def send_otp(body: SendOTPRequest, pool=Depends(get_db)):
#     try:
#         phone = body.phone

#         # ✅ FIX: Normalize phone number - extract just digits
#         digits_only = "".join(filter(str.isdigit, phone))
#         if len(digits_only) == 12 and digits_only.startswith("91"):
#             digits_only = digits_only[2:]
#         elif len(digits_only) == 11 and digits_only.startswith("0"):
#             digits_only = digits_only[1:]

#         allowed, wait = _check_rate_limit(digits_only)
#         if not allowed:
#             raise HTTPException(429, f"Please wait {wait}s before requesting a new OTP.")

#         otp = generate_otp(settings.OTP_LENGTH)
#         # ✅ FIX: Hash with normalized phone for consistency
#         otp_hash = hash_otp(otp, digits_only)
#         expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

#         # Store OTP for dev-mode preview (use original phone as key for user display)
#         _dev_otp_store[phone] = otp

#         # ✅ FIX: Store with normalized phone number
#         await pool.execute(
#             """
#             INSERT INTO otp_sessions (phone_number, otp_hash, role, expires_at, created_at)
#             VALUES ($1, $2, $3, $4, NOW())
#             ON CONFLICT (phone_number) DO UPDATE SET
#                 otp_hash     = EXCLUDED.otp_hash,
#                 role         = EXCLUDED.role,
#                 expires_at   = EXCLUDED.expires_at,
#                 created_at   = NOW(),
#                 attempt_count = 0,
#                 used         = FALSE
#             """,
#             digits_only, otp_hash, body.role, expires_at,
#         )

#         await send_otp_sms(phone, otp, body.language)
#         _record_otp_sent(digits_only)
#         logger.info(f"OTP sent to {digits_only} (role: {body.role})")

#         # In dev mode return the OTP directly so frontend can show it
#         otp_preview = otp if _is_dev() else None

#         return {
#             "success": True,
#             "message": f"OTP sent to {phone[-4:].rjust(10, '*')}",
#             "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
#             "can_resend_after": settings.OTP_RESEND_COOLDOWN_SECONDS,
#             "otp_preview": otp_preview,
#         }
#     # except HTTPException:
#     #     raise
#     except Exception as e:
#         logger.exception(f"send_otp error: {e}")
#         raise HTTPException(500, f"Error sending OTP: {str(e)}")


# # ─── VERIFY OTP ───────────────────────────────────────────────────────────────
# @router.post("/verify-otp")
# async def verify_otp(body: VerifyOTPRequest, pool=Depends(get_db)):
#     phone = body.phone

#     # ✅ FIX: Normalize phone number for consistent lookups
#     digits_only = "".join(filter(str.isdigit, phone))
#     if len(digits_only) == 12 and digits_only.startswith("91"):
#         digits_only = digits_only[2:]
#     elif len(digits_only) == 11 and digits_only.startswith("0"):
#         digits_only = digits_only[1:]

#     attempts = _record_otp_attempt(digits_only)
#     if attempts > settings.OTP_MAX_ATTEMPTS:
#         raise HTTPException(429, "Too many OTP attempts. Please request a new OTP.")

#     session = await pool.fetchrow(
#         "SELECT * FROM otp_sessions WHERE phone_number = $1", digits_only
#     )
#     if not session:
#         raise HTTPException(400, "No OTP session found. Please request a new OTP.")
#     if session["used"]:
#         raise HTTPException(400, "OTP already used. Please request a new one.")
#     if session["expires_at"] < datetime.now(timezone.utc):
#         raise HTTPException(400, "OTP expired. Please request a new one.")
#     # ✅ FIX: Verify hash with normalized phone
#     if not verify_otp_hash(body.otp, digits_only, session["otp_hash"]):
#         raise HTTPException(400, "Invalid OTP. Please try again.")

#     # Mark OTP as used
#     await pool.execute(
#         "UPDATE otp_sessions SET used = TRUE WHERE phone_number = $1", digits_only
#     )
#     _dev_otp_store.pop(phone, None)

#     role = session["role"]

#     # Check if user exists
#     if role == "citizen":
#         # ✅ FIX: Already have normalized phone
#         user = await pool.fetchrow(
#             "SELECT citizen_id AS user_id, full_name FROM citizens WHERE phone_number = $1",
#             digits_only
#         )
#         if user:
#             await pool.execute(
#                 "UPDATE citizens SET last_login=NOW() WHERE phone_number=$1",
#                 digits_only
#             )
#             token = create_token({"sub": str(user["user_id"])}, role="citizen")
#             return {
#                 "access_token": token, "token_type": "bearer",
#                 "role": "citizen", "user_id": str(user["user_id"]),
#                 "full_name": user["full_name"], "is_new_user": False,
#             }
#         else:
#             temp_token = create_token({"sub": phone, "purpose": "register"}, role="citizen", expire_minutes=30)
#             return {
#                 "access_token": None, "token_type": "bearer",
#                 "role": "citizen", "user_id": None,
#                 "full_name": None, "is_new_user": True, "temp_token": temp_token,
#                 "preferred_language": "en", # ✅ FIX: Hardcoded default for new user to prevent crash
#             }

#     elif role == "officer":
#         user = await pool.fetchrow(
#             "SELECT officer_id AS user_id, full_name FROM officers WHERE phone_number = $1", digits_only
#         )
#         if user:
#             await pool.execute(
#                 "UPDATE officers SET last_login=NOW() WHERE phone_number=$1", digits_only
#             )
#             token = create_token({"sub": str(user["user_id"])}, role="officer")
#             return {
#                 "access_token": token, "token_type": "bearer",
#                 "role": "officer", "user_id": str(user["user_id"]),
#                 "full_name": user["full_name"], "is_new_user": False,
#             }
#         else:
#             temp_token = create_token({"sub": phone, "purpose": "register"}, role="officer", expire_minutes=30)
#             return {
#                 "access_token": None, "token_type": "bearer",
#                 "role": "officer", "user_id": None,
#                 "full_name": None, "is_new_user": True, "temp_token": temp_token,
#             }

#     raise HTTPException(400, "Invalid role.")


# # ─── CHECK CITIZEN EXISTS ─────────────────────────────────────────────────────────
# @router.get("/citizen/check")
# async def check_citizen(phone: str, pool=Depends(get_db)):
#     """✅ FIX: Check if citizen phone number exists in database"""
#     # Normalize phone - extract just the digits (10 digits)
#     digits_only = "".join(filter(str.isdigit, phone))
#     # Handle case where someone enters full 12 digits (0091...)
#     if len(digits_only) == 12 and digits_only.startswith("91"):
#         digits_only = digits_only[2:]
#     elif len(digits_only) == 11 and digits_only.startswith("0"):
#         digits_only = digits_only[1:]

#     citizen = await pool.fetchval(
#         "SELECT citizen_id FROM citizens WHERE phone_number = $1",
#         digits_only
#     )

#     return {
#         "exists": citizen is not None,
#         "phone": phone
#     }


# # ─── GET DEMO CITIZENS ────────────────────────────────────────────────────────────
# @router.get("/citizen/demo")
# async def get_demo_citizens(pool=Depends(get_db)):
#     """Get first 3 seeded citizens for demo login purposes"""
#     citizens = await pool.fetch(
#         """SELECT citizen_id, full_name, ward_id, preferred_language
#            FROM citizens
#            ORDER BY created_at ASC
#            LIMIT 3"""
#     )

#     return {
#         "demo_citizens": [
#             {
#                 "citizen_id": str(row["citizen_id"]),
#                 "name": row["full_name"],
#                 "ward_id": row["ward_id"],
#                 "password": "TestPass@123"
#             }
#             for row in citizens
#         ]
#     }


# # ─── CITIZEN LOGIN ─────────────────────────────────────────────────────────────
# @router.post("/login/citizen", response_model=TokenResponse)
# async def citizen_login(body: CitizenLoginRequest, pool=Depends(get_db)):
#     """Citizen login with citizen_id and password"""
#     # Fetch citizen by citizen_id
#     citizen = await pool.fetchrow(
#         "SELECT citizen_id, full_name, password_hash, is_active FROM citizens WHERE citizen_id=$1",
#         body.citizen_id,
#     )
#     if not citizen:
#         raise HTTPException(401, "Invalid credentials.")
#     if not citizen["is_active"]:
#         raise HTTPException(403, "Account deactivated.")
#     if not verify_password(body.password, citizen["password_hash"]):
#         raise HTTPException(401, "Invalid credentials.")

#     # Update last login
#     await pool.execute("UPDATE citizens SET last_login=NOW() WHERE citizen_id=$1", citizen["citizen_id"])

#     token = create_token({"sub": str(citizen["citizen_id"])}, role="citizen")
#     return {
#         "access_token": token, "token_type": "bearer",
#         "role": "citizen", "user_id": str(citizen["citizen_id"]),
#         "full_name": citizen["full_name"], "is_new_user": False,
#     }


# # ─── CITIZEN REGISTER ─────────────────────────────────────────────────────────
# @router.post("/register/citizen", response_model=TokenResponse)
# async def register_citizen(body: CitizenRegisterRequest, pool=Depends(get_db)):
#     """Register new citizen with password"""
#     # Normalize phone - extract just digits
#     digits_only = "".join(filter(str.isdigit, body.phone))
#     if len(digits_only) == 12 and digits_only.startswith("91"):
#         digits_only = digits_only[2:]
#     elif len(digits_only) == 11 and digits_only.startswith("0"):
#         digits_only = digits_only[1:]

#     # Check if ward exists
#     ward = await pool.fetchrow("SELECT ward_id FROM wards WHERE ward_id=$1", body.ward_id)
#     if not ward:
#         raise HTTPException(400, f"Ward {body.ward_id} not found.")

#     # Hash password
#     pw_hash = hash_password(body.password)

#     # Insert citizen
#     try:
#         row = await pool.fetchrow(
#             """INSERT INTO citizens (phone_number, full_name, password_hash, ward_id, preferred_language, home_address)
#                VALUES ($1,$2,$3,$4,$5,$6)
#                ON CONFLICT (phone_number) DO UPDATE
#                SET full_name=$2, password_hash=$3, ward_id=$4, preferred_language=$5, home_address=$6, last_login=NOW()
#                RETURNING citizen_id, full_name""",
#             digits_only, body.full_name, pw_hash, body.ward_id, body.preferred_language, body.home_address,
#         )
#     except Exception as e:
#         raise HTTPException(400, f"Registration failed: {e}")

#     token = create_token({"sub": str(row["citizen_id"])}, role="citizen")
#     return {
#         "access_token": token, "token_type": "bearer",
#         "role": "citizen", "user_id": str(row["citizen_id"]),
#         "full_name": row["full_name"], "is_new_user": True,
#     }



# # ─── OFFICER REGISTER ─────────────────────────────────────────────────────────
# @router.post("/register/officer")
# async def register_officer(body: OfficerRegisterRequest, pool=Depends(get_db)):
#     # Check if employee_id already taken
#     existing = await pool.fetchval(
#         "SELECT officer_id FROM officers WHERE employee_id=$1", body.employee_id
#     )
#     if existing:
#         raise HTTPException(400, "Employee ID already registered.")

#     # ✅ FIX: Normalize phone - extract just digits
#     digits_only = "".join(filter(str.isdigit, body.phone))
#     if len(digits_only) == 12 and digits_only.startswith("91"):
#         digits_only = digits_only[2:]
#     elif len(digits_only) == 11 and digits_only.startswith("0"):
#         digits_only = digits_only[1:]

#     pw_hash = hash_password(body.password)

#     try:
#         row = await pool.fetchrow(
#             """INSERT INTO officers
#                (employee_id, phone_number, full_name, password_hash,
#                 designation, department, ward_id, zone, preferred_language)
#                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
#                RETURNING officer_id, full_name""",
#             body.employee_id, digits_only, body.full_name, pw_hash,
#             body.designation, body.department,
#             body.ward_id, body.zone, body.preferred_language,
#         )
#     except Exception as e:
#         raise HTTPException(400, f"Registration failed: {e}")

#     token = create_token({"sub": str(row["officer_id"])}, role="officer")
#     return {
#         "access_token": token, "token_type": "bearer",
#         "role": "officer", "user_id": str(row["officer_id"]),
#         "full_name": row["full_name"], "is_new_user": True,
#     }


# # ─── OFFICER / ADMIN PASSWORD LOGIN ──────────────────────────────────────────
# @router.post("/officer/login")
# async def officer_login(employee_id: str, password: str, pool=Depends(get_db)):
#     emp_id = employee_id.upper().strip()

#     # First check admins table
#     admin = await pool.fetchrow(
#         "SELECT admin_id, full_name, password_hash, is_active FROM admins WHERE employee_id=$1",
#         emp_id,
#     )
#     if admin:
#         if not admin["is_active"]:
#             raise HTTPException(403, "Account deactivated.")
#         if not verify_password(password, admin["password_hash"]):
#             raise HTTPException(401, "Invalid credentials.")
#         await pool.execute("UPDATE admins SET last_login=NOW() WHERE admin_id=$1", admin["admin_id"])
#         token = create_token({"sub": str(admin["admin_id"])}, role="admin")
#         return {
#             "access_token": token, "token_type": "bearer",
#             "role": "admin", "user_id": str(admin["admin_id"]),
#             "full_name": admin["full_name"],
#         }

#     # Then check officers table
#     officer = await pool.fetchrow(
#         "SELECT officer_id, full_name, password_hash, is_active FROM officers WHERE employee_id=$1",
#         emp_id,
#     )
#     if not officer:
#         raise HTTPException(401, "Invalid credentials.")
#     if not officer["is_active"]:
#         raise HTTPException(403, "Account deactivated.")
#     if not verify_password(password, officer["password_hash"]):
#         raise HTTPException(401, "Invalid credentials.")

#     await pool.execute("UPDATE officers SET last_login=NOW() WHERE officer_id=$1", officer["officer_id"])
#     token = create_token({"sub": str(officer["officer_id"])}, role="officer")
#     return {
#         "access_token": token, "token_type": "bearer",
#         "role": "officer", "user_id": str(officer["officer_id"]),
#         "full_name": officer["full_name"],
#     }


# # ─── ADMIN REGISTRATION (secret URL) ─────────────────────────────────────────
# from pydantic import BaseModel

# class AdminRegisterRequest(BaseModel):
#     employee_id: str
#     full_name: str
#     password: str
#     designation: str = "Commissioner"
#     email: Optional[str] = None
#     secret_key: str  # must match settings.ADMIN_REGISTRATION_SECRET

# @router.post("/admin/register")
# async def register_admin(body: AdminRegisterRequest, pool=Depends(get_db)):
#     """
#     Secret admin registration endpoint.
#     URL: POST /api/auth/admin/register
#     Requires secret_key that matches ADMIN_REGISTRATION_SECRET env var.
#     Access: /admin-register (frontend route) → calls this endpoint.
#     """
#     expected_secret = getattr(settings, "ADMIN_REGISTRATION_SECRET", "nagarmind-admin-2024")
#     if body.secret_key != expected_secret:
#         raise HTTPException(403, "Invalid registration secret.")

#     emp_id = body.employee_id.upper().strip()
#     existing = await pool.fetchval("SELECT admin_id FROM admins WHERE employee_id=$1", emp_id)
#     if existing:
#         raise HTTPException(400, "Employee ID already registered as admin.")

#     pw_hash = hash_password(body.password)
#     row = await pool.fetchrow(
#         """INSERT INTO admins (employee_id, full_name, password_hash, designation, email)
#            VALUES ($1,$2,$3,$4,$5) RETURNING admin_id, full_name""",
#         emp_id, body.full_name.strip(), pw_hash, body.designation, body.email,
#     )
#     return {"success": True, "admin_id": str(row["admin_id"]), "full_name": row["full_name"]}


# # ─── GET CURRENT USER ─────────────────────────────────────────────────────────
# @router.get("/me")
# async def get_me(
#     creds: HTTPAuthorizationCredentials = Depends(security),
#     pool=Depends(get_db),
# ):
#     if not creds:
#         raise HTTPException(401, "Not authenticated")
#     payload = decode_token(creds.credentials)
#     if not payload:
#         raise HTTPException(401, "Invalid or expired token")

#     role = payload.get("role")
#     uid = payload.get("sub")

#     if role == "citizen":
#         row = await pool.fetchrow(
#             """SELECT c.*, w.ward_name FROM citizens c
#                LEFT JOIN wards w ON w.ward_id = c.ward_id
#                WHERE c.citizen_id = $1""", uid,
#         )
#         if not row:
#             raise HTTPException(404, "User not found")
#         d = dict(row)
#         return {**d, "role": "citizen"}

#     elif role in ("officer", "admin"):
#         # Check admins table first
#         if role == "admin":
#             row = await pool.fetchrow("SELECT * FROM admins WHERE admin_id=$1", uid)
#             if row:
#                 d = dict(row)
#                 d.pop("password_hash", None)
#                 return {**d, "role": "admin"}

#         row = await pool.fetchrow(
#             """SELECT o.*, w.ward_name FROM officers o
#                LEFT JOIN wards w ON w.ward_id = o.ward_id
#                WHERE o.officer_id = $1""", uid,
#         )
#         if not row:
#             raise HTTPException(404, "User not found")
#         d = dict(row)
#         d.pop("password_hash", None)
#         return {**d, "role": role}

#     raise HTTPException(400, "Invalid role")


# # ─── RESEND OTP ───────────────────────────────────────────────────────────────
# @router.post("/refresh-otp", response_model=OTPResponse)
# async def resend_otp(body: SendOTPRequest, pool=Depends(get_db)):
#     return await send_otp(body, pool)

"""
NagarMind Auth API — NO OTP VERSION
Stores preferred_language on citizen registration.

  POST /api/auth/register/citizen  → phone + full_name + password + ward_id + preferred_language
  POST /api/auth/login/citizen     → citizen_id + password
  GET  /api/auth/citizen/demo      → first 5 citizens for quick demo login
  GET  /api/auth/citizen/check     → check if phone exists
  POST /api/auth/register/officer  → officer registration
  POST /api/auth/officer/login     → employee_id + password (officers + admins)
  POST /api/auth/admin/register    → admin registration with secret key
  GET  /api/auth/me                → current user from token
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_token, decode_token, hash_password, verify_password

router = APIRouter(tags=["auth"])
security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def _normalize_phone(phone: str) -> str:
    digits = "".join(filter(str.isdigit, phone))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


# ─── REGISTER CITIZEN ─────────────────────────────────────────────────────────
@router.post("/register/citizen")
async def register_citizen(body: dict, pool=Depends(get_db)):
    phone              = body.get("phone", "").strip()
    full_name          = body.get("full_name", "").strip()
    password           = body.get("password", "")
    password_confirm   = body.get("password_confirm", "")
    ward_id            = body.get("ward_id")
    preferred_language = body.get("preferred_language", "en")  # ✅ stored
    home_address       = body.get("home_address")

    if not all([phone, full_name, password, ward_id]):
        raise HTTPException(400, "phone, full_name, password, and ward_id are required")

    if password != password_confirm:
        raise HTTPException(400, "Passwords do not match")

    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    digits = _normalize_phone(phone)
    if len(digits) != 10:
        raise HTTPException(400, "Invalid phone number — must be 10 digits")
    phone_normalized = f"+91{digits}"

    existing = await pool.fetchrow(
        "SELECT citizen_id FROM citizens WHERE phone_number=$1", phone_normalized
    )
    if existing:
        raise HTTPException(409, "An account with this phone number already exists")

    ward = await pool.fetchrow("SELECT ward_id FROM wards WHERE ward_id=$1", ward_id)
    if not ward:
        raise HTTPException(400, f"Ward {ward_id} not found")

    pw_hash = hash_password(password)

    try:
        row = await pool.fetchrow(
            """INSERT INTO citizens
               (phone_number, full_name, password_hash, ward_id,
                preferred_language, home_address, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               RETURNING citizen_id, full_name, ward_id, preferred_language""",
            phone_normalized, full_name, pw_hash, ward_id,
            preferred_language, home_address,
        )
    except Exception as e:
        logger.exception(f"register_citizen error: {e}")
        raise HTTPException(400, f"Registration failed: {e}")

    token = create_token({"sub": str(row["citizen_id"])}, role="citizen")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "citizen",
        "user_id": str(row["citizen_id"]),
        "full_name": row["full_name"],
        "ward_id": row["ward_id"],
        "preferred_language": row["preferred_language"],
        "is_new_user": True,
    }


# ─── LOGIN CITIZEN ─────────────────────────────────────────────────────────────
@router.post("/login/citizen")
async def login_citizen(body: dict, pool=Depends(get_db)):
    citizen_id = body.get("citizen_id", "").strip()
    password   = body.get("password", "")

    if not citizen_id or not password:
        raise HTTPException(400, "citizen_id and password are required")

    try:
        citizen = await pool.fetchrow(
            """SELECT citizen_id, full_name, password_hash, ward_id,
                      preferred_language, is_active
               FROM citizens WHERE citizen_id=$1::uuid""",
            citizen_id,
        )
    except Exception:
        raise HTTPException(400, "Invalid citizen ID format")

    if not citizen:
        raise HTTPException(401, "Invalid credentials")
    if not citizen["is_active"]:
        raise HTTPException(403, "Account deactivated")
    if not verify_password(password, citizen["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    await pool.execute(
        "UPDATE citizens SET last_login=NOW() WHERE citizen_id=$1",
        citizen["citizen_id"],
    )

    token = create_token({"sub": str(citizen["citizen_id"])}, role="citizen")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "citizen",
        "user_id": str(citizen["citizen_id"]),
        "full_name": citizen["full_name"],
        "ward_id": citizen["ward_id"],
        "preferred_language": citizen["preferred_language"] or "en",
        "is_new_user": False,
    }


# ─── DEMO CITIZENS ────────────────────────────────────────────────────────────
@router.get("/citizen/demo")
async def get_demo_citizens(pool=Depends(get_db)):
    rows = await pool.fetch(
        """SELECT citizen_id, full_name, ward_id, preferred_language
           FROM citizens ORDER BY created_at ASC LIMIT 5"""
    )
    demo_list = [
        {
            "citizen_id": str(r["citizen_id"]),
            "name": r["full_name"],
            "ward_id": r["ward_id"],
            "preferred_language": r["preferred_language"] or "en",
            "password": "TestPass@123",
        }
        for r in rows
    ]
    if not demo_list:
        demo_list = [{
            "citizen_id": "none",
            "name": "No citizens registered yet",
            "ward_id": 1,
            "preferred_language": "en",
            "password": "TestPass@123",
        }]
    return {"demo_citizens": demo_list}


# ─── CHECK CITIZEN BY PHONE ───────────────────────────────────────────────────
@router.get("/citizen/check")
async def check_citizen(phone: str = Query(...), pool=Depends(get_db)):
    digits = _normalize_phone(phone)
    phone_normalized = f"+91{digits}"
    row = await pool.fetchrow(
        "SELECT citizen_id, full_name FROM citizens WHERE phone_number=$1",
        phone_normalized,
    )
    return {"exists": row is not None, "full_name": row["full_name"] if row else None}


# ─── REGISTER OFFICER ─────────────────────────────────────────────────────────
@router.post("/register/officer")
async def register_officer(body: dict, pool=Depends(get_db)):
    employee_id        = body.get("employee_id", "").strip().upper()
    full_name          = body.get("full_name", "").strip()
    password           = body.get("password", "")
    designation        = body.get("designation", "Junior Engineer")
    department         = body.get("department", "General")
    ward_id            = body.get("ward_id")
    zone               = body.get("zone")
    phone              = body.get("phone", "").strip()
    preferred_language = body.get("preferred_language", "en")

    if not all([employee_id, full_name, password]):
        raise HTTPException(400, "employee_id, full_name, and password are required")
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    existing = await pool.fetchrow(
        "SELECT officer_id FROM officers WHERE employee_id=$1", employee_id
    )
    if existing:
        raise HTTPException(409, "Employee ID already registered")

    phone_normalized = None
    if phone:
        digits = _normalize_phone(phone)
        phone_normalized = f"+91{digits}" if len(digits) == 10 else None

    pw_hash = hash_password(password)

    try:
        row = await pool.fetchrow(
            """INSERT INTO officers
               (employee_id, full_name, password_hash, designation, department,
                ward_id, zone, phone_number, preferred_language, is_active, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,NOW())
               RETURNING officer_id, full_name""",
            employee_id, full_name, pw_hash, designation, department,
            ward_id, zone, phone_normalized, preferred_language,
        )
    except Exception as e:
        logger.exception(f"register_officer error: {e}")
        raise HTTPException(400, f"Registration failed: {e}")

    token = create_token({"sub": str(row["officer_id"])}, role="officer")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "officer",
        "user_id": str(row["officer_id"]),
        "full_name": row["full_name"],
        "is_new_user": True,
    }


# ─── OFFICER / ADMIN LOGIN ─────────────────────────────────────────────────────
@router.post("/officer/login")
async def officer_login(
    employee_id: str = Query(...),
    password: str = Query(...),
    pool=Depends(get_db),
):
    emp_id = employee_id.strip().upper()

    # Check admins table first
    admin = await pool.fetchrow(
        "SELECT admin_id, full_name, password_hash, is_active FROM admins WHERE employee_id=$1",
        emp_id,
    )
    if admin:
        if not admin["is_active"]:
            raise HTTPException(403, "Account deactivated")
        if not verify_password(password, admin["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        await pool.execute("UPDATE admins SET last_login=NOW() WHERE admin_id=$1", admin["admin_id"])
        token = create_token({"sub": str(admin["admin_id"])}, role="admin")
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": "admin",
            "user_id": str(admin["admin_id"]),
            "full_name": admin["full_name"],
        }

    # Then officers table
    officer = await pool.fetchrow(
        """SELECT officer_id, full_name, password_hash, is_active,
                  is_admin, ward_id, designation, preferred_language
           FROM officers WHERE employee_id=$1""",
        emp_id,
    )
    if not officer:
        raise HTTPException(401, "Invalid credentials")
    if not officer["is_active"]:
        raise HTTPException(403, "Account deactivated")
    if not verify_password(password, officer["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    await pool.execute("UPDATE officers SET last_login=NOW() WHERE officer_id=$1", officer["officer_id"])

    role = "admin" if officer["is_admin"] else "officer"
    token = create_token({"sub": str(officer["officer_id"])}, role=role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role,
        "user_id": str(officer["officer_id"]),
        "full_name": officer["full_name"],
        "ward_id": officer["ward_id"],
        "designation": officer["designation"],
        "preferred_language": officer["preferred_language"] or "en",
    }


# ─── ADMIN REGISTER ───────────────────────────────────────────────────────────
@router.post("/admin/register")
async def admin_register(body: dict, pool=Depends(get_db)):
    secret_key      = body.get("secret_key", "")
    expected_secret = getattr(settings, "ADMIN_REGISTRATION_SECRET", "nagarmind-admin-2024")

    if secret_key != expected_secret:
        raise HTTPException(403, "Invalid registration secret")

    employee_id = body.get("employee_id", "").strip().upper()
    full_name   = body.get("full_name", "").strip()
    password    = body.get("password", "")
    designation = body.get("designation", "Commissioner")
    email       = body.get("email")

    if not all([employee_id, full_name, password]):
        raise HTTPException(400, "employee_id, full_name, and password are required")

    for table, col in [("admins", "admin_id"), ("officers", "officer_id")]:
        exists = await pool.fetchrow(
            f"SELECT {col} FROM {table} WHERE employee_id=$1", employee_id
        )
        if exists:
            raise HTTPException(409, "Employee ID already registered")

    pw_hash = hash_password(password)

    try:
        row = await pool.fetchrow(
            """INSERT INTO admins (employee_id, full_name, password_hash, designation, email)
               VALUES ($1,$2,$3,$4,$5) RETURNING admin_id, full_name""",
            employee_id, full_name, pw_hash, designation, email,
        )
        user_id = str(row["admin_id"])
    except Exception:
        # Fallback: admins table may not exist, use officers with is_admin=True
        row = await pool.fetchrow(
            """INSERT INTO officers
               (employee_id, full_name, password_hash, designation, department,
                is_admin, is_active, created_at)
               VALUES ($1,$2,$3,$4,'Administration',TRUE,TRUE,NOW())
               RETURNING officer_id, full_name""",
            employee_id, full_name, pw_hash, designation,
        )
        user_id = str(row["officer_id"])

    token = create_token({"sub": user_id}, role="admin")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "admin",
        "user_id": user_id,
        "full_name": row["full_name"],
    }


# ─── GET ME ───────────────────────────────────────────────────────────────────
@router.get("/me")
async def get_me(
    creds: HTTPAuthorizationCredentials = Depends(security),
    pool=Depends(get_db),
):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")

    role = payload.get("role")
    uid  = payload.get("sub")

    if role == "citizen":
        row = await pool.fetchrow(
            """SELECT c.citizen_id, c.full_name, c.phone_number, c.ward_id,
                      c.preferred_language, c.home_address, c.created_at, w.ward_name
               FROM citizens c
               LEFT JOIN wards w ON w.ward_id = c.ward_id
               WHERE c.citizen_id = $1::uuid""",
            uid,
        )
        if not row:
            raise HTTPException(404, "User not found")
        return {**dict(row), "role": "citizen"}

    elif role == "admin":
        row = await pool.fetchrow(
            "SELECT admin_id AS user_id, full_name, employee_id FROM admins WHERE admin_id=$1::uuid",
            uid,
        )
        if row:
            return {**dict(row), "role": "admin"}
        # fallback to officers table
        row = await pool.fetchrow(
            "SELECT officer_id AS user_id, full_name, employee_id, ward_id, designation FROM officers WHERE officer_id=$1::uuid",
            uid,
        )
        if not row:
            raise HTTPException(404, "User not found")
        return {**dict(row), "role": "admin"}

    elif role == "officer":
        row = await pool.fetchrow(
            """SELECT o.officer_id AS user_id, o.full_name, o.employee_id,
                      o.ward_id, o.designation, o.preferred_language, w.ward_name
               FROM officers o
               LEFT JOIN wards w ON w.ward_id = o.ward_id
               WHERE o.officer_id = $1::uuid""",
            uid,
        )
        if not row:
            raise HTTPException(404, "User not found")
        return {**dict(row), "role": "officer"}

    raise HTTPException(400, "Invalid role in token")


# ─── DISABLED OTP STUBS (prevent 404 if frontend still calls them) ────────────
@router.post("/send-otp")
async def send_otp_disabled(body: dict):
    raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")

@router.post("/verify-otp")
async def verify_otp_disabled(body: dict):
    raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")

@router.post("/refresh-otp")
async def refresh_otp_disabled(body: dict):
    raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")