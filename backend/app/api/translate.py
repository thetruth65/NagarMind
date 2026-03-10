"""
Translation API — backend proxy for Sarvam AI.
Frontend calls this to translate UI strings on demand.
No auth required — translation is a public utility.

Sarvam /translate endpoint:
  - Input: single string (not a list)
  - Output: {"translated_text": "...", ...}
  - Supports: en-IN, hi-IN, bn-IN, ta-IN, te-IN, mr-IN, gu-IN, kn-IN, ml-IN, od-IN, pa-IN
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.services.sarvam_service import translate_text, translate_single

router = APIRouter(tags=["translate"])


class TranslateBatchRequest(BaseModel):
    texts: List[str]
    target_language: str   # Sarvam BCP-47 code: "hi-IN", "ta-IN", etc.
    source_language: str = "en-IN"


class TranslateSingleRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = "en-IN"


@router.post("/batch")
async def translate_batch(body: TranslateBatchRequest):
    """
    Translate a batch of UI strings to target language.
    Frontend sends all visible strings at once.
    Maps Sarvam codes back (e.g. 'hi-IN' → short 'hi' for service).
    """
    if not body.texts:
        return {"translations": [], "target_language": body.target_language}

    # Convert Sarvam BCP-47 → our short code for sarvam_service
    def to_short(code: str) -> str:
        # "hi-IN" → "hi", "od-IN" → "or"
        short = code.split("-")[0]
        if short == "od":
            return "or"
        return short

    target_short = to_short(body.target_language)
    source_short = to_short(body.source_language)

    translated = await translate_text(body.texts, target_short, source_short)
    return {"translations": translated, "target_language": body.target_language}


# @router.post("/single")
# async def translate_one(body: TranslateSingleRequest):
#     """Translate a single string."""
#     def to_short(code: str) -> str:
#         short = code.split("-")[0]
#         return "or" if short == "od" else short

#     target_short = to_short(body.target_language)
#     source_short = to_short(body.source_language)

#     result = await translate_single(body.text, target_short, source_short)
#     return {"translated": result, "target_language": body.target_language}

# In translate_one(), after the Sarvam call fails or returns original:
@router.post("/single")
async def translate_one(body: TranslateSingleRequest):
    def to_short(code: str) -> str:
        short = code.split("-")[0]
        return "or" if short == "od" else short

    target_short = to_short(body.target_language)
    source_short = to_short(body.source_language)

    # Try Sarvam first
    result = await translate_single(body.text, target_short, source_short)
    
    # If Sarvam returned unchanged text (likely failed), try Gemini
    if result == body.text and source_short != target_short:
        from app.services.gemini_service import translate_with_gemini
        result = await translate_with_gemini(body.text, source_short, target_short)
    
    return {"translated": result, "target_language": body.target_language}