"""
NagarMind — Groq Translation Service
Uses Groq LLaMA 3.3-70b as a fast, free alternative for:
1. Translation (when Sarvam fails or for unsupported languages)
2. Text classification fallback
3. Summary generation fallback

4-key rotation — same pattern as chatbot_agent.py.
"""
import json
import logging
import httpx
import threading
import time
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

# ── Key rotator (same as chatbot_agent.py) ────────────────────────────────────

class _GroqRotator:
    def __init__(self):
        self._lock  = threading.Lock()
        self._idx   = 0
        self._bad:  dict[int, float] = {}
        self._cool  = 65

    def _keys(self) -> List[str]:
        raw = [
            settings.GROQ_API_KEY,
            getattr(settings, "GROQ_API_KEY_2", ""),
            getattr(settings, "GROQ_API_KEY_3", ""),
            getattr(settings, "GROQ_API_KEY_4", ""),
        ]
        return [k.strip() for k in raw if k and k.strip()]

    def get(self) -> Optional[str]:
        with self._lock:
            keys = self._keys()
            if not keys:
                return None
            now = time.time()
            for _ in range(len(keys)):
                idx = self._idx % len(keys)
                self._idx += 1
                if now >= self._bad.get(idx, 0):
                    return keys[idx]
            return keys[0]

    def mark_bad(self, key: str):
        with self._lock:
            keys = self._keys()
            if key in keys:
                self._bad[keys.index(key)] = time.time() + self._cool

    def count(self) -> int:
        return len(self._keys())


_rotator = _GroqRotator()


async def _groq_call(system: str, user_prompt: str, max_tokens: int = 400) -> Optional[str]:
    """Single Groq call with key rotation and rate-limit handling."""
    for attempt in range(4):
        key = _rotator.get()
        if not key:
            logger.error("No Groq API keys configured for translation service")
            return None
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    GROQ_URL,
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user",   "content": user_prompt},
                        ],
                        "temperature": 0.1,
                        "max_tokens":  max_tokens,
                    },
                )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"].strip()
            if resp.status_code == 429:
                _rotator.mark_bad(key)
                import asyncio
                await asyncio.sleep(min(2 ** attempt, 8))
                continue
            logger.warning(f"Groq translation HTTP {resp.status_code}")
        except httpx.TimeoutException:
            logger.warning(f"Groq translation timeout attempt {attempt + 1}")
            import asyncio
            await asyncio.sleep(1)
        except Exception as e:
            logger.warning(f"Groq translation error attempt {attempt + 1}: {e}")
            import asyncio
            await asyncio.sleep(1)
    return None


# ── Public API ────────────────────────────────────────────────────────────────

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil",
    "te": "Telugu", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi", "or": "Odia", "as": "Assamese",
    "ur": "Urdu", "mai": "Maithili", "kok": "Konkani", "ne": "Nepali",
}


async def translate_with_groq(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translate text using Groq LLaMA.
    Falls back to original text on failure.
    Faster than Sarvam for short strings; good for non-STT languages.
    """
    if not text.strip() or source_lang == target_lang:
        return text
    if _rotator.count() == 0:
        return text

    src_name = LANGUAGE_NAMES.get(source_lang, source_lang)
    tgt_name = LANGUAGE_NAMES.get(target_lang, target_lang)

    system = (
        f"You are a precise translation engine. Translate the following {src_name} text to {tgt_name}. "
        "Return ONLY the translated text — no explanation, no quotes, no markdown."
    )

    result = await _groq_call(system, text, max_tokens=500)
    if result:
        return result
    logger.warning(f"Groq translation failed: {source_lang}→{target_lang}")
    return text


async def classify_with_groq(title: str, description: str, ward_name: str) -> dict:
    """
    Classify complaint using Groq — faster free-tier alternative to Gemini.
    Returns same shape as gemini_service.classify_complaint().
    """
    if _rotator.count() == 0:
        return _default_classification()

    system = """You are an MCD Delhi complaint classifier. Classify the complaint into JSON.
Return ONLY valid JSON, no markdown, no explanation."""

    prompt = f"""Complaint: {title}
Description: {description}
Ward: {ward_name}, Delhi

Classify into this exact JSON:
{{
  "category": "<pothole|garbage|sewage|water_supply|streetlight|tree|stray_animals|encroachment|noise|other>",
  "sub_category": "<specific issue max 5 words>",
  "department": "<MCD department>",
  "urgency": "<low|medium|high|critical>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>"
}}

Urgency: critical=safety/flooding, high=major issue, medium=standard, low=cosmetic"""

    result = await _groq_call(system, prompt, max_tokens=300)
    if result:
        try:
            clean = result.strip().lstrip("```json").rstrip("```").strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            pass
    return _default_classification()


async def summarize_with_groq(
    title: str, description: str, category: str,
    urgency: str, address: str, ward_name: str,
) -> str:
    """
    Generate officer briefing using Groq — alternative to Gemini Agent 2.
    """
    if _rotator.count() == 0:
        return f"{urgency.upper()} — {title} at {address}"

    system = "You are an MCD field officer assistant. Write a brief actionable briefing. Max 60 words."
    prompt = (
        f"Complaint: {title} | {description}\n"
        f"Category: {category} | Urgency: {urgency}\n"
        f"Location: {address}, {ward_name}\n"
        "Write 2-3 sentences: what the issue is, why it matters, and suggested first action."
    )

    result = await _groq_call(system, prompt, max_tokens=150)
    return result or f"{urgency.upper()}: {title} at {address}. Immediate inspection required."


async def generate_digest_with_groq(ward_name: str, stats: dict) -> str:
    """
    Generate ward weekly digest narrative using Groq.
    Alternative to Gemini Agent 5 (generate_weekly_digest).
    """
    if _rotator.count() == 0:
        return f"Week summary for {ward_name}: {stats.get('resolved', 0)} complaints resolved."

    system = (
        "You are a civic reporting system for MCD Delhi. Write a weekly ward digest. "
        "Professional, honest, specific. Max 200 words."
    )
    prompt = f"""Ward: {ward_name}, Delhi
Stats:
- Total: {stats.get('total', 0)} complaints
- Resolved: {stats.get('resolved', 0)} ({stats.get('resolution_rate', 0):.0f}%)
- Avg resolution: {stats.get('avg_hours', 0):.0f} hours
- Top category: {stats.get('top_category', 'N/A')}
- Health score: {stats.get('score_end', 0):.1f} (was {stats.get('score_start', 0):.1f})
- Overdue: {stats.get('overdue', 0)}

Write: 2-sentence summary, 3 achievements (bullet), 2 concerns (bullet), 1 recommendation."""

    result = await _groq_call(system, prompt, max_tokens=400)
    return result or f"{ward_name}: {stats.get('resolved', 0)} resolved this week."


def _default_classification() -> dict:
    return {
        "category":     "other",
        "sub_category": "unclassified",
        "department":   "General Department",
        "urgency":      "medium",
        "confidence":   0.3,
        "reasoning":    "Auto-classification failed",
    }