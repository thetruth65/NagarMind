"""
NagarMind security utilities — JWT, password hashing, OTP
Uses direct `bcrypt` library instead of passlib to avoid bcrypt v4.x breakage.
"""
import bcrypt
import random
import string
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings


# ─── PASSWORD (direct bcrypt, no passlib) ─────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password with bcrypt rounds=12. Input must be ≤72 bytes (bcrypt limit)."""
    pw_bytes = password.encode("utf-8")[:72]   # bcrypt hard limit
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Check plain password against bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8")[:72],
            hashed.encode("utf-8"),
        )
    except Exception:
        return False


# ─── OTP ──────────────────────────────────────────────────────────────────────

def generate_otp(length: int = None) -> str:
    n = length or settings.OTP_LENGTH
    return "".join(random.choices(string.digits, k=n))


def hash_otp(otp: str, phone: str) -> str:
    """HMAC-style OTP hash — never store plain OTP."""
    return hashlib.sha256(
        f"{otp}:{phone}:{settings.SECRET_KEY}".encode()
    ).hexdigest()


def verify_otp_hash(otp: str, phone: str, stored_hash: str) -> bool:
    return hash_otp(otp, phone) == stored_hash


# ─── JWT ──────────────────────────────────────────────────────────────────────

def create_token(data: dict, role: str, expire_minutes: int = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expire_minutes or settings.JWT_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "role": role})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        return None


# ─── PHONE ────────────────────────────────────────────────────────────────────

def normalize_phone(phone: str) -> str:
    digits = "".join(filter(str.isdigit, phone))
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+91{digits}"
    return f"+{digits}"