/**
 * NagarMind v4 — ChatIntakePage (Full Multilingual)
 *
 * Features:
 * - All UI text in selected language (hardcoded translations)
 * - Bot replies in selected language
 * - Voice input in selected language via Groq Whisper
 * - Live preview in selected language + English translation
 * - Final bilingual review with inline edit (both lang + English)
 * - Smooth stage transitions and widget embedding
 */

import {
  useState, useRef, useEffect, useCallback, ChangeEvent
} from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Mic, MicOff, Send, Loader2, FileText, Globe,
  Eye, EyeOff, Edit3, AlignLeft, Tag, MapPin, Camera,
  CheckCircle2, X, Image as ImageIcon, Navigation, Check,
  ChevronDown
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { AppShell } from '@/components/common/AppShell'
import { api, uploadAPI, complaintsAPI } from '@/lib/api'
import { SUPPORTED_LANGUAGES, CATEGORY_CONFIG } from '@/types'
import toast from 'react-hot-toast'

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/citizen/dashboard', label: 'Home', icon: <span>🏠</span> },
  { to: '/citizen/submit', label: 'Report', icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest', label: 'Digest', icon: <span>📊</span> },
  { to: '/citizen/profile', label: 'Profile', icon: <span>👤</span> },
]

// ── Multilingual UI strings (static, hardcoded) ───────────────────────────────
const UI: Record<string, Record<string, string>> = {
  title: {
    en: 'Report via AI Chat', hi: 'AI चैट से रिपोर्ट करें', bn: 'AI চ্যাটে রিপোর্ট করুন',
    ta: 'AI மூலம் புகாரளிக்கவும்', te: 'AI ద్వారా రిపోర్ట్ చేయండి', mr: 'AI चॅटद्वारे रिपोर्ट करा',
    gu: 'AI ચેટ દ્વારા રિપોર્ટ કરો', kn: 'AI ಮೂಲಕ ವರದಿ ಮಾಡಿ', ml: 'AI ചാറ്റ് വഴി റിപ്പോർട്ട് ചെയ്യുക',
    pa: 'AI ਚੈਟ ਰਾਹੀਂ ਰਿਪੋਰਟ ਕਰੋ', or: 'AI ଚ୍ୟାଟ ଦ୍ୱାରା ରିପୋର୍ଟ କରନ୍ତୁ', as: 'AI চেটৰ জৰিয়তে ৰিপোৰ্ট কৰক',
  },
  subtitle: {
    en: 'NagarMind guides you step by step', hi: 'NagarMind आपको चरण दर चरण मार्गदर्शन करता है',
    bn: 'NagarMind আপনাকে ধাপে ধাপে গাইড করে', ta: 'NagarMind உங்களை படிப்படியாக வழிநடத்துகிறது',
    te: 'NagarMind మిమ్మల్ని దశలవారీగా మార్గనిర్దేశం చేస్తుంది', mr: 'NagarMind तुम्हाला पायरीपायरीने मार्गदर्शन करतो',
    gu: 'NagarMind તમને પગલા-પ્રક્રિયા માર્ગ-નિર્દેશ આપે છે', kn: 'NagarMind ನಿಮ್ಮನ್ನು ಹಂತ ಹಂತವಾಗಿ ಮಾರ್ಗದರ್ಶನ ಮಾಡುತ್ತದೆ',
    ml: 'NagarMind നിങ്ങളെ ഘട്ടം ഘട്ടമായി നയിക്കുന്നു', pa: 'NagarMind ਤੁਹਾਨੂੰ ਕਦਮ ਦਰ ਕਦਮ ਮਾਰਗਦਰਸ਼ਨ ਕਰਦਾ ਹੈ',
    or: 'NagarMind ଆପଣଙ୍କୁ ପଦ‌ ପଦ ମାର୍ଗ ଦର୍ଶନ ଦିଏ', as: 'NagarMind আপোনাক পদক্ষেপে পদক্ষেপে পথ নিৰ্দেশনা দিয়ে',
  },
  typePlaceholder: {
    en: 'Type or hold mic to speak...', hi: 'यहाँ लिखें या माइक दबाएं...',
    bn: 'এখানে লিখুন বা মাইক চেপে বলুন...', ta: 'இங்கே தட்டச்சு செய்யுங்கள் அல்லது மைக்கை பிடிக்கவும்...',
    te: 'ఇక్కడ టైప్ చేయండి లేదా మైక్ నొక్కండి...', mr: 'येथे टाईप करा किंवा मायक्रोफोन दाबा...',
    gu: 'અહીં ટાઇપ કરો અથવા માઇક દબાવો...', kn: 'ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ...',
    ml: 'ഇവിടെ ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ മൈക്ക് പിടിക്കുക...', pa: 'ਇੱਥੇ ਲਿਖੋ ਜਾਂ ਮਾਈਕ ਦਬਾਓ...',
    or: 'ଏଠାରେ ଟାଇପ୍ କରନ୍ତୁ ବା ମାଇକ୍ ଦବାନ୍ତୁ...', as: 'ইয়াত টাইপ কৰক বা মাইক ধৰক...',
  },
  send: {
    en: 'Send', hi: 'भेजें', bn: 'পাঠান', ta: 'அனுப்பு', te: 'పంపు', mr: 'पाठवा',
    gu: 'મોકલો', kn: 'ಕಳುಹಿಸಿ', ml: 'അയക്കുക', pa: 'ਭੇਜੋ', or: 'ପଠାନ୍ତୁ', as: 'পঠাওক',
  },
  livePreview: {
    en: 'Live Preview', hi: 'लाइव पूर्वावलोकन', bn: 'লাইভ প্রিভিউ', ta: 'நேரடி முன்னோட்டம்',
    te: 'లైవ్ ప్రివ్యూ', mr: 'लाइव्ह पूर्वावलोकन', gu: 'લાઇવ પ્રિવ્યૂ', kn: 'ಲೈವ್ ಪ್ರಿವ್ಯೂ',
    ml: 'ലൈവ് പ്രിവ്യൂ', pa: 'ਲਾਈਵ ਪ੍ਰੀਵਿਊ', or: 'ଲାଇଭ ପ୍ରିଭ୍ୟୁ', as: 'লাইভ প্ৰিভিউ',
  },
  issueTitle: {
    en: 'Issue Title', hi: 'समस्या शीर्षक', bn: 'সমস্যার শিরোনাম', ta: 'பிரச்சினை தலைப்பு',
    te: 'సమస్య శీర్షిక', mr: 'समस्येचे शीर्षक', gu: 'સમસ્યાનું શીર્ષક', kn: 'ಸಮಸ್ಯೆಯ ಶೀರ್ಷಿಕೆ',
    ml: 'പ്രശ്നത്തിന്റെ തലക്കെട്ട്', pa: 'ਸਮੱਸਿਆ ਦਾ ਸਿਰਲੇਖ', or: 'ସମସ୍ୟାର ଶୀର୍ଷକ', as: 'সমস্যাৰ শিৰোনাম',
  },
  description: {
    en: 'Description', hi: 'विवरण', bn: 'বিবরণ', ta: 'விளக்கம்', te: 'వివరణ', mr: 'वर्णन',
    gu: 'વર્ણન', kn: 'ವಿವರಣೆ', ml: 'വിവരണം', pa: 'ਵਿਵਰਣ', or: 'ବିବରଣ', as: 'বিৱৰণ',
  },
  category: {
    en: 'Category', hi: 'श्रेणी', bn: 'বিভাগ', ta: 'வகை', te: 'వర్గం', mr: 'श्रेणी',
    gu: 'શ્રેણી', kn: 'ವರ್ಗ', ml: 'വിഭാഗം', pa: 'ਸ਼੍ਰੇਣੀ', or: 'ବର୍ଗ', as: 'শ্ৰেণী',
  },
  location: {
    en: 'Location', hi: 'स्थान', bn: 'অবস্থান', ta: 'இடம்', te: 'స్థానం', mr: 'ठिकाण',
    gu: 'સ્થળ', kn: 'ಸ್ಥಳ', ml: 'സ്ഥലം', pa: 'ਸਥਾਨ', or: 'ସ୍ଥାନ', as: 'স্থান',
  },
  evidence: {
    en: 'Evidence Photos', hi: 'सबूत की फ़ोटो', bn: 'প্রমাণের ছবি', ta: 'சான்று புகைப்படங்கள்',
    te: 'సాక్ష్య ఫోటోలు', mr: 'पुरावा फोटो', gu: 'પ્રમાણ ફોટો', kn: 'ಸಾಕ್ಷ್ಯ ಫೋಟೋಗಳು',
    ml: 'തെളിവ് ഫോട്ടോകൾ', pa: 'ਸਬੂਤ ਫੋਟੋ', or: 'ପ୍ରମାଣ ଫଟୋ', as: 'প্ৰমাণৰ ফটো',
  },
  confirmLocation: {
    en: 'Confirm This Location', hi: 'यह स्थान पुष्टि करें', bn: 'এই অবস্থান নিশ্চিত করুন',
    ta: 'இந்த இடத்தை உறுதிப்படுத்துக', te: 'ఈ స్థానాన్ని నిర్ధారించండి', mr: 'हे ठिकाण पुष्टी करा',
    gu: 'આ સ્થળ કન્ફર્મ કરો', kn: 'ಈ ಸ್ಥಳ ದೃಢಪಡಿಸಿ', ml: 'ഈ സ്ഥലം സ്ഥിരീകരിക്കുക',
    pa: 'ਇਹ ਸਥਾਨ ਪੁਸ਼ਟੀ ਕਰੋ', or: 'ଏହି ସ୍ଥାନ ନିଶ୍ଚିତ କରନ୍ତୁ', as: 'এই স্থান নিশ্চিত কৰক',
  },
  skipPhotos: {
    en: 'Skip Photos', hi: 'फ़ोटो छोड़ें', bn: 'ফটো এড়িয়ে যান', ta: 'படங்களைத் தவிர்க்கவும்',
    te: 'ఫోటోలు దాటవేయి', mr: 'फोटो वगळा', gu: 'ફોટો ছোড়ો', kn: 'ಫೋಟೋ ಬಿಟ್ಟುಬಿಡಿ',
    ml: 'ഫോട്ടോ ഒഴിവാക്കുക', pa: 'ਫੋਟੋ ਛੱਡੋ', or: 'ଫଟୋ ଛାଡ଼ନ୍ତୁ', as: 'ফটো এৰক',
  },
  addPhotos: {
    en: 'Add Photos & Continue', hi: 'फ़ोटो जोड़ें और जारी रखें', bn: 'ছবি যোগ করুন এবং চালিয়ে যান',
    ta: 'படங்கள் சேர்த்து தொடரவும்', te: 'ఫోటోలు జోడించి కొనసాగించు', mr: 'फोटो जोडा आणि पुढे जा',
    gu: 'ફોટો ઉમેરો અને ચાલુ રાખો', kn: 'ಫೋಟೋ ಸೇರಿಸಿ ಮುಂದೆ ಹೋಗಿ', ml: 'ഫോട്ടോ ചേർക്കുക, തുടരുക',
    pa: 'ਫੋਟੋ ਜੋੜੋ ਅਤੇ ਜਾਰੀ ਰਖੋ', or: 'ଫଟୋ ଯୋଡ଼ନ୍ତୁ ଓ ଜାରି ରଖନ୍ତୁ', as: 'ফটো যোগ কৰক আৰু আগবাঢ়ক',
  },
  submittedTitle: {
    en: 'Complaint Submitted!', hi: 'शिकायत दर्ज हुई!', bn: 'অভিযোগ জমা হয়েছে!',
    ta: 'புகார் சமர்ப்பிக்கப்பட்டது!', te: 'ఫిర్యాదు సమర్పించబడింది!', mr: 'तक्रार दाखल झाली!',
    gu: 'ફરિયાદ સబમિટ!', kn: 'ದೂರು ಸಲ್ಲಿಸಲಾಯಿತು!', ml: 'പരാതി സമർപ്പിച്ചു!',
    pa: 'ਸ਼ਿਕਾਇਤ ਦਰਜ!', or: 'ଅଭିଯୋଗ ଦାଖଲ!', as: 'অভিযোগ দাখিল!',
  },
  redirecting: {
    en: 'Redirecting to tracking page...', hi: 'ट्रैकिंग पेज पर जा रहे हैं...',
    bn: 'ট্র্যাকিং পেজে যাচ্ছে...', ta: 'கண்காணிப்பு பக்கத்திற்கு திருப்புகிறது...',
    te: 'ట్రాకింగ్ పేజీకి మళ్ళిస్తోంది...', mr: 'ट्रॅकिंग पेजवर जात आहे...',
    gu: 'ટ્રેકિંગ પૃષ્ઠ પર જઈ રહ્યા છે...', kn: 'ಟ್ರ್ಯಾಕಿಂಗ್ ಪೇಜ್‌ಗೆ ಮರುನಿರ್ದೇಶಿಸಲಾಗುತ್ತಿದೆ...',
    ml: 'ട്രാക്കിംഗ് പേജിലേക്ക് പോകുന്നു...', pa: 'ਟਰੈਕਿੰਗ ਪੇਜ ਤੇ ਜਾ ਰਹੇ ਹਾਂ...',
    or: 'ଟ୍ରାକିଙ୍ଗ ପୃଷ୍ଠায ଯାଉଛୁ...', as: 'ট্ৰেকিং পেজলৈ যাওঁ আছে...',
  },
  englishTranslation: {
    en: 'English Version', hi: 'अंग्रेज़ी संस्करण', bn: 'ইংরেজি সংস্করণ', ta: 'ஆங்கில பதிப்பு',
    te: 'ఇంగ్లీష్ వెర్షన్', mr: 'इंग्रजी आवृत्ती', gu: 'અંગ્રેજી સંસ્કરણ', kn: 'ಇಂಗ್ಲಿಷ್ ಆವೃತ್ತಿ',
    ml: 'ഇംഗ്ലീഷ് പതിപ്പ്', pa: 'ਅੰਗਰੇਜ਼ੀ ਸੰਸਕਰਣ', or: 'ଇଂରାଜୀ ସଂସ୍କରଣ', as: 'ইংৰাজী সংস্কৰণ',
  },
  originalLang: {
    en: 'Original Language', hi: 'मूल भाषा', bn: 'মূল ভাষা', ta: 'மூல மொழி',
    te: 'మూల భాష', mr: 'मूळ भाषा', gu: 'મૂળ ભાષા', kn: 'ಮೂಲ ಭಾಷೆ',
    ml: 'യഥാർഥ ഭാഷ', pa: 'ਮੂਲ ਭਾਸ਼ਾ', or: 'ମୂଳ ଭାଷା', as: 'মূল ভাষা',
  },
  finalReview: {
    en: 'Final Review', hi: 'अंतिम समीक्षा', bn: 'চূড়ান্ত পর্যালোচনা', ta: 'இறுதி மதிப்பாய்வு',
    te: 'చివరి సమీక్ష', mr: 'अंतिम आढावा', gu: 'અંતિમ સમીક્ષા', kn: 'ಅಂತಿಮ ಪರಿಶೀಲನೆ',
    ml: 'അന്തിമ അവലോകനം', pa: 'ਅੰਤਿਮ ਸਮੀਖਿਆ', or: 'ଅଂତିମ ସମୀକ୍ଷା', as: 'চূড়ান্ত পর্যালোচনা',
  },
  editField: {
    en: 'Edit', hi: 'संपादित करें', bn: 'সম্পাদনা', ta: 'திருத்து', te: 'సవరించు', mr: 'संपादित करा',
    gu: 'સંપાદિત કરો', kn: 'ಸಂಪಾದಿಸಿ', ml: 'തിരുത്തുക', pa: 'ਸੰਪਾਦਿਤ ਕਰੋ', or: 'ସଂଶୋଧନ', as: 'সম্পাদনা',
  },
  save: {
    en: 'Save', hi: 'सहेजें', bn: 'সংরক্ষণ', ta: 'சேமி', te: 'సేవ్', mr: 'जतन करा',
    gu: 'સાચવો', kn: 'ಉಳಿಸಿ', ml: 'സേവ്', pa: 'ਸੁਰੱਖਿਅਤ', or: 'ସଞ୍ଚୟ', as: 'সংৰক্ষণ',
  },
  cancel: {
    en: 'Cancel', hi: 'रद्द करें', bn: 'বাতিল', ta: 'ரத்து', te: 'రద్దు', mr: 'रद्द करा',
    gu: 'રદ કરો', kn: 'ರದ್ದು ಮಾಡಿ', ml: 'റദ്ദ് ചെയ്യുക', pa: 'ਰੱਦ ਕਰੋ', or: 'ବାତିଲ', as: 'বাতিল',
  },
  submitting: {
    en: 'Submitting to MCD...', hi: 'MCD को भेज रहे हैं...', bn: 'MCD-তে জমা দেওয়া হচ্ছে...',
    ta: 'MCD-க்கு சமர்ப்பிக்கிறது...', te: 'MCD కి సమర్పిస్తోంది...', mr: 'MCD ला सादर करत आहे...',
    gu: 'MCD ને સબમિટ...', kn: 'MCD ಗೆ ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...', ml: 'MCD-ലേക്ക് സമർപ്പിക്കുന്നു...',
    pa: 'MCD ਨੂੰ ਸਬਮਿਟ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...', or: 'MCD ଙ୍କୁ ଦାଖଲ ହେଉଛି...', as: 'MCD লৈ দাখিল হৈছে...',
  },
  transcribing: {
    en: 'Transcribing...', hi: 'ट्रांसक्राइब हो रहा है...', bn: 'ট্রান্সক্রাইব হচ্ছে...',
    ta: 'டிரான்ஸ்கிரைப் ஆகிறது...', te: 'ట్రాన్స్క్రైబ్ అవుతోంది...', mr: 'ट्रान्सक्राईब होत आहे...',
    gu: 'ટ્રાન્સ્ક્રાઇબ થઈ રહ્યું છે...', kn: 'ಟ್ರಾನ್ಸ್‌ಕ್ರೈಬ್ ಆಗುತ್ತಿದೆ...', ml: 'ട്രാൻസ്ക്രൈബ്...',
    pa: 'ਟ੍ਰਾਂਸਕ੍ਰਾਈਬ ਹੋ ਰਿਹਾ ਹੈ...', or: 'ଟ୍ରାନ୍ସକ୍ରାଇବ ହେଉଛି...', as: 'ট্ৰেন্সক্ৰাইব হৈছে...',
  },
  holdToSpeak: {
    en: 'Hold to speak', hi: 'बोलने के लिए दबाएं', bn: 'বলতে দাবিয়ে ধরুন', ta: 'பேச அழுத்திப் பிடிக்கவும்',
    te: 'మాట్లాడటానికి నొక్కి పట్టండి', mr: 'बोलण्यासाठी दाबा', gu: 'બોલવા દબાઓ', kn: 'ಮಾತನಾಡಲು ಒತ್ತಿ ಹಿಡಿಯಿರಿ',
    ml: 'സംസാരിക്കാൻ ഞക്കി പിടിക്കുക', pa: 'ਬੋਲਣ ਲਈ ਦਬਾਓ', or: 'ଏପ ବୋଲ ପ ବ', as: 'কবলৈ ধৰক',
  },
  autoDetecting: {
    en: 'Auto-detecting category...', hi: 'श्रेणी ऑटो-पहचान हो रही है...', bn: 'বিভাগ স্বয়ংক্রিয়ভাবে শনাক্ত হচ্ছে...',
    ta: 'வகை தானாக கண்டறியப்படுகிறது...', te: 'వర్గం స్వయంచాలకంగా గుర్తించబడుతోంది...', mr: 'श्रेणी आपोआप ओळखली जात आहे...',
    gu: 'શ્રેણી ઓટો-ડિટેક્ટ...', kn: 'ವರ್ಗ ಸ್ವಯಂ ಗುರ್ತಿಸಲಾಗುತ್ತಿದೆ...', ml: 'വർഗ്ഗം സ്വയം തിരിച്ചറിഞ്ഞ്...',
    pa: 'ਸ਼੍ਰੇਣੀ ਆਟੋ-ਪਤਾ ਲਗਾਈ ਜਾ ਰਹੀ ਹੈ...', or: 'ବର୍ଗ ଅଟୋ-ଚିହ୍ନଟ...', as: 'শ্ৰেণী স্বয়ংক্ৰিয়ভাৱে চিনাক্ত হৈছে...',
  },
}

function t(key: string, lang: string): string {
  return UI[key]?.[lang] || UI[key]?.['en'] || key
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'bot'
  text: string      // In selected language
  textEn?: string   // English version
  ts: Date
  widget?: 'location' | 'photos'
}

interface ExtractedData {
  title: string | null           // English
  title_original: string | null  // Selected language
  description: string | null     // English
  description_original: string | null // Selected language
  category: string | null
  address: string | null
  stage: string
}

interface EditState {
  field: 'title' | 'description' | 'category' | 'address' | null
  valueOrig: string
  valueEn: string
}

const STAGE_FIELD: Record<string, keyof ExtractedData | null> = {
  greeting: null,
  asking_title: 'title',
  asking_description: 'description',
  asking_category: 'category',
  asking_address: 'address',
  asking_photos: null,
  confirming: null,
  submitted: null,
}

const QUICK_REPLIES_MULTILANG: Record<string, Record<string, string[]>> = {
  asking_category: {
    en: ['Yes, correct ✅', 'No, change it ❌'],
    hi: ['हाँ, सही है ✅', 'नहीं, बदलें ❌'],
    bn: ['হ্যাঁ, সঠিক ✅', 'না, পরিবর্তন করুন ❌'],
    ta: ['ஆம், சரியானது ✅', 'இல்லை, மாற்றுக ❌'],
    te: ['అవును, సరైనది ✅', 'కాదు, మార్చండి ❌'],
    mr: ['होय, बरोबर ✅', 'नाही, बदला ❌'],
    gu: ['હા, સાચું ✅', 'ના, બદલો ❌'],
    kn: ['ಹೌದು, ಸರಿ ✅', 'ಇಲ್ಲ, ಬದಲಿಸಿ ❌'],
    ml: ['ഉം, ശരി ✅', 'ഇല്ല, മാറ്റുക ❌'],
    pa: ['ਹਾਂ, ਸਹੀ ✅', 'ਨਹੀਂ, ਬਦਲੋ ❌'],
    or: ['ହଁ, ଠିକ ✅', 'ନା, ବଦଳନ୍ତୁ ❌'],
    as: ['হয়, সঠিক ✅', 'নহয়, সলনি কৰক ❌'],
  },
  confirming: {
    en: ['✅ Yes, submit!', '✏️ Change something'],
    hi: ['✅ हाँ, जमा करें!', '✏️ कुछ बदलें'],
    bn: ['✅ হ্যাঁ, জমা দিন!', '✏️ কিছু পরিবর্তন করুন'],
    ta: ['✅ ஆம், சமர்ப்பி!', '✏️ மாற்றங்கள்'],
    te: ['✅ అవును, సమర్పించు!', '✏️ మార్పు'],
    mr: ['✅ होय, सादर करा!', '✏️ बदल करा'],
    gu: ['✅ હા, સબમિટ!', '✏️ ફેરફાર'],
    kn: ['✅ ಹೌದು, ಸಲ್ಲಿಸಿ!', '✏️ ಬದಲಿಸಿ'],
    ml: ['✅ ഉം, സമർപ്പിക്കുക!', '✏️ മാറ്റം'],
    pa: ['✅ ਹਾਂ, ਸਬਮਿਟ!', '✏️ ਬਦਲੋ'],
    or: ['✅ ହଁ, ଦାଖଲ!', '✏️ ବଦଳ'],
    as: ['✅ হয়, দাখিল!', '✏️ সলনি'],
  },
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ChatIntakePage() {
  const navigate = useNavigate()

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [language, setLanguage] = useState('en')
  const [showLang, setShowLang] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('greeting')
  const [threadId] = useState(() => uuidv4())

  const [extracted, setExtracted] = useState<ExtractedData>({
    title: null, title_original: null,
    description: null, description_original: null,
    category: null, address: null, stage: 'greeting',
  })

  // Location
  const [lat, setLat] = useState(28.6139)
  const [lng, setLng] = useState(77.2090)
  const [address, setAddress] = useState('')
  const [locationDone, setLocationDone] = useState(false)

  // Photos
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [photosDone, setPhotosDone] = useState(false)

  // Voice
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  // Layout
  const [wideLayout, setWideLayout] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  // Edit state for final review
  const [editState, setEditState] = useState<EditState>({ field: null, valueOrig: '', valueEn: '' })

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [complaintId, setComplaintId] = useState<string | null>(null)

  // Show bilingual final review panel
  const [showFinalReview, setShowFinalReview] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const hasInit = useRef(false)

  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0]
  const isNonEnglish = language !== 'en'

  useEffect(() => {
    const check = () => setWideLayout(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Init with greeting in selected language
  useEffect(() => {
    if (hasInit.current) return
    hasInit.current = true
    callAgent('', true)
  }, [])

  // When stage becomes 'confirming', show the final review
  useEffect(() => {
    if (stage === 'confirming' || stage === 'submitted') {
      setShowFinalReview(true)
    }
  }, [stage])

  const addMsg = (role: Message['role'], text: string, textEn?: string, widget?: Message['widget']) => {
    setMessages(prev => [...prev, { id: uuidv4(), role, text, textEn, ts: new Date(), widget }])
  }

  const callAgent = useCallback(async (userMsg: string, isInit = false) => {
    if (loading) return
    if (!isInit && !userMsg.trim()) return

    if (!isInit && userMsg.trim()) addMsg('user', userMsg)
    setInputText('')
    setLoading(true)

    try {
      const { data } = await api.post('/api/chatbot/message', {
        message: userMsg || '',
        thread_id: threadId,
        language,
        latitude: lat,
        longitude: lng,
      })

      const newStage = data.stage || 'greeting'
      setStage(newStage)

      if (data.extracted) {
        setExtracted(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.extracted).filter(([, v]) => v != null)
          ),
          stage: newStage,
        }))
        if (data.extracted.address) setAddress(data.extracted.address)
      }

      const replyText = data.reply || ''
      const replyEn = data.reply_en || replyText

      if (newStage === 'asking_address') {
        addMsg('bot', replyText, replyEn, 'location')
      } else if (newStage === 'asking_photos') {
        addMsg('bot', replyText, replyEn, 'photos')
      } else {
        addMsg('bot', replyText, replyEn)
      }

      if (newStage === 'submitted' && data.complaint_payload) {
        await submitComplaint(data.complaint_payload)
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Connection error. Please try again.'
      addMsg('bot', msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [loading, language, threadId, lat, lng])

  const submitComplaint = async (payload: any) => {
    setSubmitting(true)
    try {
      const { data } = await complaintsAPI.submit({
        title: payload.title || 'Civic Issue',
        description: payload.description || payload.description_original || '',
        category: payload.category || 'other',
        original_language: payload.original_language || language,
        location_address: address || payload.location_address || '',
        location_lat: lat,
        location_lng: lng,
        photos,
        voice_transcript: payload.voice_transcript || null,
      })
      setComplaintId(data.complaint_id)
      toast.success(t('submittedTitle', language))
      setTimeout(() => navigate(`/citizen/track/${data.complaint_id}`), 2500)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmLocation = async () => {
    if (!address.trim()) {
      toast.error(language === 'hi' ? 'कृपया स्थान जोड़ें' : 'Please add a location first')
      return
    }
    setLocationDone(true)
    addMsg('user', `📍 ${address}`)
    await callAgent(address)
  }

  const confirmPhotos = async () => {
    setPhotosDone(true)
    const lang = language
    const msg = photos.length > 0
      ? `📸 ${photos.length} ${lang === 'hi' ? 'फ़ोटो जोड़ी' : 'photo(s) added'}`
      : `⏭️ ${t('skipPhotos', lang)}`
    addMsg('user', msg)
    await callAgent(photos.length > 0
      ? `I have added ${photos.length} photo(s) as evidence`
      : 'No photos, please continue')
  }

  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} too large`)
        continue
      }
      try {
        const { data } = await uploadAPI.uploadPhoto(file)
        if (data.public_url) setPhotos(p => [...p, data.public_url])
      } catch {
        setPhotos(p => [...p, URL.createObjectURL(file)])
      }
    }
    setUploading(false)
    if (e.target) e.target.value = ''
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(tr => tr.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 500) { toast.error('Too short — speak clearly'); return }
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
          if (language !== 'en') form.append('language_hint', language)
          const { data } = await api.post('/api/chatbot/transcribe', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (data.transcript?.trim()) {
            callAgent(data.transcript.trim())
          } else {
            toast.error('Could not understand speech. Please try again or type.')
          }
        } catch {
          toast.error('Transcription failed. Please type your message.')
        } finally {
          setTranscribing(false)
        }
      }
      rec.start()
      mediaRef.current = rec
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRef.current?.state !== 'inactive') mediaRef.current?.stop()
    setIsRecording(false)
  }

  // ── Edit handlers ──────────────────────────────────────────────────────────
  const startEdit = (field: EditState['field']) => {
    const origVal = field === 'title' ? (extracted.title_original || extracted.title || '')
      : field === 'description' ? (extracted.description_original || extracted.description || '')
      : field === 'category' ? (extracted.category || '')
      : field === 'address' ? (extracted.address || address || '')
      : ''
    const enVal = field === 'title' ? (extracted.title || '')
      : field === 'description' ? (extracted.description || '')
      : field === 'category' ? (extracted.category || '')
      : (extracted.address || address || '')
    setEditState({ field, valueOrig: origVal, valueEn: enVal })
  }

  const saveEdit = () => {
    if (!editState.field) return
    const { field, valueOrig, valueEn } = editState
    if (field === 'title') {
      setExtracted(p => ({ ...p, title: valueEn || valueOrig, title_original: valueOrig }))
    } else if (field === 'description') {
      setExtracted(p => ({ ...p, description: valueEn || valueOrig, description_original: valueOrig }))
    } else if (field === 'category') {
      setExtracted(p => ({ ...p, category: valueEn }))
    } else if (field === 'address') {
      setExtracted(p => ({ ...p, address: valueOrig }))
      setAddress(valueOrig)
    }
    // Inform chatbot of the change
    if (valueOrig.trim()) {
      callAgent(`I want to change the ${field} to: ${valueOrig}`)
    }
    setEditState({ field: null, valueOrig: '', valueEn: '' })
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const quickReplies = (QUICK_REPLIES_MULTILANG[stage] || {})[language]
    || (QUICK_REPLIES_MULTILANG[stage] || {})['en']
    || []
  const catCfg = extracted.category ? CATEGORY_CONFIG[extracted.category] : null
  const isSubmitted = stage === 'submitted'
  const progress = ['title', 'description', 'category', 'address']
    .filter(f => extracted[f as keyof ExtractedData]).length

  // Language selector display
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language)

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className={`-mx-4 md:-mx-8 flex ${wideLayout ? 'h-[calc(100dvh-64px)]' : 'flex-col min-h-[calc(100dvh-64px)]'}`}>

        {/* ═══════════════════ CHAT PANEL ═══════════════════════════════════ */}
        <div className={`flex flex-col bg-slate-950 ${wideLayout ? 'w-[56%]' : 'flex-1'}`}>

          {/* Header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
            <button onClick={() => navigate('/citizen/dashboard')}
              className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 shrink-0">
              <ArrowLeft size={16} className="text-slate-300" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm font-body">{t('title', language)}</p>
              <p className="text-slate-400 text-xs font-body truncate">{t('subtitle', language)}</p>
            </div>

            {/* Language picker */}
            <div className="relative">
              <button onClick={() => setShowLang(!showLang)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 text-xs font-body hover:bg-slate-700 transition-colors">
                <Globe size={12} />
                <span>{currentLang?.nativeName || 'EN'}</span>
                <ChevronDown size={10} className={`transition-transform ${showLang ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showLang && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute right-0 top-full mt-1 z-50 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                    {SUPPORTED_LANGUAGES.map(l => (
                      <button key={l.code}
                        onClick={() => { setLanguage(l.code); setShowLang(false) }}
                        className={`w-full text-left px-3 py-2.5 text-xs font-body flex justify-between items-center transition-colors
                          ${l.code === language ? 'bg-primary-600/20 text-primary-400' : 'text-slate-300 hover:bg-slate-700'}`}>
                        <span className="font-semibold">{l.nativeName}</span>
                        <span className="text-slate-500 text-[10px]">{l.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Switch to form */}
            <button onClick={() => navigate('/citizen/submit-form')} title="Step-by-step form"
              className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400">
              <FileText size={14} />
            </button>

            {/* Mobile preview toggle */}
            {!wideLayout && (
              <button onClick={() => setShowPreview(!showPreview)}
                className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400">
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>

          {/* Mobile preview strip */}
          {!wideLayout && (
            <AnimatePresence>
              {showPreview && (
                <motion.div initial={{ height: 0 }} animate={{ height: 180 }} exit={{ height: 0 }}
                  className="shrink-0 overflow-hidden border-b border-slate-800">
                  <PreviewPanel
                    extracted={extracted} activeField={STAGE_FIELD[stage] || null}
                    catCfg={catCfg} progress={progress} isSubmitted={isSubmitted}
                    stage={stage} language={language}
                    editState={editState} onEdit={startEdit}
                    onEditChange={(orig, en) => setEditState(s => ({ ...s, valueOrig: orig, valueEn: en }))}
                    onSave={saveEdit} onCancelEdit={() => setEditState({ field: null, valueOrig: '', valueEn: '' })}
                    lat={lat} lng={lng} address={address} photos={photos}
                    isNonEnglish={isNonEnglish}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id}>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                  {msg.role === 'bot' && (
                    <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center shrink-0 text-sm mb-0.5">🏙️</div>
                  )}
                  <div className="max-w-[82%] space-y-1">
                    <div className={`px-4 py-2.5 text-sm font-body leading-relaxed rounded-2xl
                      ${msg.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-sm'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'}`}>
                      {msg.text}
                    </div>
                    {/* Show English translation for bot messages in non-English mode */}
                    {msg.role === 'bot' && isNonEnglish && msg.textEn && msg.textEn !== msg.text && (
                      <div className="px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-xl text-[11px] text-slate-500 font-body italic">
                        {msg.textEn}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Location widget */}
                {msg.widget === 'location' && !locationDone && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="ml-10 mt-3 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-400 font-body flex items-center gap-1.5">
                        <MapPin size={12} /> {t('location', language)}
                      </span>
                    </div>
                    <LocationPickerMini
                      lat={lat} lng={lng} address={address}
                      language={language}
                      onLocationSelect={(la, lo, addr) => {
                        setLat(la); setLng(lo); setAddress(addr)
                        setExtracted(p => ({ ...p, address: addr }))
                      }}
                    />
                    {address && (
                      <div className="mx-3 mb-2 px-3 py-2 bg-slate-800 rounded-xl">
                        <p className="text-xs text-slate-400 font-body flex items-center gap-1">
                          <MapPin size={10} className="text-primary-400 shrink-0" /> {address}
                        </p>
                      </div>
                    )}
                    <div className="px-3 pb-3">
                      <button onClick={confirmLocation}
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-xl font-body transition-colors flex items-center justify-center gap-2">
                        <CheckCircle2 size={15} /> {t('confirmLocation', language)}
                      </button>
                    </div>
                  </motion.div>
                )}
                {msg.widget === 'location' && locationDone && (
                  <div className="ml-10 mt-2">
                    <span className="text-xs text-green-400 font-body flex items-center gap-1">
                      <CheckCircle2 size={11} /> {address.slice(0, 60)}{address.length > 60 ? '…' : ''}
                    </span>
                  </div>
                )}

                {/* Photos widget */}
                {msg.widget === 'photos' && !photosDone && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="ml-10 mt-3 bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-400 font-body flex items-center gap-1.5">
                        <Camera size={12} /> {t('evidence', language)} ({photos.length}/5)
                      </span>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
                    <button onClick={() => fileRef.current?.click()}
                      disabled={photos.length >= 5 || uploading}
                      className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-primary-500 hover:text-primary-400 transition-colors text-sm font-body disabled:opacity-50">
                      {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><ImageIcon size={14} /> {language === 'en' ? 'Tap to add photos' : '📸'}</>}
                    </button>
                    {photos.length > 0 && (
                      <div className="grid grid-cols-5 gap-2">
                        {photos.map((url, i) => (
                          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={10} className="text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={confirmPhotos}
                        className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-xl font-body transition-colors flex items-center justify-center gap-2">
                        <CheckCircle2 size={15} />
                        {photos.length > 0 ? t('addPhotos', language) : t('skipPhotos', language)}
                      </button>
                    </div>
                  </motion.div>
                )}
                {msg.widget === 'photos' && photosDone && (
                  <div className="ml-10 mt-2">
                    <span className="text-xs text-green-400 font-body flex items-center gap-1">
                      <CheckCircle2 size={11} /> {photos.length > 0 ? `${photos.length} photo(s)` : t('skipPhotos', language)}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {(loading || transcribing || submitting) && (
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center shrink-0 text-sm">🏙️</div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  {submitting ? (
                    <p className="text-xs text-slate-400 font-body flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" /> {t('submitting', language)}
                    </p>
                  ) : transcribing ? (
                    <p className="text-xs text-slate-400 font-body flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" /> {t('transcribing', language)}
                    </p>
                  ) : (
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                          className="w-2 h-2 bg-slate-400 rounded-full" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success */}
            {(stage === 'submitted' || complaintId) && !submitting && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center">
                <div className="bg-green-900/30 border border-green-700/40 rounded-2xl px-6 py-4 text-center">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-green-300 font-semibold font-body text-sm">{t('submittedTitle', language)}</p>
                  <p className="text-green-400/70 text-xs font-body mt-1">{t('redirecting', language)}</p>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {quickReplies.length > 0 && !isSubmitted && (
            <div className="flex gap-2 px-4 py-2 bg-slate-950 overflow-x-auto scrollbar-hide shrink-0">
              {quickReplies.map(r => (
                <button key={r} onClick={() => callAgent(r)}
                  className="shrink-0 px-4 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-300 hover:border-primary-500 hover:text-primary-400 font-body transition-all whitespace-nowrap">
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          {!isSubmitted && stage !== 'asking_address' && stage !== 'asking_photos' && (
            <div className="shrink-0 px-4 py-3 bg-slate-900 border-t border-slate-800">
              <div className="flex gap-2 items-end">
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); callAgent(inputText) } }}
                  placeholder={t('typePlaceholder', language)}
                  rows={1}
                  disabled={loading || transcribing}
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-2xl px-4 py-2.5 text-sm font-body resize-none outline-none focus:border-primary-500 placeholder:text-slate-500 disabled:opacity-50 transition-colors"
                  style={{ maxHeight: 100, overflowY: 'auto' }}
                />
                {/* Voice button */}
                <motion.button
                  onMouseDown={startRecording} onMouseUp={stopRecording}
                  onTouchStart={e => { e.preventDefault(); startRecording() }}
                  onTouchEnd={e => { e.preventDefault(); stopRecording() }}
                  disabled={loading || transcribing}
                  whileTap={{ scale: 0.92 }}
                  title={t('holdToSpeak', language)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 select-none touch-none transition-all
                    ${isRecording ? 'bg-red-600 border-2 border-red-400 animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.5)]'
                      : 'bg-slate-800 border border-slate-700 hover:border-slate-500'}
                    disabled:opacity-40`}>
                  {transcribing ? <Loader2 size={15} className="animate-spin text-primary-400" />
                    : isRecording ? <MicOff size={15} className="text-white" />
                    : <Mic size={15} className="text-slate-400" />}
                </motion.button>
                {/* Send button */}
                <button onClick={() => callAgent(inputText)}
                  disabled={!inputText.trim() || loading}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40 disabled:cursor-default shadow-glow-blue disabled:shadow-none transition-all">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <p className="text-center text-slate-600 text-[10px] font-body mt-1.5">
                {langMeta.nativeName} • {t('holdToSpeak', language)} • Enter to send
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════════ PREVIEW / REVIEW PANEL (Desktop) ═════════════ */}
        {wideLayout && (
          <div className="w-[44%] flex flex-col border-l border-slate-800 overflow-hidden">
            {showFinalReview ? (
              <FinalReviewPanel
                extracted={extracted} catCfg={catCfg} language={language}
                isNonEnglish={isNonEnglish} isSubmitted={isSubmitted}
                submitting={submitting} complaintId={complaintId}
                editState={editState} onEdit={startEdit}
                onEditChange={(orig, en) => setEditState(s => ({ ...s, valueOrig: orig, valueEn: en }))}
                onSave={saveEdit}
                onCancelEdit={() => setEditState({ field: null, valueOrig: '', valueEn: '' })}
                address={address} photos={photos}
                onSubmitDirect={() => callAgent('YES submit')}
              />
            ) : (
              <PreviewPanel
                extracted={extracted} activeField={STAGE_FIELD[stage] || null}
                catCfg={catCfg} progress={progress} isSubmitted={isSubmitted}
                stage={stage} language={language}
                editState={editState} onEdit={startEdit}
                onEditChange={(orig, en) => setEditState(s => ({ ...s, valueOrig: orig, valueEn: en }))}
                onSave={saveEdit} onCancelEdit={() => setEditState({ field: null, valueOrig: '', valueEn: '' })}
                lat={lat} lng={lng} address={address} photos={photos}
                isNonEnglish={isNonEnglish}
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LIVE PREVIEW PANEL
// ══════════════════════════════════════════════════════════════════════════════

interface PreviewProps {
  extracted: ExtractedData
  activeField: keyof ExtractedData | null
  catCfg: any
  progress: number
  isSubmitted: boolean
  stage: string
  language: string
  isNonEnglish: boolean
  editState: EditState
  onEdit: (field: EditState['field']) => void
  onEditChange: (orig: string, en: string) => void
  onSave: () => void
  onCancelEdit: () => void
  lat: number; lng: number; address: string; photos: string[]
}

function PreviewPanel({ extracted, activeField, catCfg, progress, isSubmitted, stage, language, isNonEnglish, editState, onEdit, onEditChange, onSave, onCancelEdit, address, photos }: PreviewProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-primary-400" />
          <span className="font-semibold text-white text-sm font-body">{t('livePreview', language)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${(progress / 4) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-400 font-body">{progress}/4</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* Title */}
        <LiveField
          icon={<Edit3 size={12} />} label={t('issueTitle', language)}
          value={isNonEnglish ? (extracted.title_original || extracted.title) : extracted.title}
          valueEn={isNonEnglish ? extracted.title : null}
          isActive={activeField === 'title'} language={language}
          isEditing={editState.field === 'title'} editValue={editState.valueOrig} editValueEn={editState.valueEn}
          onEdit={() => onEdit('title')}
          onEditChange={onEditChange} onSave={onSave} onCancel={onCancelEdit}
          isNonEnglish={isNonEnglish}
          placeholder={language === 'hi' ? 'समस्या का शीर्षक' : 'Issue title'}
        />

        {/* Description */}
        <LiveField
          icon={<AlignLeft size={12} />} label={t('description', language)}
          value={isNonEnglish ? (extracted.description_original || extracted.description) : extracted.description}
          valueEn={isNonEnglish ? extracted.description : null}
          isActive={activeField === 'description'} language={language}
          isEditing={editState.field === 'description'} editValue={editState.valueOrig} editValueEn={editState.valueEn}
          onEdit={() => onEdit('description')}
          onEditChange={onEditChange} onSave={onSave} onCancel={onCancelEdit}
          isNonEnglish={isNonEnglish} multiline
          placeholder={language === 'hi' ? 'विवरण' : 'Description'}
        />

        {/* Category */}
        <div className={`rounded-xl border p-3 transition-all ${activeField === 'category' ? 'border-primary-500 bg-primary-600/10' : 'border-slate-700 bg-slate-800/50'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Tag size={12} className={activeField === 'category' ? 'text-primary-400' : 'text-slate-500'} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('category', language)}</span>
              {activeField === 'category' && <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />}
            </div>
          </div>
          {extracted.category ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{catCfg?.icon || '📋'}</span>
              <span className="text-sm font-semibold text-slate-200 font-body">{catCfg?.label || extracted.category}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic font-body">
              {activeField === 'category' ? t('autoDetecting', language) : t('category', language) + '...'}
            </p>
          )}
        </div>

        {/* Location */}
        <div className={`rounded-xl border p-3 transition-all ${activeField === 'address' || stage === 'asking_address' ? 'border-primary-500 bg-primary-600/10' : 'border-slate-700 bg-slate-800/50'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={12} className={activeField === 'address' ? 'text-primary-400' : 'text-slate-500'} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('location', language)}</span>
          </div>
          {address ? (
            <p className="text-xs text-slate-200 font-body leading-snug">{address}</p>
          ) : (
            <p className="text-xs text-slate-600 italic font-body">
              {stage === 'asking_address' ? '📍 ...' : t('location', language) + '...'}
            </p>
          )}
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Camera size={12} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('evidence', language)}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {photos.map((url, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-600">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage hint */}
        {!isSubmitted && (
          <p className="text-center text-[10px] text-slate-600 font-body">
            {stage === 'greeting' && '👋'}
            {stage === 'asking_title' && `✏️ ${t('issueTitle', language)}...`}
            {stage === 'asking_description' && `📝 ${t('description', language)}...`}
            {stage === 'asking_category' && `🏷️ ${t('category', language)}...`}
            {stage === 'asking_address' && `📍 ${t('location', language)}...`}
            {stage === 'asking_photos' && `📸 ${t('evidence', language)}...`}
            {stage === 'confirming' && `✅ ${t('finalReview', language)}`}
          </p>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FINAL BILINGUAL REVIEW PANEL
// ══════════════════════════════════════════════════════════════════════════════

interface FinalReviewProps {
  extracted: ExtractedData
  catCfg: any
  language: string
  isNonEnglish: boolean
  isSubmitted: boolean
  submitting: boolean
  complaintId: string | null
  editState: EditState
  onEdit: (field: EditState['field']) => void
  onEditChange: (orig: string, en: string) => void
  onSave: () => void
  onCancelEdit: () => void
  address: string
  photos: string[]
  onSubmitDirect: () => void
}

function FinalReviewPanel({ extracted, catCfg, language, isNonEnglish, isSubmitted, submitting, complaintId, editState, onEdit, onEditChange, onSave, onCancelEdit, address, photos, onSubmitDirect }: FinalReviewProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 bg-slate-900">
        <h3 className="font-display font-bold text-white text-sm">{t('finalReview', language)}</h3>
        {isNonEnglish && (
          <p className="text-[10px] text-slate-500 font-body mt-0.5">
            {SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName} + English
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Title section */}
        <FinalField
          label={t('issueTitle', language)} icon="✏️"
          origValue={extracted.title_original || extracted.title}
          enValue={extracted.title}
          language={language} isNonEnglish={isNonEnglish}
          isEditing={editState.field === 'title'}
          editValueOrig={editState.valueOrig} editValueEn={editState.valueEn}
          onEdit={() => onEdit('title')}
          onEditChange={onEditChange} onSave={onSave} onCancel={onCancelEdit}
        />

        {/* Description section */}
        <FinalField
          label={t('description', language)} icon="📝"
          origValue={extracted.description_original || extracted.description}
          enValue={extracted.description}
          language={language} isNonEnglish={isNonEnglish}
          isEditing={editState.field === 'description'}
          editValueOrig={editState.valueOrig} editValueEn={editState.valueEn}
          onEdit={() => onEdit('description')}
          onEditChange={onEditChange} onSave={onSave} onCancel={onCancelEdit}
          multiline
        />

        {/* Category */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-body mb-2">🏷️ {t('category', language)}</p>
          {extracted.category ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{catCfg?.icon || '📋'}</span>
              <div>
                <p className="text-sm font-bold text-white">{catCfg?.label || extracted.category}</p>
                {isNonEnglish && <p className="text-xs text-slate-400">{extracted.category}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">—</p>
          )}
        </div>

        {/* Location */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-body">📍 {t('location', language)}</p>
            <button onClick={() => onEdit('address')}
              className="text-[10px] text-slate-500 hover:text-primary-400 font-body flex items-center gap-0.5">
              <Edit3 size={9} /> {t('editField', language)}
            </button>
          </div>
          {editState.field === 'address' ? (
            <div className="space-y-2">
              <input type="text" value={editState.valueOrig}
                onChange={e => onEditChange(e.target.value, e.target.value)}
                className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg px-2 py-1.5 text-xs font-body outline-none" />
              <div className="flex gap-1.5">
                <button onClick={onSave} className="flex-1 py-1 bg-primary-600 text-white text-[10px] rounded-lg font-semibold font-body">{t('save', language)}</button>
                <button onClick={onCancelEdit} className="flex-1 py-1 bg-slate-700 text-slate-300 text-[10px] rounded-lg font-body">{t('cancel', language)}</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-200 font-body">{address || extracted.address || '—'}</p>
          )}
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-body mb-2">📸 {t('evidence', language)}</p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((url, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-700">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bilingual note */}
        {isNonEnglish && (
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3">
            <p className="text-xs text-blue-300 font-body">
              📘 Both {SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName} and English versions saved. Officers see the English version.
            </p>
          </div>
        )}

        {/* Submit / Success */}
        {(isSubmitted || complaintId) ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-green-900/30 border border-green-700/40 rounded-2xl p-4 text-center">
            <CheckCircle2 size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-green-300 font-semibold text-sm font-body">{t('submittedTitle', language)}</p>
          </motion.div>
        ) : submitting ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-primary-400" />
            <span className="ml-2 text-sm text-slate-400 font-body">{t('submitting', language)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LIVE FIELD (Preview)
// ══════════════════════════════════════════════════════════════════════════════

interface LiveFieldProps {
  icon: React.ReactNode; label: string
  value: string | null; valueEn: string | null
  isActive: boolean; language: string; isNonEnglish: boolean
  isEditing: boolean; editValue: string; editValueEn: string
  onEdit: () => void
  onEditChange: (orig: string, en: string) => void
  onSave: () => void; onCancel: () => void
  placeholder: string; multiline?: boolean
}

function LiveField({ icon, label, value, valueEn, isActive, language, isNonEnglish, isEditing, editValue, editValueEn, onEdit, onEditChange, onSave, onCancel, placeholder, multiline }: LiveFieldProps) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${isActive ? 'border-primary-500 bg-primary-600/10 shadow-[0_0_10px_rgba(37,99,235,0.2)]' : 'border-slate-700 bg-slate-800/50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={isActive ? 'text-primary-400' : 'text-slate-500'}>{icon}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          {isActive && <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />}
        </div>
        {value && !isEditing && (
          <button onClick={onEdit} className="text-[10px] text-slate-500 hover:text-primary-400 font-body flex items-center gap-0.5">
            <Edit3 size={9} /> Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-1.5">
          {multiline
            ? <textarea value={editValue} onChange={e => onEditChange(e.target.value, editValueEn)} rows={2} autoFocus
                className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg px-2 py-1.5 text-xs font-body resize-none outline-none" />
            : <input type="text" value={editValue} onChange={e => onEditChange(e.target.value, editValueEn)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
                className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg px-2 py-1.5 text-xs font-body outline-none" />
          }
          {isNonEnglish && (
            <input type="text" value={editValueEn} onChange={e => onEditChange(editValue, e.target.value)}
              placeholder="English translation"
              className="w-full bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg px-2 py-1.5 text-xs font-body outline-none" />
          )}
          <div className="flex gap-1.5">
            <button onClick={onSave} className="flex-1 py-1 bg-primary-600 text-white text-[10px] rounded-lg font-semibold font-body">Save</button>
            <button onClick={onCancel} className="flex-1 py-1 bg-slate-700 text-slate-300 text-[10px] rounded-lg font-body">Cancel</button>
          </div>
        </div>
      ) : value ? (
        <div>
          <p className={`text-xs font-body leading-snug ${isActive ? 'text-primary-200' : 'text-slate-200'}`}>
            {(value || '').slice(0, 80)}{(value || '').length > 80 ? '…' : ''}
          </p>
          {isNonEnglish && valueEn && valueEn !== value && (
            <p className="text-[10px] text-slate-500 font-body mt-1 italic">{(valueEn || '').slice(0, 60)}{(valueEn || '').length > 60 ? '…' : ''}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic font-body">
          {isActive ? '⌨️ ...' : placeholder}
        </p>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FINAL FIELD (Review Panel with full edit)
// ══════════════════════════════════════════════════════════════════════════════

interface FinalFieldProps {
  label: string; icon: string
  origValue: string | null; enValue: string | null
  language: string; isNonEnglish: boolean
  isEditing: boolean; editValueOrig: string; editValueEn: string
  onEdit: () => void
  onEditChange: (orig: string, en: string) => void
  onSave: () => void; onCancel: () => void
  multiline?: boolean
}

function FinalField({ label, icon, origValue, enValue, language, isNonEnglish, isEditing, editValueOrig, editValueEn, onEdit, onEditChange, onSave, onCancel, multiline }: FinalFieldProps) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-body">{icon} {label}</p>
        {!isEditing && (origValue || enValue) && (
          <button onClick={onEdit}
            className="text-[10px] text-slate-500 hover:text-primary-400 font-body flex items-center gap-0.5">
            <Edit3 size={9} /> {t('editField', language)}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {/* Original language field */}
          {isNonEnglish && (
            <div>
              <p className="text-[9px] text-primary-400 font-body mb-1 uppercase tracking-wider">
                {t('originalLang', language)} ({SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName})
              </p>
              {multiline
                ? <textarea value={editValueOrig} onChange={e => onEditChange(e.target.value, editValueEn)} rows={3}
                    className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg px-3 py-2 text-sm font-body resize-none outline-none" />
                : <input type="text" value={editValueOrig} onChange={e => onEditChange(e.target.value, editValueEn)} autoFocus
                    className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg px-3 py-2 text-sm font-body outline-none" />
              }
            </div>
          )}
          {/* English field */}
          <div>
            <p className="text-[9px] text-green-400 font-body mb-1 uppercase tracking-wider">{t('englishTranslation', language)}</p>
            {multiline
              ? <textarea value={editValueEn} onChange={e => onEditChange(editValueOrig, e.target.value)} rows={3}
                  className="w-full bg-slate-700/50 border border-green-600/40 text-green-200 rounded-lg px-3 py-2 text-sm font-body resize-none outline-none" />
              : <input type="text" value={isNonEnglish ? editValueEn : editValueOrig}
                  onChange={e => isNonEnglish ? onEditChange(editValueOrig, e.target.value) : onEditChange(e.target.value, e.target.value)}
                  className="w-full bg-slate-700/50 border border-green-600/40 text-green-200 rounded-lg px-3 py-2 text-sm font-body outline-none" />
            }
          </div>
          <div className="flex gap-2">
            <button onClick={onSave} className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold font-body text-sm transition-colors">
              <Check size={14} className="inline mr-1" /> {t('save', language)}
            </button>
            <button onClick={onCancel} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-body text-sm transition-colors">
              {t('cancel', language)}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {isNonEnglish && origValue && (
            <div>
              <p className="text-[9px] text-primary-400 font-body uppercase tracking-wider mb-0.5">
                {SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName}
              </p>
              <p className="text-sm text-white font-body leading-snug">{origValue}</p>
            </div>
          )}
          {(isNonEnglish ? enValue : origValue) && (
            <div className={isNonEnglish ? 'pt-1.5 border-t border-slate-700' : ''}>
              {isNonEnglish && <p className="text-[9px] text-green-400 font-body uppercase tracking-wider mb-0.5">English</p>}
              <p className={`text-sm font-body leading-snug ${isNonEnglish ? 'text-green-200' : 'text-white'}`}>
                {isNonEnglish ? (enValue || '—') : (origValue || '—')}
              </p>
            </div>
          )}
          {!origValue && !enValue && <p className="text-sm text-slate-500 italic font-body">—</p>}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCATION PICKER MINI (Dark theme, embedded)
// ══════════════════════════════════════════════════════════════════════════════

interface LPMiniProps {
  lat: number; lng: number; address: string; language: string
  onLocationSelect: (lat: number, lng: number, addr: string) => void
}

function LocationPickerMini({ lat, lng, address, language, onLocationSelect }: LPMiniProps) {
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    import('leaflet').then(L => {
      const Lx = L.default || L
      delete (Lx.Icon.Default.prototype as any)._getIconUrl
      Lx.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })

      const ICON = Lx.divIcon({
        className: '',
        html: `<div style="width:26px;height:34px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))"><svg viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 0C5.82 0 0 5.82 0 13c0 8.67 11.375 20.667 12.3 21.667a1 1 0 001.4 0C14.625 33.667 26 21.67 26 13 26 5.82 20.18 0 13 0z" fill="#3b82f6"/><circle cx="13" cy="12" r="5" fill="white" opacity="0.9"/><circle cx="13" cy="12" r="3" fill="#3b82f6"/></svg></div>`,
        iconSize: [26, 34], iconAnchor: [13, 34],
      })

      if (!containerRef.current) return
      const map = Lx.map(containerRef.current, { center: [lat, lng], zoom: 15, scrollWheelZoom: false, zoomControl: true })
      Lx.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO', subdomains: 'abcd', maxZoom: 19 }).addTo(map)
      const marker = Lx.marker([lat, lng], { draggable: true, icon: ICON }).addTo(map)
      marker.on('dragend', async () => {
        const { lat: la, lng: lo } = marker.getLatLng()
        const addr = await reverseGeocode(la, lo)
        onLocationSelect(la, lo, addr)
      })
      map.on('click', async (e: any) => {
        const la = e.latlng.lat, lo = e.latlng.lng
        marker.setLatLng([la, lo])
        map.setView([la, lo], 16, { animate: true })
        const addr = await reverseGeocode(la, lo)
        onLocationSelect(la, lo, addr)
      })
      mapRef.current = map
      markerRef.current = marker
      setTimeout(() => map.invalidateSize(), 150)
    })
    return () => { mapRef.current?.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  const reverseGeocode = async (la: number, lo: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&zoom=17`, { headers: { 'Accept-Language': 'en' } })
      const data = await res.json()
      const a = data.address || {}
      return [a.road || a.pedestrian, a.neighbourhood || a.suburb, a.city || a.town].filter(Boolean).join(', ')
        || data.display_name?.split(',').slice(0, 3).join(', ') || `${la.toFixed(5)}, ${lo.toFixed(5)}`
    } catch { return `${la.toFixed(5)}, ${lo.toFixed(5)}` }
  }

  const useGPS = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(async ({ coords: { latitude: la, longitude: lo } }) => {
      if (mapRef.current && markerRef.current) { markerRef.current.setLatLng([la, lo]); mapRef.current.setView([la, lo], 17, { animate: true }) }
      const addr = await reverseGeocode(la, lo)
      onLocationSelect(la, lo, addr)
      setGpsLoading(false)
    }, () => { setGpsLoading(false) }, { timeout: 10000, enableHighAccuracy: true })
  }

  const searchAddr = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Delhi India')}&format=json&limit=1`, { headers: { 'Accept-Language': 'en' } })
      const results = await res.json()
      if (results[0]) {
        const la = parseFloat(results[0].lat), lo = parseFloat(results[0].lon)
        if (mapRef.current && markerRef.current) { markerRef.current.setLatLng([la, lo]); mapRef.current.setView([la, lo], 16, { animate: true }) }
        const addr = results[0].display_name.split(',').slice(0, 3).join(', ')
        onLocationSelect(la, lo, addr)
        setQuery('')
      }
    } finally { setSearching(false) }
  }

  return (
    <div className="px-3 pb-1 space-y-2">
      <div className="flex gap-2">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchAddr()}
          placeholder="Search colony, landmark..."
          className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-body outline-none focus:border-primary-500 placeholder:text-slate-600" />
        <button onClick={searchAddr} disabled={searching}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-body">
          {searching ? <Loader2 size={12} className="animate-spin" /> : '🔍'}
        </button>
        <button onClick={useGPS} disabled={gpsLoading}
          className="px-3 py-2 bg-primary-600/20 border border-primary-500/40 hover:bg-primary-600/30 text-primary-400 rounded-xl text-xs font-body flex items-center gap-1">
          {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
          <span className="hidden sm:inline">GPS</span>
        </button>
      </div>
      <div className="relative rounded-xl overflow-hidden border border-slate-700">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none bg-slate-900/90 text-slate-300 text-[9px] font-body px-2 py-1 rounded-full whitespace-nowrap">
          📍 Click map or drag pin
        </div>
        <div ref={containerRef} style={{ height: 190, width: '100%' }} />
      </div>
    </div>
  )
}