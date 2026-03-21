"""NagarMind Configuration"""
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    APP_NAME: str = "NagarMind"
    APP_ENV: str = "development"
    DEBUG: bool = True
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-fixed-key-for-dev-environment-only")
    
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/nagarmind")

    # Gemini API Keys (4 keys for rotation)
    GEMINI_API_KEY_1: str = ""
    GEMINI_API_KEY_2: str = ""
    GEMINI_API_KEY_3: str = ""
    GEMINI_API_KEY_4: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"

    # Sarvam AI Keys (4 keys for rotation)
    SARVAM_API_KEY_1: str = ""
    SARVAM_API_KEY_2: str = ""
    SARVAM_API_KEY_3: str = ""
    SARVAM_API_KEY_4: str = ""

    # Groq API Keys (4 keys for rotation) — used for chatbot + Whisper STT
    GROQ_API_KEY: str = ""
    GROQ_API_KEY_2: str = ""
    GROQ_API_KEY_3: str = ""
    GROQ_API_KEY_4: str = ""

    # Cloudflare R2
    CF_R2_ACCOUNT_ID: str = ""
    CF_R2_ACCESS_KEY_ID: str = ""
    CF_R2_SECRET_ACCESS_KEY: str = ""
    CF_R2_BUCKET_NAME: str = "nagarmind-photos"
    CF_R2_PUBLIC_URL: str = ""

    # SMS & Maps
    FAST2SMS_API_KEY: str = ""
    GOOGLE_MAPS_API_KEY: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"

    # OTP
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 3
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    @property
    def gemini_keys(self) -> List[str]:
        keys = [self.GEMINI_API_KEY_1, self.GEMINI_API_KEY_2, self.GEMINI_API_KEY_3, self.GEMINI_API_KEY_4]
        return [k for k in keys if k]

    @property
    def sarvam_keys(self) -> List[str]:
        keys = [self.SARVAM_API_KEY_1, self.SARVAM_API_KEY_2, self.SARVAM_API_KEY_3, self.SARVAM_API_KEY_4]
        return [k for k in keys if k]

    @property
    def groq_keys(self) -> List[str]:
        keys = [self.GROQ_API_KEY, self.GROQ_API_KEY_2, self.GROQ_API_KEY_3, self.GROQ_API_KEY_4]
        return [k for k in keys if k]

    @property
    def cors_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()