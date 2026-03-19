"""
NagarMind v2 — LangGraph Chatbot Complaint Intake Agent
Uses Groq (Llama 3.3 70B) — 14,400 req/day free tier, no quota issues.
Gemini keys are reserved for classification, digests, and officer summaries.
"""

import json
import logging
import httpx
from typing import Optional, Annotated
from typing_extensions import TypedDict

from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── State ────────────────────────────────────────────────────────────────────

class ComplaintState(TypedDict):
    messages: Annotated[list, add_messages]
    title: Optional[str]
    description: Optional[str]
    category: Optional[str]
    address: Optional[str]
    latitude: float
    longitude: float
    language: str
    stage: str           # greet | gather | confirm | submitted
    confirmed: bool
    citizen_id: str
    ward_id: int
    complaint_payload: Optional[dict]


# ─── Groq API call ────────────────────────────────────────────────────────────

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Llama 3.3 70B: best free-tier model for instruction-following + multilingual
GROQ_MODEL = "llama-3.3-70b-versatile"


async def _groq_generate(system: str, user: str) -> str:
    """
    Direct async Groq API call. Returns the assistant message content.
    Uses GROQ_API_KEY from settings.
    """
    api_key = getattr(settings, "GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set in .env")

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": 0.1,
        "max_tokens": 512,
        "response_format": {"type": "json_object"},  # forces valid JSON output
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ─── Prompts ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are NagarMind, a friendly civic assistant for MCD Delhi.
Help citizens report civic problems conversationally.

RULES:
1. Reply in the SAME language the citizen uses (Hindi, English, Tamil, Bengali, Gujarati, Marathi, Telugu, Kannada, Malayalam, Punjabi, Odia).
2. Extract these 4 fields through conversation:
   - title: 5-10 word summary of the problem
   - description: what exactly is wrong
   - category: exactly one of [pothole, garbage, sewage, water_supply, streetlight, stray_animals, encroachment, noise, tree, other]
   - address: street name, landmark, or colony
3. Ask for only the missing fields, one at a time. Keep replies short.
4. Once all 4 fields are known, show a summary and ask the citizen to confirm.
5. If the citizen confirms (yes/haan/ha/correct/submit), set user_confirmed to true.

ALWAYS respond with this exact JSON structure (no markdown, no extra text):
{"reply":"your message","extracted":{"title":null,"description":null,"category":null,"address":null},"ready_to_confirm":false,"user_confirmed":false}

Category mapping:
pothole=road hole/damage, garbage=waste/litter, sewage=drain/sewer/flood, water_supply=tap/pipe/water,
streetlight=lamp/light, stray_animals=dog/cow/cattle, encroachment=footpath blocked/illegal shop,
noise=construction/party/loud, tree=fallen branch/tree, other=anything else"""


# ─── Nodes ────────────────────────────────────────────────────────────────────

async def gather_node(state: ComplaintState) -> dict:
    if state.get("stage") == "submitted":
        return {}

    known = {k: v for k, v in {
        "title":       state.get("title"),
        "description": state.get("description"),
        "category":    state.get("category"),
        "address":     state.get("address"),
    }.items() if v}
    known_str = json.dumps(known, ensure_ascii=False) if known else "none"

    # Keep only last 8 messages to stay within token limits
    history_lines = []
    for msg in list(state["messages"])[-8:]:
        if isinstance(msg, HumanMessage):
            history_lines.append(f"Citizen: {msg.content}")
        elif isinstance(msg, AIMessage):
            history_lines.append(f"NagarMind: {msg.content}")
    history_text = "\n".join(history_lines) if history_lines else "(new conversation)"

    lang = state.get("language", "en")

    user_content = f"""Known fields so far: {known_str}
Citizen language: {lang}
Conversation:
{history_text}

Continue the conversation. Extract any new fields from the citizen's latest message."""

    try:
        raw = await _groq_generate(SYSTEM_PROMPT, user_content)
        raw = raw.strip()

        parsed = json.loads(raw)
        reply_text     = parsed.get("reply", "")
        extracted      = parsed.get("extracted", {})
        ready          = parsed.get("ready_to_confirm", False)
        user_confirmed = parsed.get("user_confirmed", False)

        updates: dict = {"messages": [AIMessage(content=reply_text)]}

        for field in ["title", "description", "category", "address"]:
            val = extracted.get(field)
            if val and not state.get(field):
                updates[field] = val

        if user_confirmed:
            updates["confirmed"] = True
            updates["stage"] = "submit"
        elif ready:
            updates["stage"] = "confirm"

        return updates

    except Exception as e:
        logger.warning(f"Chatbot node error: {e}")
        fallback = (
            "माफ़ करें, कुछ गड़बड़ हुई। क्या आप दोबारा बता सकते हैं?"
            if lang == "hi"
            else "Sorry, something went wrong. Could you describe the problem again?"
        )
        return {"messages": [AIMessage(content=fallback)]}


async def submit_node(state: ComplaintState) -> dict:
    payload = {
        "title":             state.get("title") or "Civic Issue",
        "description":       state.get("description") or "",
        "category":          state.get("category") or "other",
        "location_address":  state.get("address") or "",
        "location_lat":      state.get("latitude", 28.6139),
        "location_lng":      state.get("longitude", 77.2090),
        "original_language": state.get("language", "en"),
        "photos":            [],
        "voice_transcript":  None,
    }
    lang = state.get("language", "en")
    done = (
        "✅ आपकी शिकायत दर्ज हो गई है! जल्द ही एक अधिकारी आपसे संपर्क करेगा।"
        if lang == "hi"
        else "✅ Complaint submitted! An officer will be assigned shortly."
    )
    return {
        "complaint_payload": payload,
        "stage": "submitted",
        "messages": [AIMessage(content=done)],
    }


# ─── Routing + Graph ──────────────────────────────────────────────────────────

def route(state: ComplaintState) -> str:
    if state.get("stage") == "submitted":
        return END
    if state.get("stage") == "submit" or state.get("confirmed"):
        return "submit"
    return "gather"


def build_graph():
    g = StateGraph(ComplaintState)
    g.add_node("gather", gather_node)
    g.add_node("submit", submit_node)
    g.add_edge(START, "gather")
    g.add_conditional_edges("gather", route, {"gather": "gather", "submit": "submit", END: END})
    g.add_edge("submit", END)
    return g.compile()


complaint_graph = build_graph()
_sessions: dict = {}


# ─── Public API ───────────────────────────────────────────────────────────────

async def chat_with_agent(
    thread_id: str,
    user_message: str,
    citizen_id: str,
    ward_id: int,
    language: str = "en",
    latitude: float = 28.6139,
    longitude: float = 77.2090,
) -> dict:
    current: ComplaintState = _sessions.get(thread_id) or {
        "messages":          [],
        "title":             None,
        "description":       None,
        "category":          None,
        "address":           None,
        "latitude":          latitude,
        "longitude":         longitude,
        "language":          language,
        "stage":             "greet",
        "confirmed":         False,
        "citizen_id":        citizen_id,
        "ward_id":           ward_id,
        "complaint_payload": None,
    }

    if user_message.strip():
        current["messages"] = list(current["messages"]) + [HumanMessage(content=user_message)]

    try:
        new_state = await complaint_graph.ainvoke(current)
    except Exception as e:
        logger.error(f"Graph error: {e}")
        return {
            "reply": "Sorry, something went wrong. Please try again.",
            "stage": "gather",
            "complaint_payload": None,
        }

    _sessions[thread_id] = new_state

    ai_msgs = [m for m in new_state["messages"] if isinstance(m, AIMessage)]
    last_reply = ai_msgs[-1].content if ai_msgs else "Hello! What problem would you like to report?"

    return {
        "reply":             last_reply,
        "stage":             new_state.get("stage", "gather"),
        "complaint_payload": new_state.get("complaint_payload"),
    }


def clear_session(thread_id: str):
    _sessions.pop(thread_id, None)
    _sessions.pop(f"{thread_id}:done", None)