"""Pydantic schemas for auth endpoints."""
from pydantic import BaseModel, field_validator
from typing import Optional
import re


class SendOTPRequest(BaseModel):
    phone: str
    role: str = "citizen"
    language: str = "en"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        digits = re.sub(r"\D", "", v)
        if digits.startswith("91"):
            digits = digits[2:]
        if len(digits) != 10:
            raise ValueError("Phone must be 10 digits")
        if digits[0] not in "6789":
            raise ValueError("Invalid Indian mobile number")
        return f"+91{digits}"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("citizen", "officer"):
            raise ValueError("role must be citizen or officer")
        return v


class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    role: str = "citizen"

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v):
        digits = re.sub(r"\D", "", v)
        if digits.startswith("91"):
            digits = digits[2:]
        return f"+91{digits}"

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be 6 digits")
        return v


class CitizenRegisterRequest(BaseModel):
    phone: str
    full_name: str
    ward_id: int
    preferred_language: str = "en"
    home_address: Optional[str] = None
    temp_token: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Name too short")
        return v.strip()


class OfficerRegisterRequest(BaseModel):
    phone: str
    full_name: str
    employee_id: str
    designation: str
    department: str
    ward_id: Optional[int] = None
    zone: Optional[str] = None
    password: str
    preferred_language: str = "en"
    temp_token: Optional[str] = None

    @field_validator("employee_id")
    @classmethod
    def validate_employee_id(cls, v):
        if len(v) < 4:
            raise ValueError("Employee ID too short")
        return v.upper().strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    full_name: str
    is_new_user: bool = False


class OTPResponse(BaseModel):
    success: bool
    message: str
    expires_in_seconds: int
    can_resend_after: int
    # Only populated in development mode — null in production
    otp_preview: Optional[str] = None