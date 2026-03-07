from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID


class ComplaintCreateRequest(BaseModel):
    title: str
    description: str
    category: Optional[str] = None  # User-selected category (can be overridden by AI)
    original_language: str = "en"
    location_address: str
    location_lat: float
    location_lng: float
    photos: List[str] = []
    voice_audio_url: Optional[str] = None
    voice_transcript: Optional[str] = None

    @field_validator("title")
    @classmethod
    def val_title(cls, v):
        if len(v.strip()) < 5:
            raise ValueError("Title too short")
        return v.strip()[:200]

    @field_validator("description")
    @classmethod
    def val_desc(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Description too short")
        return v.strip()[:2000]

    @field_validator("photos")
    @classmethod
    def val_photos(cls, v):
        return v[:5]  # max 5 photos


class StatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None
    photos_added: List[str] = []

    @field_validator("status")
    @classmethod
    def val_status(cls, v):
        allowed = {"acknowledged", "in_progress", "resolved", "closed"}
        if v not in allowed:
            raise ValueError(f"Status must be one of {allowed}")
        return v


class DisputeRequest(BaseModel):
    reason: str
    dispute_photos: List[str] = []

    @field_validator("reason")
    @classmethod
    def val_reason(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Please describe the dispute in more detail")
        return v.strip()


class RatingRequest(BaseModel):
    rating: int
    feedback: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def val_rating(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Rating must be 1-5")
        return v