"""
NagarMind v4 — Enhanced Multilingual Chatbot Agent
Full multilingual support for all 22 Indian languages.
Powered by Groq LLaMA 3.3-70b with rich context-aware prompting.
"""

import json
import logging
import httpx
import threading
import time
from typing import Optional, List

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Language Name Map ─────────────────────────────────────────────────────────
LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil",
    "te": "Telugu", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi", "or": "Odia", "as": "Assamese",
    "ur": "Urdu", "mai": "Maithili", "kok": "Konkani", "ne": "Nepali",
    "sd": "Sindhi", "doi": "Dogri", "sa": "Sanskrit",
    "mni": "Manipuri", "brx": "Bodo", "ks": "Kashmiri",
}

# ─── Static UI strings in all supported languages ──────────────────────────────
UI_STRINGS = {
    "greeting": {
        "en": "Hello! I'm NagarMind, your civic assistant for MCD Delhi. 🏙️\n\nI can help you report issues like potholes, garbage, sewage problems, broken streetlights, water supply issues, and more.\n\nWhat civic problem would you like to report today?",
        "hi": "नमस्ते! मैं NagarMind हूँ, MCD Delhi का आपका नागरिक सहायक। 🏙️\n\nमैं गड्ढे, कूड़ा, सीवेज, टूटी सड़क बत्ती, पानी की समस्या और अन्य मुद्दों की रिपोर्ट करने में आपकी मदद कर सकता हूँ।\n\nआज आप कौन सी नागरिक समस्या रिपोर्ट करना चाहते हैं?",
        "bn": "নমস্কার! আমি NagarMind, MCD Delhi-র আপনার নাগরিক সহকারী। 🏙️\n\nআমি গর্ত, আবর্জনা, পয়ঃনিষ্কাশন, ভাঙা রাস্তার আলো, জল সরবরাহের সমস্যা ইত্যাদি রিপোর্ট করতে সাহায্য করতে পারি।\n\nআজ আপনি কোন নাগরিক সমস্যা রিপোর্ট করতে চান?",
        "ta": "வணக்கம்! நான் NagarMind, MCD Delhi-யின் உங்கள் குடிமை உதவியாளர். 🏙️\n\nகுழிகள், குப்பை, கழிவுநீர், உடைந்த தெரு விளக்குகள், நீர் விநியோக பிரச்சினைகள் போன்றவற்றை புகாரளிக்க உதவ முடியும்.\n\nஇன்று நீங்கள் என்ன குடிமை பிரச்சினையை புகாரளிக்க விரும்புகிறீர்கள்?",
        "te": "నమస్కారం! నేను NagarMind, MCD Delhi మీ పౌర సహాయకుడు. 🏙️\n\nగుంతలు, చెత్త, మురుగు, విరిగిన వీధి దీపాలు, నీటి సరఫరా సమస్యలు మొదలైనవి నివేదించడంలో నేను సహాయం చేయగలను.\n\nఈరోజు మీరు ఏ పౌర సమస్యను నివేదించాలనుకుంటున్నారు?",
        "mr": "नमस्कार! मी NagarMind आहे, MCD Delhi चा तुमचा नागरी सहाय्यक. 🏙️\n\nखड्डे, कचरा, सांडपाणी, तुटलेले दिवे, पाणी पुरवठा समस्या अशा तक्रारी नोंदवण्यास मी मदत करू शकतो.\n\nआज तुम्हाला कोणती नागरी समस्या नोंदवायची आहे?",
        "gu": "નમસ્તે! હું NagarMind છું, MCD Delhi નો તમારો નાગરિક સહાયક. 🏙️\n\nહું ખાડા, કચરો, ગટર, તૂટેલ સ્ટ્રીટ લાઇટ, પાણી પુરવઠાની સમસ્યાઓ વગેરેની ફરિયાદ નોંધવામાં મદદ કરી શકું છું.\n\nઆજે તમે કઈ નાગરિક સમસ્યા નોંધાવવા માંગો છો?",
        "kn": "ನಮಸ್ಕಾರ! ನಾನು NagarMind, MCD Delhi ನ ನಿಮ್ಮ ನಾಗರಿಕ ಸಹಾಯಕ. 🏙️\n\nಗುಂಡಿಗಳು, ತ್ಯಾಜ್ಯ, ಚರಂಡಿ, ಮುರಿದ ಬೀದಿ ದೀಪಗಳು, ನೀರು ಸರಬರಾಜು ಸಮಸ್ಯೆಗಳು ಇತ್ಯಾದಿ ದೂರು ನೀಡಲು ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.\n\nಇಂದು ನೀವು ಯಾವ ನಾಗರಿಕ ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?",
        "ml": "നമസ്കാരം! ഞാൻ NagarMind ആണ്, MCD Delhi-യുടെ നിങ്ങളുടെ നഗര സഹായി. 🏙️\n\nകുഴികൾ, മാലിന്യം, ഓടകൾ, തകർന്ന തെരുവ് വിളക്കുകൾ, ജലവിതരണ പ്രശ്നങ്ങൾ എന്നിവ റിപ്പോർട്ട് ചെയ്യാൻ സഹായിക്കാൻ എനിക്കാവും.\n\nഇന്ന് നിങ്ങൾ ഏത് നഗര പ്രശ്നം റിപ്പോർട്ട് ചെയ്യാൻ ആഗ്രഹിക്കുന്നു?",
        "pa": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ NagarMind ਹਾਂ, MCD Delhi ਦਾ ਤੁਹਾਡਾ ਨਾਗਰਿਕ ਸਹਾਇਕ। 🏙️\n\nਮੈਂ ਟੋਏ, ਕੂੜਾ, ਸੀਵਰੇਜ, ਟੁੱਟੀਆਂ ਸਟਰੀਟ ਲਾਈਟਾਂ, ਪਾਣੀ ਦੀ ਸਮੱਸਿਆ ਆਦਿ ਦੀ ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।\n\nਅੱਜ ਤੁਸੀਂ ਕਿਹੜੀ ਨਾਗਰਿਕ ਸਮੱਸਿਆ ਦਰਜ ਕਰਵਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?",
        "or": "ନମସ୍କାର! ମୁଁ NagarMind, MCD Delhi ର ଆପଣଙ୍କ ନାଗରିକ ସହାୟକ। 🏙️\n\nଗାତ, ଆବର୍ଜନା, ନର୍ଦ୍ଦମା, ଭଙ୍ଗା ଷ୍ଟ୍ରିଟ ଲାଇଟ, ଜଳ ଯୋଗାଣ ସମସ୍ୟା ଆଦି ରିପୋର୍ଟ କରିବାରେ ମୁଁ ସାହାଯ୍ୟ କରିପାରିବି।\n\nଆଜି ଆପଣ କେଉଁ ନାଗରିକ ସମସ୍ୟା ରିପୋର୍ଟ କରିବାକୁ ଚାହୁଁଛନ୍ତି?",
        "as": "নমস্কাৰ! মই NagarMind, MCD Delhi ৰ আপোনাৰ নাগৰিক সহায়ক। 🏙️\n\nগাঁত, আৱৰ্জনা, পয়ঃপ্ৰণালী, ভঙা ৰাস্তাৰ পোহৰ, পানী যোগান সমস্যা আদি ৰিপোৰ্ট কৰিবলৈ মই সহায় কৰিব পাৰোঁ।\n\nআজি আপুনি কোনটো নাগৰিক সমস্যা ৰিপোৰ্ট কৰিব বিচাৰে?",
    },
    "submit_success": {
        "en": "✅ Your complaint has been successfully submitted!\n\nAI is now classifying your complaint and will assign it to the right officer. You will receive notifications on every status update.",
        "hi": "✅ आपकी शिकायत सफलतापूर्वक दर्ज हो गई है!\n\nAI अब आपकी शिकायत को वर्गीकृत करेगा और सही अधिकारी को सौंपेगा। हर अपडेट पर आपको सूचना मिलेगी।",
        "bn": "✅ আপনার অভিযোগ সফলভাবে জমা দেওয়া হয়েছে!\n\nAI এখন আপনার অভিযোগ শ্রেণীবদ্ধ করবে এবং সঠিক অফিসারকে নিযুক্ত করবে।",
        "ta": "✅ உங்கள் புகார் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!\n\nAI இப்போது உங்கள் புகாரை வகைப்படுத்தி சரியான அதிகாரிக்கு ஒதுக்கும்.",
        "te": "✅ మీ ఫిర్యాదు విజయవంతంగా సమర్పించబడింది!\n\nAI ఇప్పుడు మీ ఫిర్యాదును వర్గీకరించి సరైన అధికారికి కేటాయిస్తుంది.",
        "mr": "✅ तुमची तक्रार यशस्वीरित्या दाखल झाली आहे!\n\nAI आता तुमच्या तक्रारीचे वर्गीकरण करेल आणि योग्य अधिकाऱ्याकडे पाठवेल.",
        "gu": "✅ તમારી ફરિયાદ સફળતાપૂર્વક સબમિટ થઈ ગઈ!\n\nAI હવે તમારી ફરિયાદ વર્ગીકૃત કરશે અને યોગ્ય અધિકારીને સોંપશે.",
        "kn": "✅ ನಿಮ್ಮ ದೂರನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಸಲಾಗಿದೆ!\n\nAI ಈಗ ನಿಮ್ಮ ದೂರನ್ನು ವರ್ಗೀಕರಿಸಿ ಸರಿಯಾದ ಅಧಿಕಾರಿಗೆ ನಿಯೋಜಿಸುತ್ತದೆ.",
        "ml": "✅ നിങ്ങളുടെ പരാതി വിജയകരമായി സമർപ്പിക്കപ്പെട്ടു!\n\nAI ഇനി നിങ്ങളുടെ പരാതി തരംതിരിച്ച് ശരിയായ ഉദ്യോഗസ്ഥനെ നിയോഗിക്കും.",
        "pa": "✅ ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਕਰ ਲਈ ਗਈ ਹੈ!\n\nAI ਹੁਣ ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਨੂੰ ਵਰਗੀਕਰਨ ਕਰੇਗਾ ਅਤੇ ਸਹੀ ਅਧਿਕਾਰੀ ਨੂੰ ਸੌਂਪੇਗਾ।",
        "or": "✅ ଆପଣଙ୍କ ଅଭିଯୋଗ ସଫଳତାର ସହ ଦାଖଲ ହୋଇଛି!\n\nAI ଏବେ ଆପଣଙ୍କ ଅଭିଯୋଗ ବର୍ଗୀକୃତ କରି ସଠିକ ଅଧିକାରୀଙ୍କୁ ନ୍ୟସ୍ତ କରିବ।",
        "as": "✅ আপোনাৰ অভিযোগ সফলভাৱে দাখিল কৰা হৈছে!\n\nAI এতিয়া আপোনাৰ অভিযোগ শ্ৰেণীবদ্ধ কৰি সঠিক বিষয়াক নিযুক্ত কৰিব।",
    },
    "location_prompt": {
        "en": "Please pin your exact location on the map below, or type your address:",
        "hi": "कृपया नीचे नक्शे पर अपना सटीक स्थान पिन करें, या अपना पता टाइप करें:",
        "bn": "অনুগ্রহ করে নিচের মানচিত্রে আপনার সঠিক অবস্থান পিন করুন, বা আপনার ঠিকানা টাইপ করুন:",
        "ta": "கீழே உள்ள வரைபடத்தில் உங்கள் சரியான இடத்தை பின் செய்யுங்கள், அல்லது உங்கள் முகவரியை தட்டச்சு செய்யுங்கள்:",
        "te": "దయచేసి దిగువ మ్యాప్‌లో మీ ఖచ్చితమైన స్థానాన్ని పిన్ చేయండి, లేదా మీ చిరునామా టైప్ చేయండి:",
        "mr": "कृपया खालील नकाशावर तुमचे अचूक ठिकाण पिन करा, किंवा तुमचा पत्ता टाइप करा:",
        "gu": "કૃપા કરીને નીચેના નકશા પર તમારું ચોક્કસ સ્થાન પિન કરો, અથવા તમારું સરનામું ટાઈપ કરો:",
        "kn": "ದಯವಿಟ್ಟು ಕೆಳಗಿನ ನಕ್ಷೆಯಲ್ಲಿ ನಿಮ್ಮ ನಿಖರವಾದ ಸ್ಥಳವನ್ನು ಪಿನ್ ಮಾಡಿ, ಅಥವಾ ನಿಮ್ಮ ವಿಳಾಸ ಟೈಪ್ ಮಾಡಿ:",
        "ml": "ദയവായി ചുവടെ ഉള്ള ഭൂപടത്തിൽ നിങ്ങളുടെ കൃത്യമായ സ്ഥാനം പിൻ ചെയ്യുക, അല്ലെങ്കിൽ നിങ്ങളുടെ വിലാസം ടൈപ്പ് ചെയ്യുക:",
        "pa": "ਕਿਰਪਾ ਕਰਕੇ ਹੇਠਾਂ ਦਿੱਤੇ ਨਕਸ਼ੇ 'ਤੇ ਆਪਣਾ ਸਹੀ ਸਥਾਨ ਪਿੰਨ ਕਰੋ, ਜਾਂ ਆਪਣਾ ਪਤਾ ਟਾਈਪ ਕਰੋ:",
        "or": "ଦୟାକରି ନିମ୍ନ ମ୍ୟାପ୍‌ରେ ଆପଣଙ୍କ ସଠିକ ଅବସ୍ଥାନ ପିନ୍ କରନ୍ତୁ, ଅଥବା ଆପଣଙ୍କ ଠିକଣା ଟାଇପ୍ କରନ୍ତୁ:",
        "as": "অনুগ্ৰহ কৰি তলৰ মানচিত্ৰত আপোনাৰ সঠিক স্থান পিন কৰক, বা আপোনাৰ ঠিকনা টাইপ কৰক:",
    },
    "photo_prompt": {
        "en": "Please add photos as evidence (optional but recommended). Use the upload widget below, then click Continue.",
        "hi": "कृपया सबूत के रूप में फ़ोटो जोड़ें (वैकल्पिक लेकिन अनुशंसित)। नीचे अपलोड विजेट का उपयोग करें, फिर जारी रखें पर क्लिक करें।",
        "bn": "প্রমাণ হিসাবে ছবি যোগ করুন (ঐচ্ছিক কিন্তু প্রস্তাবিত)। নিচের আপলোড উইজেট ব্যবহার করুন, তারপর Continue ক্লিক করুন।",
        "ta": "சான்றாக புகைப்படங்களை சேர்க்கவும் (விரும்பினால், ஆனால் பரிந்துரைக்கப்படுகிறது). கீழே உள்ள பதிவேற்ற விட்ஜெட்டைப் பயன்படுத்தவும்.",
        "te": "సాక్ష్యంగా ఫోటోలు జోడించండి (ఐచ్ఛికం కానీ సిఫార్సు చేయబడింది). దిగువ అప్‌లోడ్ విజెట్ ఉపయోగించండి.",
        "mr": "पुरावा म्हणून फोटो जोडा (पर्यायी पण शिफारस केलेले). खालील अपलोड विजेट वापरा.",
        "gu": "પુરાવા તરીકે ફોટો ઉમેરો (વૈકલ્પિક પણ ભલામણ કરેલ). નીચે અપલોડ વિજેટ વાપરો.",
        "kn": "ಸಾಕ್ಷ್ಯವಾಗಿ ಫೋಟೋಗಳನ್ನು ಸೇರಿಸಿ (ಐಚ್ಛಿಕ ಆದರೆ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ). ಕೆಳಗಿನ ಅಪ್‌ಲೋಡ್ ವಿಜೆಟ್ ಬಳಸಿ.",
        "ml": "തെളിവായി ഫോട്ടോകൾ ചേർക്കുക (ഐച്ഛികം പക്ഷേ ശുപാർശ ചെയ്യുന്നു). താഴെ അപ്‌ലോഡ് വിജറ്റ് ഉപയോഗിക്കുക.",
        "pa": "ਸਬੂਤ ਵਜੋਂ ਫੋਟੋ ਜੋੜੋ (ਵਿਕਲਪਿਕ ਪਰ ਸਿਫਾਰਸ਼ ਕੀਤੀ)। ਹੇਠਾਂ ਅਪਲੋਡ ਵਿਜੇਟ ਵਰਤੋ।",
        "or": "ପ୍ରମାଣ ଭାବରେ ଫଟୋ ଯୋଡ଼ନ୍ତୁ (ଐଚ୍ଛିକ କିନ୍ତୁ ପ୍ରସ୍ତାବିତ)। ନିମ୍ନ ଅପଲୋଡ ୱିଜେଟ ବ୍ୟବହାର କରନ୍ତୁ।",
        "as": "প্ৰমাণ হিচাপে ফটো যোগ কৰক (ঐচ্ছিক কিন্তু পৰামৰ্শযোগ্য)। তলৰ আপলোড উইজেট ব্যৱহাৰ কৰক।",
    },
}


def get_ui_string(key: str, lang: str) -> str:
    """Get a UI string in the specified language, fallback to English."""
    strings = UI_STRINGS.get(key, {})
    return strings.get(lang) or strings.get("en", "")


# ─── Key Rotator ──────────────────────────────────────────────────────────────

class GroqKeyRotator:
    def __init__(self):
        self._lock = threading.Lock()
        self._index = 0
        self._error_until: dict[int, float] = {}
        self._cooldown = 65

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
        "history", "title", "title_original", "description", "description_original",
        "category", "address", "stage", "language", "citizen_id", "ward_id",
        "latitude", "longitude", "confirmed", "complaint_payload",
    ]

    def __init__(self, citizen_id: str, ward_id: int, language: str,
                 latitude: float, longitude: float):
        self.history = []
        self.title = None
        self.title_original = None
        self.description = None
        self.description_original = None
        self.category = None
        self.address = None
        self.stage = "greeting"
        self.language = language
        self.citizen_id = citizen_id
        self.ward_id = ward_id
        self.latitude = latitude
        self.longitude = longitude
        self.confirmed = False
        self.complaint_payload = None


_sessions: dict[str, SessionState] = {}

# ─── Groq API ─────────────────────────────────────────────────────────────────

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


async def _call_groq(system: str, history: list, max_tokens: int = 600) -> str:
    if _rotator.count() == 0:
        return _fallback_json()

    for attempt in range(4):
        key = _rotator.get_key()
        if not key:
            break
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    GROQ_URL,
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": GROQ_MODEL,
                        "messages": [{"role": "system", "content": system}] + history,
                        "temperature": 0.15,
                        "max_tokens": max_tokens,
                        "response_format": {"type": "json_object"},
                    },
                )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
            if resp.status_code == 429:
                _rotator.mark_429(key)
                import asyncio
                await asyncio.sleep(min(2 ** attempt, 8))
                continue
            if resp.status_code == 401:
                logger.error(f"Groq 401 — invalid key")
                import asyncio
                await asyncio.sleep(0.5)
                continue
            resp.raise_for_status()
        except httpx.TimeoutException:
            logger.warning(f"Groq timeout attempt {attempt + 1}")
            import asyncio
            await asyncio.sleep(1)
        except Exception as e:
            logger.warning(f"Groq error attempt {attempt + 1}: {e}")
            if "429" in str(e):
                _rotator.mark_429(key)
            import asyncio
            await asyncio.sleep(1)

    return _fallback_json()


def _fallback_json() -> str:
    return json.dumps({
        "reply": "Sorry, I had a connection issue. Please try again.",
        "reply_original": None,
        "extracted": {},
        "next_stage": "same",
        "confirmed": False,
    })


# ─── Enhanced System Prompt ───────────────────────────────────────────────────

def build_system_prompt(language: str, stage: str, collected: dict) -> str:
    lang_name = LANGUAGE_NAMES.get(language, "English")
    is_english = language == "en"

    collected_str = json.dumps(collected, ensure_ascii=False) if collected else "{}"

    return f"""You are NagarMind, a friendly, patient AI civic complaint assistant for MCD (Municipal Corporation of Delhi), India.

== CRITICAL LANGUAGE RULE ==
The user's preferred language is: {lang_name} (code: {language})
{"You MUST respond ONLY in English." if is_english else f"You MUST respond ONLY in {lang_name} ({language}). NEVER use English in your reply field unless the user explicitly writes in English."}
{"" if is_english else f"""
BILINGUAL EXTRACTION RULE:
- reply: Always in {lang_name}
- reply_en: Always provide the English translation of your reply
- extracted.title: Provide in English  
- extracted.title_original: Provide in {lang_name} (the user's words)
- extracted.description: Provide in English
- extracted.description_original: Provide in {lang_name} (the user's words)
"""}

== CIVIC KNOWLEDGE (Delhi MCD) ==
Common complaint categories and their SLA times:
- pothole (गड्ढा/குழி): Road holes causing accidents — 24-48 hours SLA
- garbage (कूड़ा/குப்பை): Uncollected waste — 6-24 hours SLA  
- sewage (सीवेज/கழிவுநீர்): Blocked drains, overflow — 12-72 hours SLA
- water_supply (पानी/நீர்): No water, broken pipes — 6-48 hours SLA
- streetlight (सड़क बत्ती/தெரு விளக்கு): Broken/non-working lights — 24-120 hours SLA
- tree (पेड़/மரம்): Fallen trees blocking roads — 24-48 hours SLA
- stray_animals (आवारा जानवर/நாய்கள்): Aggressive strays — 12-72 hours SLA
- encroachment (अतिक्रमण/ஆக்கிரமிப்பு): Blocked footpaths — 48-168 hours SLA
- noise (शोर/சத்தம்): Construction/party noise — 12-48 hours SLA
- other: Miscellaneous civic issues

== CURRENT SESSION STATE ==
Stage: {stage}
Collected data: {collected_str}
Language: {lang_name}

== STAGE SEQUENCE (Follow STRICTLY, ONE step at a time) ==

greeting → Ask: "What civic problem would you like to report?" [in {lang_name}]
  → next_stage: asking_title

asking_title → Extract 5-10 word title from user's description.
  Respond: "I understand you're reporting [issue]. Can you give me a brief title for this problem?"
  When got good title → next_stage: asking_description

asking_description → Ask for specific details (exact location description, severity, how long, hazards).
  Respond: "Please describe the problem in more detail — where exactly, how severe, how long has it been there?"
  When description ≥15 words → next_stage: asking_category

asking_category → Auto-classify from description. Tell user:
  "I've classified this as [CATEGORY_IN_{lang_name}]. Is this correct?"
  Quick reply options: yes/no
  If confirmed → next_stage: asking_address
  If wrong → ask them to describe again

asking_address → Say: "Please use the map below to pin the exact location, or type the address."
  Show location widget. When user provides any address text → extract it → next_stage: asking_photos

asking_photos → Say: "You can attach photos as evidence (optional). Use the upload widget, then click Continue."
  When user responds → next_stage: confirming

confirming → Show full summary in {lang_name}:
  📋 [Title in {lang_name}]
  📝 [Description summary]
  🏷️ [Category in {lang_name}]
  📍 [Location]
  Ask: "Is everything correct? Reply YES to submit, or tell me what to change."
  YES/confirm → confirmed: true, next_stage: submit

submit → Submit complaint. → next_stage: submitted

== RULES ==
- ONE question per message. Maximum 3 sentences.
- Always warm, patient, culturally sensitive tone.
- Use respectful forms (आप in Hindi, நீங்கள் in Tamil, etc.)
- If user goes off-topic, gently redirect.
- Accept voice transcription even if slightly imperfect — use context to understand.

== CATEGORY AUTO-DETECTION ==
pothole=road hole/गड्ढा, garbage=waste/कूड़ा, sewage=drain/सीवेज,
water_supply=no water/पानी नहीं, streetlight=light/बत्ती,
tree=fallen tree/पेड़, stray_animals=dogs/जानवर,
encroachment=blocked/अतिक्रमण, noise=loud/शोर, other=misc

== JSON RESPONSE FORMAT (REQUIRED) ==
{{
  "reply": "Your response in {lang_name}",
  "reply_en": "English translation of your reply",
  "extracted": {{
    "title": "English title or null",
    "title_original": "{lang_name} title or null",
    "description": "English description or null",
    "description_original": "{lang_name} description or null",
    "category": "category_key or null",
    "address": "address text or null"
  }},
  "next_stage": "asking_title|asking_description|asking_category|asking_address|asking_photos|confirming|submit|submitted|same",
  "confirmed": false
}}"""


# ─── Main Agent ───────────────────────────────────────────────────────────────

async def chat_with_agent(
    thread_id: str,
    user_message: str,
    citizen_id: str,
    ward_id: int,
    language: str = "en",
    latitude: float = 28.6139,
    longitude: float = 77.2090,
) -> dict:
    """Process one user message → one Groq call → return multilingual reply."""

    if thread_id not in _sessions:
        _sessions[thread_id] = SessionState(citizen_id, ward_id, language, latitude, longitude)

    sess = _sessions[thread_id]
    if language:
        sess.language = language
    if latitude != 28.6139:
        sess.latitude = latitude
    if longitude != 77.2090:
        sess.longitude = longitude

    if sess.stage == "submitted":
        return {
            "reply": get_ui_string("submit_success", sess.language),
            "reply_en": get_ui_string("submit_success", "en"),
            "stage": "submitted",
            "complaint_payload": sess.complaint_payload,
            "extracted": _extracted(sess),
        }

    if user_message.strip():
        sess.history.append({"role": "user", "content": user_message.strip()})

    # Build collected dict for context
    collected = {k: v for k, v in {
        "title": sess.title,
        "title_original": sess.title_original,
        "description": sess.description,
        "description_original": sess.description_original,
        "category": sess.category,
        "address": sess.address,
    }.items() if v}

    system = build_system_prompt(sess.language, sess.stage, collected)

    try:
        raw = await _call_groq(system, sess.history[-14:], max_tokens=700)
        parsed = json.loads(raw.strip())
    except json.JSONDecodeError:
        reply = _fallback_msg(sess.language)
        sess.history.append({"role": "assistant", "content": reply})
        return {
            "reply": reply,
            "reply_en": "Sorry, something went wrong. Please try again.",
            "stage": sess.stage,
            "complaint_payload": None,
            "extracted": _extracted(sess),
        }
    except Exception as e:
        logger.error(f"chat_with_agent error: {e}", exc_info=True)
        reply = _fallback_msg(sess.language)
        sess.history.append({"role": "assistant", "content": reply})
        return {
            "reply": reply,
            "reply_en": "Sorry, something went wrong. Please try again.",
            "stage": sess.stage,
            "complaint_payload": None,
            "extracted": _extracted(sess),
        }

    reply_text = parsed.get("reply", "")
    reply_en = parsed.get("reply_en", reply_text)
    extracted = parsed.get("extracted") or {}
    next_stage = parsed.get("next_stage", "same") or "same"
    user_confirmed = bool(parsed.get("confirmed", False))

    # Merge extracted fields (both original and English)
    field_map = {
        "title": "title",
        "title_original": "title_original",
        "description": "description",
        "description_original": "description_original",
        "category": "category",
        "address": "address",
    }
    for ext_key, sess_key in field_map.items():
        val = extracted.get(ext_key)
        if val and isinstance(val, str) and val.strip():
            setattr(sess, sess_key, val.strip())

    if next_stage != "same":
        sess.stage = next_stage
    if user_confirmed:
        sess.confirmed = True
        sess.stage = "submit"

    # Handle asking_address and asking_photos stages — inject localized prompts
    if sess.stage == "asking_address" and "map" not in reply_text.lower():
        reply_text = get_ui_string("location_prompt", sess.language) or reply_text

    if sess.stage == "asking_photos" and "photo" not in reply_text.lower():
        reply_text = get_ui_string("photo_prompt", sess.language) or reply_text

    # Build payload on submit
    if sess.stage == "submit":
        # Use English title/desc for DB, original for display
        title_en = sess.title or sess.title_original or "Civic Issue"
        desc_en = sess.description or sess.description_original or ""
        title_orig = sess.title_original or sess.title or "Civic Issue"
        desc_orig = sess.description_original or sess.description or ""

        sess.complaint_payload = {
            "title": title_en,
            "title_original": title_orig,
            "description": desc_en,
            "description_original": desc_orig,
            "category": sess.category or "other",
            "location_address": sess.address or "",
            "location_lat": sess.latitude,
            "location_lng": sess.longitude,
            "original_language": sess.language,
            "photos": [],
            "voice_transcript": None,
        }
        sess.stage = "submitted"
        reply_text = get_ui_string("submit_success", sess.language)
        reply_en = get_ui_string("submit_success", "en")

    sess.history.append({"role": "assistant", "content": reply_text})

    return {
        "reply": reply_text,
        "reply_en": reply_en,
        "stage": sess.stage,
        "complaint_payload": sess.complaint_payload,
        "extracted": _extracted(sess),
    }


def _extracted(sess: SessionState) -> dict:
    return {
        "title": sess.title,
        "title_original": sess.title_original,
        "description": sess.description,
        "description_original": sess.description_original,
        "category": sess.category,
        "address": sess.address,
    }


def _fallback_msg(lang: str) -> str:
    msgs = {
        "hi": "क्षमा करें, फिर से कोशिश करें।",
        "bn": "দুঃখিত, আবার চেষ্টা করুন।",
        "ta": "மன்னிக்கவும். மீண்டும் முயற்சிக்கவும்.",
        "te": "క్షమించండి. మళ్ళీ ప్రయత్నించండి.",
        "mr": "माफ करा. पुन्हा प्रयत्न करा.",
        "gu": "માફ કરશો. ફરી પ્રયાસ કરો.",
        "kn": "ಕ್ಷಮಿಸಿ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
        "ml": "ക്ഷമിക്കണം. വീണ്ടും ശ്രമിക്കുക.",
        "pa": "ਮਾਫ਼ ਕਰਨਾ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        "or": "ମାଫ କରନ୍ତୁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
        "as": "ক্ষমা কৰিব। পুনৰ চেষ্টা কৰক।",
    }
    return msgs.get(lang, "Sorry, something went wrong. Please try again.")


def clear_session(thread_id: str):
    _sessions.pop(thread_id, None)


def get_session_state(thread_id: str) -> Optional[dict]:
    sess = _sessions.get(thread_id)
    if not sess:
        return None
    return {
        "title": sess.title,
        "title_original": sess.title_original,
        "description": sess.description,
        "description_original": sess.description_original,
        "category": sess.category,
        "address": sess.address,
        "stage": sess.stage,
        "language": sess.language,
    }