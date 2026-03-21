"""
NagarMind v3 — Chatbot API Route
Supports:
  POST /api/chatbot/message     → Send message, get reply + extracted state
  GET  /api/chatbot/state/:id   → Get current extracted fields (for split-screen preview)
  DELETE /api/chatbot/session/:id → Clear session
  POST /api/chatbot/transcribe  → Transcribe audio via Groq Whisper (4-key rotation)
"""

import logging
import tempfile
import os
import base64
import threading
import time
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.config import settings
from app.middleware.auth_middleware import require_citizen
from app.services.complaint_pipeline import run_pipeline
from app.services.chatbot_agent import chat_with_agent, clear_session, get_session_state

router = APIRouter(tags=["chatbot"])
logger = logging.getLogger(__name__)

_submitted: set[str] = set()


# ─── Groq Whisper Key Rotator ─────────────────────────────────────────────────

class WhisperKeyRotator:
    """Thread-safe rotator for Groq Whisper STT."""
    def __init__(self):
        self._lock = threading.Lock()
        self._index = 0
        self._error_until: dict[int, float] = {}
        self._cooldown = 65

    def _keys(self) -> List[str]:
        raw = [
            settings.GROQ_API_KEY,
            getattr(settings, "GROQ_API_KEY_2", ""),
            getattr(settings, "GROQ_API_KEY_3", ""),
            getattr(settings, "GROQ_API_KEY_4", ""),
        ]
        return [k for k in raw if k]

    def get(self) -> str:
        with self._lock:
            keys = self._keys()
            if not keys:
                return ""
            now = time.time()
            for _ in range(len(keys)):
                idx = self._index % len(keys)
                self._index += 1
                if now >= self._error_until.get(idx, 0):
                    return keys[idx]
            return keys[0]

    def mark_bad(self, key: str):
        with self._lock:
            keys = self._keys()
            if key in keys:
                self._error_until[keys.index(key)] = time.time() + self._cooldown


_whisper_rotator = WhisperKeyRotator()


# ─── Request/Response Models ──────────────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    message: str
    thread_id: str
    language: str = "en"
    latitude: float = 28.6139
    longitude: float = 77.2090


class ChatMessageResponse(BaseModel):
    reply: str
    stage: str
    complaint_id: Optional[str] = None
    extracted: Optional[dict] = None


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatMessageResponse)
async def chat_message(
    body: ChatMessageRequest,
    background_tasks: BackgroundTasks,
    payload=Depends(require_citizen),
    pool=Depends(get_db),
):
    citizen_id = str(payload["sub"])

    citizen = await pool.fetchrow(
        "SELECT ward_id FROM citizens WHERE citizen_id=$1", citizen_id
    )
    if not citizen:
        raise HTTPException(404, "Citizen not found")

    result = await chat_with_agent(
        thread_id=body.thread_id,
        user_message=body.message,
        citizen_id=citizen_id,
        ward_id=citizen["ward_id"],
        language=body.language,
        latitude=body.latitude,
        longitude=body.longitude,
    )

    complaint_id = None

    if (
        result["stage"] == "submitted"
        and result.get("complaint_payload")
        and body.thread_id not in _submitted
    ):
        _submitted.add(body.thread_id)
        cp = result["complaint_payload"]

        try:
            cid = await pool.fetchval(
                """INSERT INTO complaints
                   (citizen_id, ward_id, title, description,
                    category, latitude, longitude, address,
                    photo_urls, voice_transcript, status, submitted_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}',NULL,'submitted',NOW())
                   RETURNING complaint_id""",
                citizen_id, citizen["ward_id"],
                cp.get("title", "Civic Issue"),
                cp.get("description", ""),
                cp.get("category", "other"),
                cp.get("location_lat", 28.6139),
                cp.get("location_lng", 77.2090),
                cp.get("location_address", ""),
            )
            complaint_id = str(cid)

            await pool.execute(
                """INSERT INTO complaint_status_history
                   (complaint_id, old_status, new_status, changed_by, changed_by_role, note)
                   VALUES ($1, NULL, 'submitted', $2, 'citizen', 'Submitted via AI chatbot')""",
                complaint_id, citizen_id,
            )

            citizen_row = await pool.fetchrow(
                "SELECT phone_number FROM citizens WHERE citizen_id=$1", citizen_id
            )
            from app.services.notification_service import notify_citizen
            if citizen_row:
                await notify_citizen(
                    pool, citizen_id, citizen_row["phone_number"],
                    complaint_id, "complaint_submitted",
                    "Complaint Submitted ✓",
                    f"Your complaint '{cp.get('title')}' has been received. AI is classifying it now.",
                    language=body.language, send_sms=False,
                )

            background_tasks.add_task(run_pipeline, pool, complaint_id)
            logger.info(f"Chatbot complaint submitted: {complaint_id}")

        except Exception as e:
            logger.error(f"Chatbot DB insert failed: {e}")
            _submitted.discard(body.thread_id)

    return ChatMessageResponse(
        reply=result["reply"],
        stage=result["stage"],
        complaint_id=complaint_id,
        extracted=result.get("extracted"),
    )


@router.get("/state/{thread_id}")
async def get_chat_state(thread_id: str, payload=Depends(require_citizen)):
    """Return current extracted fields for split-screen live preview."""
    state = get_session_state(thread_id)
    if not state:
        return {
            "title": None,
            "description": None,
            "category": None,
            "address": None,
            "stage": "greeting",
        }
    return state


@router.post("/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    language_hint: Optional[str] = Form(None),
    payload=Depends(require_citizen),
):
    """
    Transcribe audio via Groq Whisper with 4-key rotation.
    Best free model: whisper-large-v3 (fastest, most accurate).
    """
    audio_bytes = await file.read()

    if len(audio_bytes) < 500:
        raise HTTPException(400, "Audio too short — please speak for at least 1 second")
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio too large — max 25MB")

    content_type = file.content_type or "audio/webm"
    ext_map = {
        "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4",
        "audio/wav": "wav", "audio/mpeg": "mp3", "audio/m4a": "m4a",
        "audio/x-m4a": "m4a",
    }
    ext = ext_map.get(content_type, "webm")

    # Try transcription with key rotation (max 4 attempts)
    transcript = ""
    for attempt in range(4):
        key = _whisper_rotator.get()
        if not key:
            raise HTTPException(500, "No Groq API keys configured")

        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            from groq import Groq
            client = Groq(api_key=key)
            lang = language_hint[:2] if language_hint and language_hint != "en" else None

            with open(tmp_path, "rb") as f:
                result = client.audio.transcriptions.create(
                    file=(f"voice.{ext}", f, content_type),
                    model="whisper-large-v3",
                    language=lang,
                    response_format="text",
                    temperature=0.0,
                )

            transcript = result if isinstance(result, str) else (result.text or "")
            transcript = transcript.strip()
            logger.info(f"Whisper transcribed {len(transcript)} chars (lang={lang}, key_attempt={attempt+1})")
            break

        except Exception as e:
            err = str(e)
            logger.warning(f"Whisper attempt {attempt+1} failed: {err}")
            if "429" in err or "rate" in err.lower():
                _whisper_rotator.mark_bad(key)
                import asyncio
                await asyncio.sleep(1)
            else:
                # Non-rate-limit error, don't retry with different key
                raise HTTPException(500, f"Transcription failed: {e}")
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    if not transcript:
        raise HTTPException(422, "Could not transcribe audio. Please speak clearly or type your message.")

    return {
        "transcript": transcript,
        "language": language_hint,
    }


@router.delete("/session/{thread_id}")
async def clear_chat_session(thread_id: str, payload=Depends(require_citizen)):
    clear_session(thread_id)
    _submitted.discard(thread_id)
    return {"cleared": True}