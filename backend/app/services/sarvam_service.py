"""
Sarvam AI Service — Translation + STT + TTS
Supports all 22 scheduled Indian languages for translation.
STT (Saarika v2.5): 12 languages with voice input.
4-key rotation via api_rotation module.
"""
import httpx
import logging
import asyncio
from typing import List, Optional
from app.core.api_rotation import get_sarvam_key, mark_sarvam_error

logger = logging.getLogger(__name__)

SARVAM_BASE = "https://api.sarvam.ai"

# ── Language map: short code → Sarvam BCP-47 ──────────────────────────────────
# All 22 scheduled Indian languages (Constitution of India)
LANGUAGE_MAP = {
    "en":  "en-IN",
    "hi":  "hi-IN",   # Hindi
    "bn":  "bn-IN",   # Bengali
    "ta":  "ta-IN",   # Tamil
    "te":  "te-IN",   # Telugu
    "mr":  "mr-IN",   # Marathi
    "gu":  "gu-IN",   # Gujarati
    "kn":  "kn-IN",   # Kannada
    "ml":  "ml-IN",   # Malayalam
    "pa":  "pa-IN",   # Punjabi
    "or":  "od-IN",   # Odia (Sarvam uses od-IN)
    "as":  "as-IN",   # Assamese
    "ur":  "ur-IN",   # Urdu
    "mai": "mai-IN",  # Maithili
    "kok": "kok-IN",  # Konkani
    "ne":  "ne-IN",   # Nepali
    "sd":  "sd-IN",   # Sindhi
    "doi": "doi-IN",  # Dogri
    "sa":  "sa-IN",   # Sanskrit
    "mni": "mni-IN",  # Manipuri (Meitei)
    "brx": "brx-IN",  # Bodo
    "ks":  "ks-IN",   # Kashmiri
}

# Languages where Sarvam STT (Saarika v2.5) has explicit voice support
# saaras:v2.5 auto-detects all Indian languages
STT_SUPPORTED = {
    "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "as", "en"
}


async def _translate_one(text: str, src_code: str, tgt_code: str, api_key: str) -> str:
    """
    Translate ONE string using Sarvam /translate.
    Sarvam takes a single string in 'input', returns 'translated_text'.
    """
    if not text or not text.strip():
        return text

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{SARVAM_BASE}/translate",
                headers={
                    "Content-Type": "application/json",
                    "api-subscription-key": api_key,
                },
                json={
                    "input": text,
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
            return data.get("translated_text", text)

    except Exception as e:
        logger.warning(f"Sarvam translate error: {e}")
        return text


async def translate_text(
    texts: List[str],
    target_lang: str,
    source_lang: str = "en",
) -> List[str]:
    """
    Translate a list of strings concurrently.
    Falls back to original on any error.
    """
    if not texts:
        return texts
    if source_lang == target_lang or target_lang == "en":
        return texts

    src_code = LANGUAGE_MAP.get(source_lang, "en-IN")
    tgt_code = LANGUAGE_MAP.get(target_lang, "hi-IN")
    api_key  = get_sarvam_key()

    semaphore = asyncio.Semaphore(5)

    async def limited_translate(text: str) -> str:
        async with semaphore:
            return await _translate_one(text, src_code, tgt_code, api_key)

    results = await asyncio.gather(*[limited_translate(t) for t in texts])
    return list(results)


async def translate_single(
    text: str,
    target_lang: str,
    source_lang: str = "en",
) -> str:
    """Translate a single string. Returns original on failure."""
    if source_lang == target_lang or target_lang == "en":
        return text
    src_code = LANGUAGE_MAP.get(source_lang, "en-IN")
    tgt_code = LANGUAGE_MAP.get(target_lang, "hi-IN")
    api_key  = get_sarvam_key()
    return await _translate_one(text, src_code, tgt_code, api_key)


async def speech_to_text(
    audio_bytes: bytes,
    language_hint: Optional[str] = None,
) -> dict:
    """
    Transcribe audio using Sarvam.
    - If language is in STT_SUPPORTED, uses Saarika v2.5 with explicit language code.
    - Otherwise, uses Saaras v2.5 which auto-detects the Indian language.
    Returns: {"transcript": str, "language_code": str, "confidence": float}
    """
    api_key = get_sarvam_key()

    # Choose model: saaras auto-detects, saarika needs explicit language
    use_saaras = (language_hint is None) or (language_hint not in STT_SUPPORTED)
    model = "saaras:v2.5" if use_saaras else "saarika:v2.5"

    try:
        form_data: dict = {"model": model, "with_timestamps": "false"}

        if not use_saaras and language_hint and language_hint in LANGUAGE_MAP:
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
                # Retry once with new key
                return await speech_to_text(audio_bytes, language_hint)

            resp.raise_for_status()
            data = resp.json()
            full_lang  = data.get("language_code", "hi-IN")
            short_lang = full_lang.split("-")[0]
            # Odia: od → or (our internal code)
            if short_lang == "od":
                short_lang = "or"

            return {
                "transcript":     data.get("transcript", ""),
                "language_code":  short_lang,
                "confidence":     data.get("confidence", 0.9),
            }

    except Exception as e:
        logger.error(f"Sarvam STT error: {e}")
        return {"transcript": "", "language_code": language_hint or "hi", "confidence": 0.0}


async def speech_to_text_from_url(
    audio_url: str,
    language_hint: Optional[str] = None,
) -> dict:
    """
    Download audio from URL then transcribe.
    Used by the /transcribe-url backend endpoint.
    """
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(audio_url)
            r.raise_for_status()
            audio_bytes = r.content
        return await speech_to_text(audio_bytes, language_hint)
    except Exception as e:
        logger.error(f"Failed to fetch audio from URL {audio_url}: {e}")
        return {"transcript": "", "language_code": language_hint or "hi", "confidence": 0.0}


async def text_to_speech(
    text: str,
    language: str = "hi",
    gender: str = "female",
) -> Optional[bytes]:
    """
    Convert text to speech using Sarvam Bulbul v2.
    Supported languages: hi, bn, ta, te, mr, gu, kn, ml, pa, or, en
    Returns audio bytes (WAV) or None on failure.
    """
    api_key   = get_sarvam_key()
    lang_code = LANGUAGE_MAP.get(language, "hi-IN")
    speaker   = "meera" if gender == "female" else "arjun"

    # TTS only supports 11 languages — fall back to Hindi for unsupported
    tts_supported = {"hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "en"}
    if language not in tts_supported:
        lang_code = "hi-IN"

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
                    "model": "bulbul:v2",
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