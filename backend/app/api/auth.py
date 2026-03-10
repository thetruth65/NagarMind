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