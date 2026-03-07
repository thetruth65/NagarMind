"""
Sarvam AI Service — Translation + STT + TTS
Fixed: Sarvam /translate takes ONE string per call (not a list).
       Response field is 'translated_text' (string), not an array.
4-key rotation via api_rotation module.
Supports 11 Indian languages.
"""
import httpx
import logging
import asyncio
from typing import List, Optional
from app.core.api_rotation import get_sarvam_key, mark_sarvam_error

logger = logging.getLogger(__name__)

SARVAM_BASE = "https://api.sarvam.ai"

# Our short code → Sarvam BCP-47 code
# Sarvam supports all 22 scheduled Indian languages
LANGUAGE_MAP = {
    "en":  "en-IN",
    "hi":  "hi-IN",
    "bn":  "bn-IN",
    "ta":  "ta-IN",
    "te":  "te-IN",
    "mr":  "mr-IN",
    "gu":  "gu-IN",
    "kn":  "kn-IN",
    "ml":  "ml-IN",
    "or":  "od-IN",   # Sarvam uses od-IN for Odia
    "pa":  "pa-IN",
    "ur":  "ur-IN",
    "as":  "as-IN",
    "mai": "mai-IN",
    "kok": "kok-IN",
    "ne":  "ne-IN",
    "sd":  "sd-IN",
    "doi": "doi-IN",
    "sa":  "sa-IN",
    "ks":  "ks-IN",
}

# Languages that Sarvam STT/TTS supports (subset — for voice features)
VOICE_SUPPORTED = {
    "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or"
}


async def _translate_one(text: str, src_code: str, tgt_code: str, api_key: str) -> str:
    """
    Translate ONE string using Sarvam /translate endpoint.
    Sarvam API takes a single string in 'input', returns 'translated_text'.
    """
    if not text or not text.strip():
        return text

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{SARVAM_BASE}/translate",
                headers={
                    "Content-Type": "application/json",
                    "api-subscription-key": api_key,  # correct header name
                },
                json={
                    "input": text,                    # single string, NOT a list
                    "source_language_code": src_code,
                    "target_language_code": tgt_code,
                    "speaker_gender": "Female",
                    "mode": "formal",
                    "model": "mayura:v1",
                    "enable_preprocessing": True,
                },
            )
            if resp.status_code == 429:
                mark_sarvam_error(api_key)
                raise Exception("Rate limited")

            resp.raise_for_status()
            data = resp.json()
            # Sarvam returns: {"translated_text": "...", "source_language_code": "...", ...}
            return data.get("translated_text", text)

    except Exception as e:
        logger.warning(f"Sarvam translate error for '{text[:30]}...': {e}")
        return text  # fallback to original


async def translate_text(
    texts: List[str],
    target_lang: str,
    source_lang: str = "en",
) -> List[str]:
    """
    Translate a list of strings. Calls Sarvam once per string concurrently.
    Falls back to original text on any error.
    """
    if not texts:
        return texts

    # No translation needed for English or same language
    if source_lang == target_lang or target_lang == "en":
        return texts

    src_code = LANGUAGE_MAP.get(source_lang, "en-IN")
    tgt_code = LANGUAGE_MAP.get(target_lang, "hi-IN")
    api_key = get_sarvam_key()

    # Translate all strings concurrently (with max 5 concurrent to avoid rate limits)
    semaphore = asyncio.Semaphore(5)

    async def limited_translate(text: str) -> str:
        async with semaphore:
            return await _translate_one(text, src_code, tgt_code, api_key)

    results = await asyncio.gather(
        *[limited_translate(t) for t in texts],
        return_exceptions=False,
    )

    return list(results)


async def translate_single(text: str, target_lang: str, source_lang: str = "en") -> str:
    """Translate a single string."""
    if source_lang == target_lang or target_lang == "en":
        return text

    src_code = LANGUAGE_MAP.get(source_lang, "en-IN")
    tgt_code = LANGUAGE_MAP.get(target_lang, "hi-IN")
    api_key = get_sarvam_key()
    return await _translate_one(text, src_code, tgt_code, api_key)


async def speech_to_text(
    audio_bytes: bytes,
    language_hint: Optional[str] = None,
) -> dict:
    """
    Transcribe audio to text using Sarvam Saarika v2.5.
    Auto-detects Indian language if no hint given.
    Returns: {"transcript": str, "language_code": str, "confidence": float}
    """
    api_key = get_sarvam_key()

    try:
        form_data = {
            "model": "saarika:v2.5",
            "with_timestamps": "false",
        }
        if language_hint and language_hint in LANGUAGE_MAP:
            form_data["language_code"] = LANGUAGE_MAP[language_hint]

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SARVAM_BASE}/speech-to-text",
                headers={"api-subscription-key": api_key},
                files={"file": ("audio.wav", audio_bytes, "audio/wav")},
                data=form_data,
            )
            if resp.status_code == 429:
                mark_sarvam_error(api_key)
                return await speech_to_text(audio_bytes, language_hint)

            resp.raise_for_status()
            data = resp.json()
            full_lang = data.get("language_code", "hi-IN")
            short_lang = full_lang.split("-")[0]
            return {
                "transcript": data.get("transcript", ""),
                "language_code": short_lang,
                "confidence": data.get("confidence", 0.9),
            }
    except Exception as e:
        logger.error(f"Sarvam STT error: {e}")
        return {"transcript": "", "language_code": "hi", "confidence": 0.0}


async def text_to_speech(
    text: str,
    language: str = "hi",
    gender: str = "female",
) -> Optional[bytes]:
    """
    Convert text to speech for officer notifications.
    Returns audio bytes (WAV) or None on failure.
    """
    api_key = get_sarvam_key()
    lang_code = LANGUAGE_MAP.get(language, "hi-IN")
    speaker = "meera" if gender == "female" else "arjun"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{SARVAM_BASE}/text-to-speech",
                headers={"api-subscription-key": api_key},
                json={
                    "inputs": [text[:500]],
                    "target_language_code": lang_code,
                    "speaker": speaker,
                    "pitch": 0,
                    "pace": 1.0,
                    "loudness": 1.5,
                    "model": "bulbul:v2",  # Updated to v2
                },
            )
            resp.raise_for_status()
            data = resp.json()
            import base64
            audio_b64 = data.get("audios", [""])[0]
            return base64.b64decode(audio_b64) if audio_b64 else None
    except Exception as e:
        logger.error(f"Sarvam TTS error: {e}")
        return None