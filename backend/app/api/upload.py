"""
Upload API — NagarMind (NO R2 VERSION)
Photos → base64 data URIs stored directly in DB.
Audio  → bytes received, transcribed via Groq Whisper, returned immediately.

No external storage service required. Zero config.

Routes:
  POST /api/upload/photo          → base64 encode a photo, return data URI
  POST /api/upload/photos/batch   → encode up to 5 photos at once
  POST /api/upload/audio          → receive audio, transcribe via Groq, return transcript + data URI
"""

import base64
import logging
import os
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from app.middleware.auth_middleware import require_any

router = APIRouter(tags=["upload"])
logger = logging.getLogger(__name__)

# Max sizes
MAX_PHOTO_BYTES = 5 * 1024 * 1024   # 5 MB per photo
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB audio

ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/heic", "image/heif",
}


# ─── SINGLE PHOTO UPLOAD ──────────────────────────────────────────────────────
@router.post("/photo")
async def upload_photo(
    file: UploadFile = File(...),
    payload=Depends(require_any),
):
    """
    Receive a photo, return base64 data URI.
    Frontend stores this string in complaint photo_urls[].
    """
    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, f"Invalid image type: {content_type}. Allowed: jpeg, png, webp")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Empty file")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(400, f"Photo too large. Max 5 MB, got {len(data) // 1024} KB")

    # Encode to base64 data URI
    b64 = base64.b64encode(data).decode("utf-8")
    data_uri = f"data:{content_type};base64,{b64}"

    logger.info(f"Photo encoded: {len(data)} bytes → {len(data_uri)} char data URI")
    return {
        "public_url": data_uri,
        "key": f"base64:{file.filename}",
        "size_bytes": len(data),
        "storage": "base64",
    }


# ─── BATCH PHOTO UPLOAD ────────────────────────────────────────────────────────
@router.post("/photos/batch")
async def upload_photos_batch(
    files: List[UploadFile] = File(...),
    payload=Depends(require_any),
):
    """
    Upload up to 5 photos at once.
    Returns list of data URIs in same order.
    """
    if len(files) > 5:
        raise HTTPException(400, "Maximum 5 photos allowed")

    results = []
    for file in files:
        content_type = file.content_type or "image/jpeg"
        if content_type not in ALLOWED_IMAGE_TYPES:
            results.append({"error": f"Invalid type: {content_type}", "public_url": None})
            continue

        data = await file.read()
        if len(data) == 0 or len(data) > MAX_PHOTO_BYTES:
            results.append({"error": "File empty or too large", "public_url": None})
            continue

        b64 = base64.b64encode(data).decode("utf-8")
        data_uri = f"data:{content_type};base64,{b64}"
        results.append({
            "public_url": data_uri,
            "key": f"base64:{file.filename}",
            "size_bytes": len(data),
            "storage": "base64",
        })

    return {"photos": results, "count": len(results)}


# ─── AUDIO UPLOAD + TRANSCRIPTION ─────────────────────────────────────────────
@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    language_hint: Optional[str] = Form(None),
    payload=Depends(require_any),
):
    """
    Receive audio blob from browser, transcribe via Groq Whisper immediately.
    Returns transcript + base64 audio data URI (so it can be played back / stored).
    No R2. No external storage hop.
    """
    audio_bytes = await file.read()

    if len(audio_bytes) == 0:
        raise HTTPException(400, "Empty audio file — nothing was recorded")
    if len(audio_bytes) < 500:
        raise HTTPException(400, "Audio too short — please speak for at least 1 second")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(400, f"Audio too large. Max 10 MB, got {len(audio_bytes) // 1024} KB")

    # Detect content type
    content_type = file.content_type or "audio/webm"
    # Map to file extension for Groq
    ext_map = {
        "audio/webm": "webm",
        "audio/ogg":  "ogg",
        "audio/mp4":  "mp4",
        "audio/wav":  "wav",
        "audio/mpeg": "mp3",
        "audio/m4a":  "m4a",
    }
    ext = ext_map.get(content_type, "webm")

    # Transcribe via Groq Whisper
    transcript = ""
    transcription_error = None
    from app.core.config import settings
    
    groq_key = settings.GROQ_API_KEY
    #groq_key = os.getenv("GROQ_API_KEY", "")
    if groq_key:
        try:
            from groq import Groq

            # Write to temp file (Groq SDK needs file object)
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                client = Groq(api_key=groq_key)
                lang = language_hint[:2] if language_hint else None

                with open(tmp_path, "rb") as f:
                    result = client.audio.transcriptions.create(
                        file=(f"voice.{ext}", f, content_type),
                        model="whisper-large-v3",
                        language=lang,
                        response_format="text",
                    )
                transcript = result if isinstance(result, str) else (result.text or "")
                transcript = transcript.strip()
                logger.info(f"Groq transcription: {len(transcript)} chars, lang={lang}")
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            transcription_error = str(e)
            logger.warning(f"Groq transcription failed: {e}")
    else:
        transcription_error = "GROQ_API_KEY not configured"
        logger.warning("GROQ_API_KEY not set — skipping transcription")

    # Encode audio as base64 data URI for storage/playback
    b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
    audio_data_uri = f"data:{content_type};base64,{b64_audio}"

    return {
        "transcript":   transcript,
        "language":     language_hint,
        "public_url":   audio_data_uri,   # stored as data URI in complaints.audio_url
        "key":          f"base64:audio.{ext}",
        "size_bytes":   len(audio_bytes),
        "storage":      "base64",
        "transcription_error": transcription_error,
    }


# ─── LEGACY PRESIGN STUB (returns error with helpful message) ─────────────────
@router.post("/presign")
async def presign_disabled(body: dict, payload=Depends(require_any)):
    """R2 presigned URLs removed. Use /api/upload/photo instead."""
    raise HTTPException(
        410,
        "R2 presigned URLs are disabled. "
        "POST the file directly to /api/upload/photo (multipart/form-data)."
    )