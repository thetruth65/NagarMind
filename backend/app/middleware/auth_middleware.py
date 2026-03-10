"""
Auth Middleware — NagarMind
"""

import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings   # ✅ FIX: use same settings as security.py

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


def _decode_token(credentials: HTTPAuthorizationCredentials) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        # ✅ FIX: settings.SECRET_KEY — same key used in create_token() in security.py
        return jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as e:
        logger.debug(f"JWT error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_citizen(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = _decode_token(credentials)
    if payload.get("role") != "citizen":
        raise HTTPException(403, "Citizen access required")
    return payload


def require_officer(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = _decode_token(credentials)
    if payload.get("role") not in ("officer", "admin"):
        raise HTTPException(403, "Officer access required")
    return payload


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = _decode_token(credentials)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return payload


def require_any(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = _decode_token(credentials)
    if payload.get("role") not in ("citizen", "officer", "admin"):
        raise HTTPException(403, "Valid authentication required")
    return payload