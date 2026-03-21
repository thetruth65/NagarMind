"""
NagarMind v3 — Chatbot Agent
Single-shot async function. No LangGraph. No loops.
Stages: greeting → asking_title → asking_description → asking_category
        → asking_address → asking_photos → confirming → submitted
"""

import json
import logging
import httpx
import threading
import time
from typing import Optional, List

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── Key Rotator ──────────────────────────────────────────────────────────────

class GroqKeyRotator:
    def __init__(self):
        self._lock        = threading.Lock()
        self._index       = 0
        self._error_until: dict[int, float] = {}
        self._cooldown    = 65

    def _valid_keys(self) -> List[str]:
        raw = [
            settings.GROQ_API_KEY,
            getattr(settings, "GROQ_API_KEY_2", ""),
            getattr(settings, "GROQ_API_KEY_3", ""),
            getattr(settings, "GROQ_API_KEY_4", ""),
        ]
        return [k.strip() for k in raw if k and k.strip()]

    def get_key(self) -> Optional[str]:
        with self._lock:
            keys = self._valid_keys()
            if not keys:
                logger.error("No valid Groq API keys configured")
                return None
            now = time.time()
            for _ in range(len(keys)):
                idx = self._index % len(keys)
                self._index = (self._index + 1) % len(keys)
                if now >= self._error_until.get(idx, 0):
                    return keys[idx]
            best = min(range(len(keys)), key=lambda i: self._error_until.get(i, 0))
            return keys[best]

    def mark_429(self, key: str):
        with self._lock:
            keys = self._valid_keys()
            if key in keys:
                idx = keys.index(key)
                self._error_until[idx] = time.time() + self._cooldown
                logger.warning(f"Groq key[{idx}] rate-limited {self._cooldown}s")

    def count(self) -> int:
        return len(self._valid_keys())


_rotator = GroqKeyRotator()


# ─── Session ──────────────────────────────────────────────────────────────────

class SessionState:
    __slots__ = [
        "history", "title", "description", "category", "address",
        "stage", "language", "citizen_id", "ward_id",
        "latitude", "longitude", "confirmed", "complaint_payload",
    ]
    def __init__(self, citizen_id: str, ward_id: int, language: str,
                 latitude: float, longitude: float):
        self.history           = []
        self.title             = None
        self.description       = None
        self.category          = None
        self.address           = None
        self.stage             = "greeting"
        self.language          = language
        self.citizen_id        = citizen_id
        self.ward_id           = ward_id
        self.latitude          = latitude
        self.longitude         = longitude
        self.confirmed         = False
        self.complaint_payload = None


_sessions: dict[str, SessionState] = {}


# ─── Groq call ────────────────────────────────────────────────────────────────

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


async def _call_groq(system: str, history: list, max_tokens: int = 500) -> str:
    if _rotator.count() == 0:
        return _fallback_json()

    for attempt in range(4):
        key = _rotator.get_key()
        if not key:
            break
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                resp = await client.post(
                    GROQ_URL,
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model":           GROQ_MODEL,
                        "messages":        [{"role": "system", "content": system}] + history,
                        "temperature":     0.15,
                        "max_tokens":      max_tokens,
                        "response_format": {"type": "json_object"},
                    },
                )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
            if resp.status_code == 429:
                _rotator.mark_429(key)
                import asyncio; await asyncio.sleep(min(2 ** attempt, 8))
                continue
            if resp.status_code == 401:
                logger.error(f"Groq 401 — invalid key (prefix: {key[:10]}...)")
                import asyncio; await asyncio.sleep(0.5)
                continue
            resp.raise_for_status()
        except httpx.TimeoutException:
            logger.warning(f"Groq timeout attempt {attempt+1}")
            import asyncio; await asyncio.sleep(1)
        except Exception as e:
            logger.warning(f"Groq error attempt {attempt+1}: {e}")
            if "429" in str(e):
                _rotator.mark_429(key)
            import asyncio; await asyncio.sleep(1)

    return _fallback_json()


def _fallback_json() -> str:
    return json.dumps({
        "reply": "Sorry, I had a connection issue. Please try again.",
        "extracted": {}, "next_stage": "same", "confirmed": False,
    })


# ─── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are NagarMind, a friendly AI civic complaint assistant for MCD Delhi.
Guide citizens step-by-step. ONE question per message. Never combine steps.

== LANGUAGE ==
Reply in the SAME language the citizen uses.
English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia.

== STAGE SEQUENCE ==

greeting → Ask: "What civic problem would you like to report?" → next_stage: asking_title

asking_title → Extract a 5-10 word title. If vague, ask to clarify.
  Once clear → next_stage: asking_description

asking_description → Ask for details (severity, duration, hazards). Need ≥10 words.
  Once good → next_stage: asking_category

asking_category → Auto-detect from title+description. Categories:
  pothole, garbage, sewage, water_supply, streetlight, tree, stray_animals, encroachment, noise, other
  Say: "I've classified this as [CATEGORY]. Correct? (yes/no)"
  yes → next_stage: asking_address
  no → ask to pick, update, then → next_stage: asking_address

asking_address → Say: "Please use the map below to pin your location, or type the address."
  The frontend will show a map widget. Wait for user to confirm with their address text.
  When user replies with an address (any location text) → extract it, next_stage: asking_photos

asking_photos → Say: "You can add photos as evidence (optional). Use the upload widget below, then click Continue."
  The frontend will show photo upload widget. When user confirms → next_stage: confirming

confirming → Show summary:
  📋 Title: [title]
  📝 Description: [first 80 chars]
  🏷️ Category: [category]
  📍 Location: [address]
  Ask: "Everything correct? Reply YES to submit, or tell me what to change."
  YES → confirmed: true, next_stage: submit
  Change → update, stay confirming.

submit → Confirm submission. next_stage: submitted.

== RULES ==
- ONE question/instruction per reply. Max 3 sentences.
- Be warm, patient, supportive.
- If off-topic, redirect.

== CATEGORY GUIDE ==
pothole=road hole, garbage=waste, sewage=drain/sewer,
water_supply=no water/pipe, streetlight=broken light, tree=fallen tree,
stray_animals=stray dogs/cows, encroachment=blocked footpath,
noise=loud noise, other=anything else

== JSON OUTPUT ONLY ==
{
  "reply": "message to citizen",
  "extracted": {
    "title": null_or_string,
    "description": null_or_string,
    "category": null_or_string,
    "address": null_or_string
  },
  "next_stage": "asking_title|asking_description|asking_category|asking_address|asking_photos|confirming|submit|submitted|same",
  "confirmed": false_or_true
}"""


# ─── Main ─────────────────────────────────────────────────────────────────────

async def chat_with_agent(
    thread_id: str,
    user_message: str,
    citizen_id: str,
    ward_id: int,
    language: str = "en",
    latitude:  float = 28.6139,
    longitude: float = 77.2090,
) -> dict:
    """Process one user message → one Groq call → return reply. No loops."""

    if thread_id not in _sessions:
        _sessions[thread_id] = SessionState(citizen_id, ward_id, language, latitude, longitude)

    sess = _sessions[thread_id]
    if language:
        sess.language  = language
    # Update location if user shared it
    if latitude  != 28.6139: sess.latitude  = latitude
    if longitude != 77.2090: sess.longitude = longitude

    if sess.stage == "submitted":
        return {
            "reply":             "✅ Your complaint has already been submitted!",
            "stage":             "submitted",
            "complaint_payload": sess.complaint_payload,
            "extracted":         _extracted(sess),
        }

    if user_message.strip():
        sess.history.append({"role": "user", "content": user_message.strip()})

    already = {k: v for k, v in {
        "title": sess.title, "description": sess.description,
        "category": sess.category, "address": sess.address,
    }.items() if v}

    context = (
        f"\n\n== CURRENT STATE ==\n"
        f"Stage: {sess.stage}\n"
        f"Collected: {json.dumps(already, ensure_ascii=False)}\n"
        f"Language: {sess.language}\n"
        f"Active keys: {_rotator.count()}\n"
        f"You are in stage '{sess.stage}'. Follow that stage's instructions exactly."
    )

    try:
        raw    = await _call_groq(SYSTEM_PROMPT + context, sess.history[-12:], max_tokens=500)
        parsed = json.loads(raw.strip())
    except json.JSONDecodeError:
        reply = _fallback_msg(sess.language)
        sess.history.append({"role": "assistant", "content": reply})
        return {"reply": reply, "stage": sess.stage, "complaint_payload": None, "extracted": _extracted(sess)}
    except Exception as e:
        logger.error(f"chat_with_agent error: {e}", exc_info=True)
        reply = _fallback_msg(sess.language)
        sess.history.append({"role": "assistant", "content": reply})
        return {"reply": reply, "stage": sess.stage, "complaint_payload": None, "extracted": _extracted(sess)}

    reply_text     = parsed.get("reply", "")
    extracted      = parsed.get("extracted") or {}
    next_stage     = parsed.get("next_stage", "same") or "same"
    user_confirmed = bool(parsed.get("confirmed", False))

    # Merge extracted fields
    for field in ["title", "description", "category", "address"]:
        val = extracted.get(field)
        if val and isinstance(val, str) and val.strip():
            setattr(sess, field, val.strip())

    if next_stage != "same":
        sess.stage = next_stage
    if user_confirmed:
        sess.confirmed = True
        sess.stage     = "submit"

    # Build payload and mark submitted
    if sess.stage == "submit":
        sess.complaint_payload = {
            "title":             sess.title       or "Civic Issue",
            "description":       sess.description or "",
            "category":          sess.category    or "other",
            "location_address":  sess.address     or "",
            "location_lat":      sess.latitude,
            "location_lng":      sess.longitude,
            "original_language": sess.language,
            "photos":            [],
            "voice_transcript":  None,
        }
        sess.stage = "submitted"
        if "✅" not in reply_text:
            reply_text = _submit_msg(sess.language)

    sess.history.append({"role": "assistant", "content": reply_text})

    return {
        "reply":             reply_text,
        "stage":             sess.stage,
        "complaint_payload": sess.complaint_payload,
        "extracted":         _extracted(sess),
    }


def _extracted(sess: SessionState) -> dict:
    return {
        "title":       sess.title,
        "description": sess.description,
        "category":    sess.category,
        "address":     sess.address,
    }


def _fallback_msg(lang: str) -> str:
    return {
        "hi": "क्षमा करें, फिर से कोशिश करें।",
        "bn": "দুঃখিত, আবার চেষ্টা করুন।",
        "ta": "மன்னிக்கவும். மீண்டும் முயற்சிக்கவும்.",
        "te": "క్షమించండి. మళ్ళీ ప్రయత్నించండి.",
        "mr": "माफ करा. पुन्हा प्रयत्न करा.",
    }.get(lang, "Sorry, something went wrong. Please try again.")


def _submit_msg(lang: str) -> str:
    return {
        "hi": "✅ शिकायत दर्ज हो गई! जल्द ही अधिकारी नियुक्त होगा।",
        "bn": "✅ অভিযোগ জমা হয়েছে! শীঘ্রই অফিসার নিয়োগ পাবেন।",
        "ta": "✅ புகார் சமர்ப்பிக்கப்பட்டது!",
        "te": "✅ ఫిర్యాదు సమర్పించబడింది!",
        "mr": "✅ तक्रार दाखल!",
        "en": "✅ Complaint submitted! An officer will be assigned shortly.",
    }.get(lang, "✅ Complaint submitted!")


def clear_session(thread_id: str):
    _sessions.pop(thread_id, None)


def get_session_state(thread_id: str) -> Optional[dict]:
    sess = _sessions.get(thread_id)
    if not sess:
        return None
    return {
        "title":       sess.title,
        "description": sess.description,
        "category":    sess.category,
        "address":     sess.address,
        "stage":       sess.stage,
        "language":    sess.language,
    }