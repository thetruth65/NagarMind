# """
# NagarMind Auth API — NO OTP VERSION
# Stores preferred_language on citizen registration.

#   POST /api/auth/register/citizen  → phone + full_name + password + ward_id + preferred_language
#   POST /api/auth/login/citizen     → citizen_id + password
#   GET  /api/auth/citizen/demo      → first 5 citizens for quick demo login
#   GET  /api/auth/citizen/check     → check if phone exists
#   POST /api/auth/register/officer  → officer registration
#   POST /api/auth/officer/login     → employee_id + password (officers + admins)
#   POST /api/auth/admin/register    → admin registration with secret key
#   GET  /api/auth/me                → current user from token

# SCHEMA v7 column mapping (vs old schema):
#   citizens:  full_name → name,  home_address → address,  no preferred_language col
#   officers:  full_name → name,  no is_admin col, no preferred_language col
#   admins:    full_name → name
# """

# import logging
# from fastapi import APIRouter, Depends, HTTPException, Query
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# from app.core.config import settings
# from app.core.database import get_db
# from app.core.security import create_token, decode_token, hash_password, verify_password

# router = APIRouter(tags=["auth"])
# security = HTTPBearer(auto_error=False)
# logger = logging.getLogger(__name__)


# def _normalize_phone(phone: str) -> str:
#     digits = "".join(filter(str.isdigit, phone))
#     if len(digits) == 12 and digits.startswith("91"):
#         digits = digits[2:]
#     elif len(digits) == 11 and digits.startswith("0"):
#         digits = digits[1:]
#     return digits


# # ─── REGISTER CITIZEN ─────────────────────────────────────────────────────────
# @router.post("/register/citizen")
# async def register_citizen(body: dict, pool=Depends(get_db)):
#     phone              = body.get("phone", "").strip()
#     full_name          = body.get("full_name", "").strip()
#     password           = body.get("password", "")
#     password_confirm   = body.get("password_confirm", "")
#     ward_id            = body.get("ward_id")
#     preferred_language = body.get("preferred_language", "en")
#     home_address       = body.get("home_address")

#     if not all([phone, full_name, password, ward_id]):
#         raise HTTPException(400, "phone, full_name, password, and ward_id are required")

#     if password != password_confirm:
#         raise HTTPException(400, "Passwords do not match")

#     if len(password) < 8:
#         raise HTTPException(400, "Password must be at least 8 characters")

#     digits = _normalize_phone(phone)
#     if len(digits) != 10:
#         raise HTTPException(400, "Invalid phone number — must be 10 digits")
#     phone_normalized = f"+91{digits}"

#     existing = await pool.fetchrow(
#         "SELECT citizen_id FROM citizens WHERE phone_number=$1", phone_normalized
#     )
#     if existing:
#         raise HTTPException(409, "An account with this phone number already exists")

#     ward = await pool.fetchrow("SELECT ward_id FROM wards WHERE ward_id=$1", ward_id)
#     if not ward:
#         raise HTTPException(400, f"Ward {ward_id} not found")

#     pw_hash = hash_password(password)

#     try:
#         # v7 schema: name (not full_name), address (not home_address)
#         # preferred_language not in v7 citizens table — store in address field as fallback
#         # or simply omit it (v7 schema doesn't have it)
#         row = await pool.fetchrow(
#             """INSERT INTO citizens
#                (phone_number, name, password_hash, ward_id, address, created_at)
#                VALUES ($1, $2, $3, $4, $5, NOW())
#                RETURNING citizen_id, name, ward_id""",
#             phone_normalized, full_name, pw_hash, ward_id, home_address,
#         )
#     except Exception as e:
#         logger.exception(f"register_citizen error: {e}")
#         raise HTTPException(400, f"Registration failed: {e}")

#     token = create_token({"sub": str(row["citizen_id"])}, role="citizen")
#     return {
#         "access_token": token,
#         "token_type": "bearer",
#         "role": "citizen",
#         "user_id": str(row["citizen_id"]),
#         "full_name": row["name"],
#         "ward_id": row["ward_id"],
#         "preferred_language": preferred_language,
#         "is_new_user": True,
#     }


# # ─── LOGIN CITIZEN ─────────────────────────────────────────────────────────────
# @router.post("/login/citizen")
# async def login_citizen(body: dict, pool=Depends(get_db)):
#     citizen_id = body.get("citizen_id", "").strip()
#     password   = body.get("password", "")

#     if not citizen_id or not password:
#         raise HTTPException(400, "citizen_id and password are required")

#     try:
#         # v7 schema: name (not full_name), no preferred_language col
#         citizen = await pool.fetchrow(
#             """SELECT citizen_id, name, password_hash, ward_id, is_active
#                FROM citizens WHERE citizen_id=$1::uuid""",
#             citizen_id,
#         )
#     except Exception:
#         raise HTTPException(400, "Invalid citizen ID format")

#     if not citizen:
#         raise HTTPException(401, "Invalid credentials")
#     if not citizen["is_active"]:
#         raise HTTPException(403, "Account deactivated")
#     if not verify_password(password, citizen["password_hash"]):
#         raise HTTPException(401, "Invalid credentials")

#     await pool.execute(
#         "UPDATE citizens SET last_login=NOW() WHERE citizen_id=$1",
#         citizen["citizen_id"],
#     ) if False else None  # v7 schema has no last_login on citizens — skip silently

#     token = create_token({"sub": str(citizen["citizen_id"])}, role="citizen")
#     return {
#         "access_token": token,
#         "token_type": "bearer",
#         "role": "citizen",
#         "user_id": str(citizen["citizen_id"]),
#         "full_name": citizen["name"],
#         "ward_id": citizen["ward_id"],
#         "preferred_language": "en",  # default — v7 schema has no preferred_language col
#         "is_new_user": False,
#     }


# # ─── DEMO CITIZENS ────────────────────────────────────────────────────────────
# @router.get("/citizen/demo")
# async def get_demo_citizens(pool=Depends(get_db)):
#     # v7 schema: column is "name" not "full_name", no "preferred_language" col
#     rows = await pool.fetch(
#         """SELECT citizen_id, name, ward_id
#            FROM citizens ORDER BY created_at ASC LIMIT 5"""
#     )
#     demo_list = [
#         {
#             "citizen_id": str(r["citizen_id"]),
#             "name": r["name"],
#             "ward_id": r["ward_id"],
#             "preferred_language": "en",
#             "password": "TestPass@123",
#         }
#         for r in rows
#     ]
#     if not demo_list:
#         demo_list = [{
#             "citizen_id": "none",
#             "name": "No citizens registered yet",
#             "ward_id": 1,
#             "preferred_language": "en",
#             "password": "TestPass@123",
#         }]
#     return {"demo_citizens": demo_list}


# # ─── CHECK CITIZEN BY PHONE ───────────────────────────────────────────────────
# @router.get("/citizen/check")
# async def check_citizen(phone: str = Query(...), pool=Depends(get_db)):
#     digits = _normalize_phone(phone)
#     phone_normalized = f"+91{digits}"
#     # v7 schema: "name" not "full_name"
#     row = await pool.fetchrow(
#         "SELECT citizen_id, name FROM citizens WHERE phone_number=$1",
#         phone_normalized,
#     )
#     return {"exists": row is not None, "full_name": row["name"] if row else None}


# # ─── REGISTER OFFICER ─────────────────────────────────────────────────────────
# @router.post("/register/officer")
# async def register_officer(body: dict, pool=Depends(get_db)):
#     employee_id        = body.get("employee_id", "").strip().upper()
#     full_name          = body.get("full_name", "").strip()
#     password           = body.get("password", "")
#     designation        = body.get("designation", "Field Officer")
#     department         = body.get("department", "General")
#     ward_id            = body.get("ward_id")
#     zone               = body.get("zone")
#     phone              = body.get("phone", "").strip()
#     preferred_language = body.get("preferred_language", "en")

#     if not all([employee_id, full_name, password]):
#         raise HTTPException(400, "employee_id, full_name, and password are required")
#     if len(password) < 8:
#         raise HTTPException(400, "Password must be at least 8 characters")

#     existing = await pool.fetchrow(
#         "SELECT officer_id FROM officers WHERE employee_id=$1", employee_id
#     )
#     if existing:
#         raise HTTPException(409, "Employee ID already registered")

#     phone_normalized = None
#     if phone:
#         digits = _normalize_phone(phone)
#         phone_normalized = f"+91{digits}" if len(digits) == 10 else None

#     # Generate a unique email for v7 schema (email is UNIQUE NOT NULL)
#     email = f"{employee_id.lower()}@mcd.delhi.gov.in"

#     pw_hash = hash_password(password)

#     try:
#         # v7 schema: name (not full_name), email required, no zone/department cols
#         row = await pool.fetchrow(
#             """INSERT INTO officers
#                (employee_id, name, email, password_hash, designation,
#                 ward_id, phone_number, is_active, created_at)
#                VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())
#                RETURNING officer_id, name""",
#             employee_id, full_name, email, pw_hash, designation,
#             ward_id, phone_normalized,
#         )
#     except Exception as e:
#         logger.exception(f"register_officer error: {e}")
#         raise HTTPException(400, f"Registration failed: {e}")

#     token = create_token({"sub": str(row["officer_id"])}, role="officer")
#     return {
#         "access_token": token,
#         "token_type": "bearer",
#         "role": "officer",
#         "user_id": str(row["officer_id"]),
#         "full_name": row["name"],
#         "is_new_user": True,
#     }


# # ─── OFFICER / ADMIN LOGIN ─────────────────────────────────────────────────────
# @router.post("/officer/login")
# async def officer_login(
#     employee_id: str = Query(...),
#     password: str = Query(...),
#     pool=Depends(get_db),
# ):
#     emp_id = employee_id.strip().upper()

#     # Check admins table first — v7 schema uses "name" not "full_name"
#     admin = await pool.fetchrow(
#         "SELECT admin_id, name, password_hash, is_active FROM admins WHERE employee_id=$1",
#         emp_id,
#     )
#     if admin:
#         if not admin["is_active"]:
#             raise HTTPException(403, "Account deactivated")
#         if not verify_password(password, admin["password_hash"]):
#             raise HTTPException(401, "Invalid credentials")
#         token = create_token({"sub": str(admin["admin_id"])}, role="admin")
#         return {
#             "access_token": token,
#             "token_type": "bearer",
#             "role": "admin",
#             "user_id": str(admin["admin_id"]),
#             "full_name": admin["name"],
#         }

#     # Then officers table — v7 schema: name, no is_admin, no preferred_language
#     officer = await pool.fetchrow(
#         """SELECT officer_id, name, password_hash, is_active, ward_id, designation
#            FROM officers WHERE employee_id=$1""",
#         emp_id,
#     )
#     if not officer:
#         raise HTTPException(401, "Invalid credentials")
#     if not officer["is_active"]:
#         raise HTTPException(403, "Account deactivated")
#     if not verify_password(password, officer["password_hash"]):
#         raise HTTPException(401, "Invalid credentials")

#     token = create_token({"sub": str(officer["officer_id"])}, role="officer")
#     return {
#         "access_token": token,
#         "token_type": "bearer",
#         "role": "officer",
#         "user_id": str(officer["officer_id"]),
#         "full_name": officer["name"],
#         "ward_id": officer["ward_id"],
#         "designation": officer["designation"],
#         "preferred_language": "en",
#     }


# # ─── ADMIN REGISTER ───────────────────────────────────────────────────────────
# @router.post("/admin/register")
# async def admin_register(body: dict, pool=Depends(get_db)):
#     secret_key      = body.get("secret_key", "")
#     expected_secret = getattr(settings, "ADMIN_REGISTRATION_SECRET", "nagarmind-admin-2024")

#     if secret_key != expected_secret:
#         raise HTTPException(403, "Invalid registration secret")

#     employee_id = body.get("employee_id", "").strip().upper()
#     full_name   = body.get("full_name", "").strip()
#     password    = body.get("password", "")
#     designation = body.get("designation", "Commissioner")
#     email       = body.get("email") or f"{employee_id.lower()}@mcd.delhi.gov.in"

#     if not all([employee_id, full_name, password]):
#         raise HTTPException(400, "employee_id, full_name, and password are required")

#     for table, col in [("admins", "admin_id"), ("officers", "officer_id")]:
#         exists = await pool.fetchrow(
#             f"SELECT {col} FROM {table} WHERE employee_id=$1", employee_id
#         )
#         if exists:
#             raise HTTPException(409, "Employee ID already registered")

#     pw_hash = hash_password(password)

#     try:
#         # v7 schema: name (not full_name), email required
#         row = await pool.fetchrow(
#             """INSERT INTO admins (employee_id, name, email, password_hash, role)
#                VALUES ($1,$2,$3,$4,'admin') RETURNING admin_id, name""",
#             employee_id, full_name, email, pw_hash,
#         )
#         user_id = str(row["admin_id"])
#     except Exception as e:
#         logger.exception(f"admin_register error: {e}")
#         raise HTTPException(400, f"Registration failed: {e}")

#     token = create_token({"sub": user_id}, role="admin")
#     return {
#         "access_token": token,
#         "token_type": "bearer",
#         "role": "admin",
#         "user_id": user_id,
#         "full_name": row["name"],
#     }


# # ─── GET ME ───────────────────────────────────────────────────────────────────
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
#     uid  = payload.get("sub")

#     if role == "citizen":
#         # v7 schema: name (not full_name), address (not home_address), no preferred_language
#         row = await pool.fetchrow(
#             """SELECT c.citizen_id, c.name AS full_name, c.phone_number, c.ward_id,
#                       c.address AS home_address, c.created_at, w.ward_name
#                FROM citizens c
#                LEFT JOIN wards w ON w.ward_id = c.ward_id
#                WHERE c.citizen_id = $1::uuid""",
#             uid,
#         )
#         if not row:
#             raise HTTPException(404, "User not found")
#         d = dict(row)
#         d["preferred_language"] = "en"  # default — not in v7 schema
#         return {**d, "role": "citizen"}

#     elif role == "admin":
#         # v7 schema: name (not full_name)
#         row = await pool.fetchrow(
#             "SELECT admin_id AS user_id, name AS full_name, employee_id FROM admins WHERE admin_id=$1::uuid",
#             uid,
#         )
#         if row:
#             return {**dict(row), "role": "admin"}
#         # fallback to officers table
#         row = await pool.fetchrow(
#             "SELECT officer_id AS user_id, name AS full_name, employee_id, ward_id, designation FROM officers WHERE officer_id=$1::uuid",
#             uid,
#         )
#         if not row:
#             raise HTTPException(404, "User not found")
#         return {**dict(row), "role": "admin"}

#     elif role == "officer":
#         # v7 schema: name (not full_name), no preferred_language
#         row = await pool.fetchrow(
#             """SELECT o.officer_id AS user_id, o.name AS full_name, o.employee_id,
#                       o.ward_id, o.designation, w.ward_name
#                FROM officers o
#                LEFT JOIN wards w ON w.ward_id = o.ward_id
#                WHERE o.officer_id = $1::uuid""",
#             uid,
#         )
#         if not row:
#             raise HTTPException(404, "User not found")
#         d = dict(row)
#         d["preferred_language"] = "en"  # default — not in v7 schema
#         return {**d, "role": "officer"}

#     raise HTTPException(400, "Invalid role in token")


# # ─── DISABLED OTP STUBS (prevent 404 if frontend still calls them) ────────────
# @router.post("/send-otp")
# async def send_otp_disabled(body: dict):
#     raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")

# @router.post("/verify-otp")
# async def verify_otp_disabled(body: dict):
#     raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")

# @router.post("/refresh-otp")
# async def refresh_otp_disabled(body: dict):
#     raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")

"""
NagarMind Auth API — NO OTP VERSION

  POST /api/auth/register/citizen  → phone + full_name + password + ward_id
  POST /api/auth/login/citizen     → citizen_id + password
  GET  /api/auth/citizen/demo      → first 5 citizens for quick demo login
  GET  /api/auth/citizen/check     → check if phone exists
  POST /api/auth/register/officer  → officer registration
  POST /api/auth/officer/login     → employee_id OR email + password (officers + admins)
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
    phone            = body.get("phone", "").strip()
    full_name        = body.get("full_name", "").strip()
    password         = body.get("password", "")
    password_confirm = body.get("password_confirm", "")
    ward_id          = body.get("ward_id")
    home_address     = body.get("home_address")

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
               (phone_number, name, password_hash, ward_id, address, created_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               RETURNING citizen_id, name, ward_id""",
            phone_normalized, full_name, pw_hash, ward_id, home_address,
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
        "full_name": row["name"],
        "ward_id": row["ward_id"],
        "preferred_language": "en",
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
            """SELECT citizen_id, name, password_hash, ward_id, is_active
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

    token = create_token({"sub": str(citizen["citizen_id"])}, role="citizen")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "citizen",
        "user_id": str(citizen["citizen_id"]),
        "full_name": citizen["name"],
        "ward_id": citizen["ward_id"],
        "preferred_language": "en",
        "is_new_user": False,
    }


# ─── DEMO CITIZENS ────────────────────────────────────────────────────────────
@router.get("/citizen/demo")
async def get_demo_citizens(pool=Depends(get_db)):
    rows = await pool.fetch(
        """SELECT citizen_id, name, ward_id
           FROM citizens ORDER BY created_at ASC LIMIT 5"""
    )
    demo_list = [
        {
            "citizen_id": str(r["citizen_id"]),
            "name": r["name"],
            "ward_id": r["ward_id"],
            "preferred_language": "en",
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
        "SELECT citizen_id, name FROM citizens WHERE phone_number=$1",
        phone_normalized,
    )
    return {"exists": row is not None, "full_name": row["name"] if row else None}


# ─── REGISTER OFFICER ─────────────────────────────────────────────────────────
@router.post("/register/officer")
async def register_officer(body: dict, pool=Depends(get_db)):
    employee_id = body.get("employee_id", "").strip().upper()
    full_name   = body.get("full_name", "").strip()
    password    = body.get("password", "")
    designation = body.get("designation", "Field Officer")
    ward_id     = body.get("ward_id")
    phone       = body.get("phone", "").strip()

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

    email = f"{employee_id.lower()}@mcd.delhi.gov.in"
    pw_hash = hash_password(password)

    try:
        row = await pool.fetchrow(
            """INSERT INTO officers
               (employee_id, name, email, password_hash, designation,
                ward_id, phone_number, is_active, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())
               RETURNING officer_id, name""",
            employee_id, full_name, email, pw_hash, designation,
            ward_id, phone_normalized,
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
        "full_name": row["name"],
        "is_new_user": True,
    }


# ─── OFFICER / ADMIN LOGIN ─────────────────────────────────────────────────────
@router.post("/officer/login")
async def officer_login(
    employee_id: str = Query(...),
    password: str = Query(...),
    pool=Depends(get_db),
):
    # Accept EITHER employee_id (e.g. MCD-ADMIN-001) OR email (e.g. officer1_1@mcd.delhi.gov.in)
    # Frontend sends the email address as the employee_id field — handle both
    raw = employee_id.strip()
    emp_id = raw.upper()           # for employee_id column match (stored uppercase)
    email_lower = raw.lower()      # for email column match

    # ── Check admins first ──
    admin = await pool.fetchrow(
        """SELECT admin_id, name, password_hash, is_active FROM admins
           WHERE employee_id=$1 OR email=$2""",
        emp_id, email_lower,
    )
    if admin:
        if not admin["is_active"]:
            raise HTTPException(403, "Account deactivated")
        if not verify_password(password, admin["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        token = create_token({"sub": str(admin["admin_id"])}, role="admin")
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": "admin",
            "user_id": str(admin["admin_id"]),
            "full_name": admin["name"],
        }

    # ── Then officers ──
    officer = await pool.fetchrow(
        """SELECT officer_id, name, password_hash, is_active, ward_id, designation
           FROM officers WHERE employee_id=$1 OR email=$2""",
        emp_id, email_lower,
    )
    if not officer:
        raise HTTPException(401, "Invalid credentials")
    if not officer["is_active"]:
        raise HTTPException(403, "Account deactivated")
    if not verify_password(password, officer["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    token = create_token({"sub": str(officer["officer_id"])}, role="officer")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "officer",
        "user_id": str(officer["officer_id"]),
        "full_name": officer["name"],
        "ward_id": officer["ward_id"],
        "designation": officer["designation"],
        "preferred_language": "en",
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
    email       = body.get("email") or f"{employee_id.lower()}@mcd.delhi.gov.in"

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
            """INSERT INTO admins (employee_id, name, email, password_hash, role)
               VALUES ($1,$2,$3,$4,'admin') RETURNING admin_id, name""",
            employee_id, full_name, email, pw_hash,
        )
    except Exception as e:
        logger.exception(f"admin_register error: {e}")
        raise HTTPException(400, f"Registration failed: {e}")

    token = create_token({"sub": str(row["admin_id"])}, role="admin")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "admin",
        "user_id": str(row["admin_id"]),
        "full_name": row["name"],
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
            """SELECT c.citizen_id, c.name AS full_name, c.phone_number, c.ward_id,
                      c.address AS home_address, c.created_at, w.ward_name
               FROM citizens c
               LEFT JOIN wards w ON w.ward_id = c.ward_id
               WHERE c.citizen_id = $1::uuid""",
            uid,
        )
        if not row:
            raise HTTPException(404, "User not found")
        d = dict(row)
        d["preferred_language"] = "en"
        return {**d, "role": "citizen"}

    elif role == "admin":
        row = await pool.fetchrow(
            "SELECT admin_id AS user_id, name AS full_name, employee_id FROM admins WHERE admin_id=$1::uuid",
            uid,
        )
        if row:
            return {**dict(row), "role": "admin"}
        row = await pool.fetchrow(
            "SELECT officer_id AS user_id, name AS full_name, employee_id, ward_id, designation FROM officers WHERE officer_id=$1::uuid",
            uid,
        )
        if not row:
            raise HTTPException(404, "User not found")
        return {**dict(row), "role": "admin"}

    elif role == "officer":
        row = await pool.fetchrow(
            """SELECT o.officer_id AS user_id, o.name AS full_name, o.employee_id,
                      o.ward_id, o.designation, w.ward_name
               FROM officers o
               LEFT JOIN wards w ON w.ward_id = o.ward_id
               WHERE o.officer_id = $1::uuid""",
            uid,
        )
        if not row:
            raise HTTPException(404, "User not found")
        d = dict(row)
        d["preferred_language"] = "en"
        return {**d, "role": "officer"}

    raise HTTPException(400, "Invalid role in token")


# ─── DISABLED OTP STUBS ───────────────────────────────────────────────────────
@router.post("/send-otp")
async def send_otp_disabled(body: dict):
    raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")

@router.post("/verify-otp")
async def verify_otp_disabled(body: dict):
    raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")

@router.post("/refresh-otp")
async def refresh_otp_disabled(body: dict):
    raise HTTPException(410, "OTP flow disabled. Use /register/citizen or /login/citizen.")