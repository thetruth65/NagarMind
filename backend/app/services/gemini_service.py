"""
Gemini 1.5 Flash Service — All AI agents use this.
4-key rotation. Model: gemini-1.5-flash (15 RPM, 1500 RPD per key = 6000 RPD total).
"""
import google.generativeai as genai
import logging
import json
import re
from app.core.api_rotation import get_gemini_key, mark_gemini_error
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_model():
    """Get a configured Gemini model with current rotation key."""
    key = get_gemini_key()
    genai.configure(api_key=key)
    return genai.GenerativeModel(settings.GEMINI_MODEL), key


async def gemini_generate(prompt: str, expect_json: bool = False) -> str:
    """
    Core Gemini call with error handling + key rotation.
    Returns raw text response.
    """
    import asyncio
    model, key = _get_model()

    try:
        # Gemini SDK is sync — run in executor
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=1024,
                    response_mime_type="application/json" if expect_json else "text/plain",
                ),
            ),
        )
        return response.text

    except Exception as e:
        err_str = str(e).lower()
        if "quota" in err_str or "429" in err_str or "rate" in err_str:
            logger.warning(f"Gemini key quota hit — rotating: {e}")
            mark_gemini_error(key)
            # Retry once with a different key
            return await gemini_generate(prompt, expect_json)
        logger.error(f"Gemini error: {e}")
        raise


async def classify_complaint(
    title: str,
    description: str,
    ward_name: str,
    photo_count: int = 0,
) -> dict:
    """Agent 1: Classify complaint category, urgency, department."""
    prompt = f"""You are an MCD Delhi municipal complaint classifier.

Complaint Title: {title}
Complaint Description: {description}
Ward: {ward_name}, Delhi
Photos attached: {photo_count}

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "category": "<pothole|garbage|sewage|water_supply|streetlight|tree|stray_animals|encroachment|noise|other>",
  "sub_category": "<specific issue, max 5 words>",
  "department": "<responsible MCD department>",
  "urgency": "<low|medium|high|critical>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>"
}}

Urgency: critical=safety risk/flooding, high=major issue/affects many, medium=standard, low=cosmetic"""

    try:
        raw = await gemini_generate(prompt, expect_json=True)
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Classification failed: {e}")
        return {
            "category": "other", "sub_category": "unclassified",
            "department": "General Department", "urgency": "medium",
            "confidence": 0.3, "reasoning": "Auto-classification failed"
        }


async def generate_officer_summary(
    title: str, description: str, category: str,
    urgency: str, address: str, ward_name: str
) -> str:
    """Agent 2: Generate 2-3 sentence officer briefing."""
    prompt = f"""Write a 2-3 sentence briefing for an MCD field officer.
Complaint: {title} — {description}
Category: {category} | Urgency: {urgency}
Location: {address}, {ward_name}
Be specific, direct, and suggest first action. Max 60 words."""
    try:
        return await gemini_generate(prompt)
    except Exception:
        return f"{urgency.upper()} complaint: {title} at {address}. Requires immediate attention."


async def analyze_dispute(
    complaint_desc: str, resolution_notes: str,
    dispute_reason: str, days_since_resolution: int
) -> dict:
    """Agent 4: Analyze a citizen dispute objectively."""
    prompt = f"""Analyze this civic complaint dispute objectively.

Original complaint: {complaint_desc}
Officer's resolution claim: {resolution_notes}
Days since "resolution": {days_since_resolution}
Citizen's dispute reason: {dispute_reason}

Respond ONLY with JSON:
{{
  "merit_score": <0-100>,
  "analysis": "<2-3 sentences objective assessment>",
  "recommendation": "<uphold_dispute|reject_dispute|needs_reinspection>",
  "key_evidence": "<strongest evidence either way>"
}}"""
    try:
        raw = await gemini_generate(prompt, expect_json=True)
        return json.loads(raw)
    except Exception:
        return {"merit_score": 50, "analysis": "Manual review required.",
                "recommendation": "needs_reinspection", "key_evidence": "Insufficient data"}


async def generate_weekly_digest(ward_name: str, stats: dict) -> str:
    """Agent 5: Generate ward weekly digest narrative."""
    prompt = f"""Write a weekly civic report for Ward {ward_name}, Delhi.
Audience: Ward councillor and MCD senior officers.

Stats:
- Complaints: {stats.get('total', 0)} received, {stats.get('resolved', 0)} resolved ({stats.get('resolution_rate', 0):.0f}%)
- Avg resolution time: {stats.get('avg_hours', 0):.0f} hours
- Top category: {stats.get('top_category', 'N/A')}
- Citizen satisfaction: {stats.get('avg_rating', 0):.1f}/5
- Ward Health Score: {stats.get('score_end', 0):.1f} (was {stats.get('score_start', 0):.1f})
- Still overdue: {stats.get('overdue', 0)}

Write:
1. 3-sentence executive summary
2. Three key achievements (bullet points)
3. Two main concerns
4. One recommendation

Max 250 words. Professional, honest, specific."""
    try:
        return await gemini_generate(prompt)
    except Exception:
        return f"Week summary for {ward_name}: {stats.get('resolved', 0)} complaints resolved."


async def translate_with_gemini(text: str, source_lang: str, target_lang: str = "en") -> str:
    """Translate text using Gemini. More reliable than Sarvam for Indian→English."""
    if source_lang == target_lang:
        return text
    
    lang_names = {
        "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
        "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam",
        "pa": "Punjabi", "or": "Odia", "en": "English",
    }
    src_name = lang_names.get(source_lang, source_lang)
    tgt_name = lang_names.get(target_lang, target_lang)

    prompt = f"""Translate the following {src_name} text to {tgt_name}.
Return ONLY the translated text, no explanation, no quotes.

Text: {text}"""
    try:
        return (await gemini_generate(prompt)).strip()
    except Exception as e:
        logger.error(f"Gemini translation failed: {e}")
        return text  # fallback to original