/**
 * NagarMind v5 — ChatIntakePage (Full Multilingual, Upgraded)
 *
 * Improvements:
 * 1. Greeting opens with language selector first
 * 2. LocationPicker component with full drag/move pin
 * 3. Yes/No confirmation buttons in user's chosen language
 * 4. Jump-back to any prior field via preview panel edit buttons
 * 5. Photo upload step identical to SubmitComplaintPage
 * 6. Bilingual final review — edit either side, both sync
 * 7. Context-aware voice input at every stage
 * 8. Concise LLM (2-3 line max responses)
 */

import {
  useState, useRef, useEffect, useCallback, ChangeEvent
} from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Mic, MicOff, Send, Loader2, FileText, Globe,
  Eye, EyeOff, Edit3, AlignLeft, Tag, MapPin, Camera,
  CheckCircle2, X, Image as ImageIcon, Check,
  ChevronDown, ArrowRight, Languages, RotateCcw
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { AppShell } from '@/components/common/AppShell'
import { LocationPicker } from '@/components/other/LocationPicker'
import { api, uploadAPI, complaintsAPI } from '@/lib/api'
import { SUPPORTED_LANGUAGES, CATEGORY_CONFIG, type CategoryKey } from '@/types'
import toast from 'react-hot-toast'

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/citizen/dashboard', label: 'Home',     icon: <span>🏠</span> },
  { to: '/citizen/submit',    label: 'Report',   icon: <span>📝</span> },
  { to: '/citizen/complaints',label: 'My Issues',icon: <span>📋</span> },
  { to: '/citizen/digest',    label: 'Digest',   icon: <span>📊</span> },
  { to: '/citizen/profile',   label: 'Profile',  icon: <span>👤</span> },
]

// ── Multilingual UI strings ───────────────────────────────────────────────────
const UI: Record<string, Record<string, string>> = {
  selectLang: {
    en: 'Choose your language to get started', hi: 'शुरू करने के लिए अपनी भाषा चुनें',
    bn: 'শুরু করতে আপনার ভাষা বেছে নিন', ta: 'தொடங்க உங்கள் மொழியை தேர்ந்தெடுக்கவும்',
    te: 'ప్రారంభించడానికి మీ భాష ఎంచుకోండి', mr: 'सुरू करण्यासाठी आपली भाषा निवडा',
    gu: 'શરૂ કરવા માટે તમારી ભાષા પસંદ કરો', kn: 'ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ',
    ml: 'ആരംഭിക്കാൻ നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക', pa: 'ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ',
    or: 'ଆରମ୍ଭ କରିବାକୁ ଆପଣଙ୍କ ଭାଷା ବ୍ଯବହାର କରନ୍ତୁ', as: 'আৰম্ভ কৰিবলৈ আপোনাৰ ভাষা বাছক',
  },
  yes: {
    en: '✅ Yes', hi: '✅ हाँ', bn: '✅ হ্যাঁ', ta: '✅ ஆம்', te: '✅ అవును',
    mr: '✅ होय', gu: '✅ હા', kn: '✅ ಹೌದು', ml: '✅ ഉം', pa: '✅ ਹਾਂ',
    or: '✅ ହଁ', as: '✅ হয়',
  },
  no: {
    en: '❌ No', hi: '❌ नहीं', bn: '❌ না', ta: '❌ இல்லை', te: '❌ కాదు',
    mr: '❌ नाही', gu: '❌ ના', kn: '❌ ಇಲ್ಲ', ml: '❌ ഇല്ല', pa: '❌ ਨਹੀਂ',
    or: '❌ ନା', as: '❌ নহয়',
  },
  submit: {
    en: '🚀 Submit Complaint', hi: '🚀 शिकायत दर्ज करें', bn: '🚀 অভিযোগ জমা দিন',
    ta: '🚀 புகார் சமர்ப்பி', te: '🚀 ఫిర్యాదు సమర్పించు', mr: '🚀 तक्रार दाखल करा',
    gu: '🚀 ફરિયાદ સબમિટ', kn: '🚀 ದೂರು ಸಲ್ಲಿಸಿ', ml: '🚀 പരാതി സমർപ്പിക്കുക',
    pa: '🚀 ਸ਼ਿਕਾਇਤ ਦਰਜ', or: '🚀 ଅଭିଯୋଗ ଦାଖଲ', as: '🚀 অভিযোগ দাখিল',
  },
  editThis: {
    en: 'Edit', hi: 'बदलें', bn: 'সম্পাদনা', ta: 'திருத்து', te: 'సవరించు', mr: 'संपादित करा',
    gu: 'સુધારો', kn: 'ಸಂಪಾದಿಸಿ', ml: 'തിരുത്തുക', pa: 'ਬਦਲੋ', or: 'ସଂଶୋଧନ', as: 'সম্পাদনা',
  },
  skip: {
    en: 'Skip →', hi: 'छोड़ें →', bn: 'এড়িয়ে যান →', ta: 'தவிர்க்க →', te: 'దాటవేయి →',
    mr: 'वगळा →', gu: 'છોડો →', kn: 'ಬಿಟ್ಟುಬಿಡಿ →', ml: 'ഒഴിവാക്കുക →', pa: 'ਛੱਡੋ →',
    or: 'ଛାଡ଼ନ୍ତୁ →', as: 'এৰক →',
  },
  confirmLocation: {
    en: '📍 Confirm Location', hi: '📍 स्थान की पुष्टि करें', bn: '📍 অবস্থান নিশ্চিত করুন',
    ta: '📍 இடம் உறுதிப்படுத்து', te: '📍 స్థానం నిర్ధారించు', mr: '📍 ठिकाण निश्चित करा',
    gu: '📍 સ્થળ પુષ્ટિ', kn: '📍 ಸ್ಥಳ ದೃಢಪಡಿಸಿ', ml: '📍 സ്ഥലം സ്ഥിരീകരിക്കുക',
    pa: '📍 ਸਥਾਨ ਪੁਸ਼ਟੀ', or: '📍 ସ୍ଥାନ ନିଶ୍ଚିତ', as: '📍 স্থান নিশ্চিত',
  },
  addPhotos: {
    en: '📸 Add Photos & Continue', hi: '📸 फ़ोटो जोड़ें और जारी रखें',
    bn: '📸 ছবি যোগ করুন এবং চালিয়ে যান', ta: '📸 படங்கள் சேர்த்து தொடரவும்',
    te: '📸 ఫోటోలు జోడించి కొనసాగించు', mr: '📸 फोटो जोडा आणि पुढे जा',
    gu: '📸 ફોટો ઉમેરો', kn: '📸 ಫೋಟೋ ಸೇರಿಸಿ', ml: '📸 ഫോട്ടോ ചേർക്കുക',
    pa: '📸 ਫੋਟੋ ਜੋੜੋ', or: '📸 ଫଟୋ ଯୋଡ଼ନ୍ତୁ', as: '📸 ফটো যোগ কৰক',
  },
  skipPhotos: {
    en: 'Skip, no photos', hi: 'छोड़ें, फ़ोटो नहीं', bn: 'এড়িয়ে যান',
    ta: 'தவிர்க்கவும்', te: 'ఫోటోలు వద్దు', mr: 'फोटो नको',
    gu: 'ફોટો નહીં', kn: 'ಫೋಟೋ ಬೇಡ', ml: 'ഫോട്ടോ വേണ്ട',
    pa: 'ਫੋਟੋ ਨਹੀਂ', or: 'ଫଟୋ ନାହିଁ', as: 'ফটো নাই',
  },
  submittedTitle: {
    en: '✅ Complaint Submitted!', hi: '✅ शिकायत दर्ज!', bn: '✅ অভিযোগ জমা!',
    ta: '✅ புகார் சமர்ப்பிக்கப்பட்டது!', te: '✅ ఫిర్యాదు సమర్పించబడింది!',
    mr: '✅ तक्रार दाखल!', gu: '✅ ફરિયાদ સબમિટ!', kn: '✅ ದೂರು ಸಲ್ಲಿಸಲಾಯಿತು!',
    ml: '✅ പരാതി സമർപ്പിച്ചു!', pa: '✅ ਸ਼ਿਕਾਇਤ ਦਰਜ!', or: '✅ ଅଭିଯୋଗ ଦାଖଲ!', as: '✅ অভিযোগ দাখিল!',
  },
  typePlaceholder: {
    en: 'Type here or hold mic...', hi: 'यहाँ लिखें या माइक दबाएं...',
    bn: 'এখানে লিখুন বা মাইক ধরুন...', ta: 'இங்கே தட்டச்சு செய்யுங்கள்...',
    te: 'ఇక్కడ టైప్ చేయండి...', mr: 'येथे टाईप करा...', gu: 'અહીં ટાઇપ કરો...',
    kn: 'ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ...', ml: 'ഇവിടെ ടൈപ്പ് ചെയ്യുക...', pa: 'ਇੱਥੇ ਲਿਖੋ...',
    or: 'ଏଠାରେ ଟାଇପ୍ /', as: 'ইয়াত টাইপ কৰক...',
  },
  finalReview: {
    en: '📋 Final Review', hi: '📋 अंतिम समीक्षा', bn: '📋 চূড়ান্ত পর্যালোচনা',
    ta: '📋 இறுதி மதிப்பாய்வு', te: '📋 చివరి సమీక్ష', mr: '📋 अंतिम आढावा',
    gu: '📋 અંતિમ સમીક્ષા', kn: '📋 ಅಂತಿಮ ಪರಿಶೀಲನೆ', ml: '📋 അന്തിമ അവലോകനം',
    pa: '📋 ਅੰਤਿਮ ਸਮੀਖਿਆ', or: '📋 ଅଂତିମ ସମୀକ୍ଷା', as: '📋 চূড়ান্ত পৰ্যালোচনা',
  },
  livePreview: {
    en: '👀 Live Preview', hi: '👀 लाइव झलक', bn: '👀 লাইভ প্রিভিউ',
    ta: '👀 நேரடி முன்னோட்டம்', te: '👀 లైవ్ ప్రివ్యూ', mr: '👀 थेट पूर्वावलोकन',
    gu: '👀 લાઇવ પ્રિવ્યૂ', kn: '👀 ನೇರ ಪೂರ್ವವೀಕ್ಷಣೆ', ml: '👀 തത്സമയ പ്രിവ്യൂ',
    pa: '👀 ਲਾਈਵ ਪ੍ਰੀਵਿਊ', or: '👀 ଲାଇଭ ପ୍ରିଭ୍ୟୁ', as: '👀 লাইভ প্ৰিভিউ',
  },
  fieldTitle: {
    en: 'Issue Title', hi: 'समस्या का शीर्षक', bn: 'সমস্যার শিরোনাম',
    ta: 'பிரச்சினை தலைப்பு', te: 'సమస్య శీర్షిక', mr: 'समस्येचे शीर्षक',
    gu: 'સમસ્યાનું શીર્ષક', kn: 'ಸಮಸ್ಯೆಯ ಶೀರ್ಷಿಕೆ', ml: 'പ്രശ്‌നത്തിന്റെ ശീർഷകം',
    pa: 'ਸਮੱਸਿਆ ਦਾ ਸਿਰਲੇਖ', or: 'ସମସ୍ୟାର ଶିରୋନାମ', as: 'সমস্যাৰ শিৰোনাম',
  },
  fieldDescription: {
    en: 'Description', hi: 'विवरण', bn: 'বিবরণ',
    ta: 'விவரம்', te: 'వివరణ', mr: 'वर्णन',
    gu: 'વિવરણ', kn: 'ವಿವರಣೆ', ml: 'വിവരണം',
    pa: 'ਵੇਰਵਾ', or: 'ବିବରଣ', as: 'বিৱৰণ',
  },
  fieldCategory: {
    en: 'Category', hi: 'श्रेणी', bn: 'বিভাগ',
    ta: 'வகை', te: 'వర్గం', mr: 'श्रेणी',
    gu: 'શ્રેણી', kn: 'ವರ್ಗ', ml: 'വിഭാഗം',
    pa: 'ਸ਼੍ਰੇਣੀ', or: 'ବର୍ଗ', as: 'শ্ৰেণী',
  },
  fieldLocation: {
    en: 'Location', hi: 'स्थान', bn: 'অবস্থান',
    ta: 'இடம்', te: 'స్థానం', mr: 'ठिकाण',
    gu: 'સ્થળ', kn: 'ಸ್ಥಳ', ml: 'സ്ഥലം',
    pa: 'ਸਥਾਨ', or: 'ସ୍ଥାନ', as: 'স্থান',
  },
  fieldPhotos: {
    en: 'Photos', hi: 'फ़ोटो', bn: 'ছবি',
    ta: 'புகைப்படங்கள்', te: 'ఫోటోలు', mr: 'फोटो',
    gu: 'ફોટો', kn: 'ಫೋಟೋಗಳು', ml: 'ഫോട്ടോകൾ',
    pa: 'ਫੋਟੋ', or: 'ଫଟୋ', as: 'ফটো',
  },
  submitToMcd: {
    en: 'Submit to MCD', hi: 'MCD को दर्ज करें', bn: 'MCD-তে জমা দিন',
    ta: 'MCD-க்கு சமர்ப்பி', te: 'MCD కు సమర్పించు', mr: 'MCD ला सबमिट करा',
    gu: 'MCD ને સબમિટ', kn: 'MCD ಗೆ ಸಲ್ಲಿಸಿ', ml: 'MCD-ലേക്ക് സമർപ്പിക്കുക',
    pa: 'MCD ਨੂੰ ਦਰਜ', or: 'MCD କୁ ଦାଖଲ', as: 'MCD লৈ দাখিল',
  },
  submittingStatus: {
    en: 'Submitting...', hi: 'दर्ज हो रहा है...', bn: 'জমা দেওয়া হচ্ছে...',
    ta: 'சமர்ப்பிக்கப்படுகிறது...', te: 'సమర்పిస్తోంది...', mr: 'सबमिट होत आहे...',
    gu: 'સબમિટ થઈ રહ્યું...', kn: 'ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...', ml: 'സമർപ്പിക്കുന്നു...',
    pa: 'ਦਰਜ ਹੋ ਰਿਹਾ...', or: 'ଦାଖଲ ହେଉଛି...', as: 'দাখিল হৈছে...',
  },
  reask: {
    en: 'Re-ask', hi: 'फिर पूछें', bn: 'আবার জিজ্ঞাসা',
    ta: 'மீண்டும் கேளு', te: 'మళ్ళీ అడుగు', mr: 'पुन्हा विचारा',
    gu: 'ફરી પૂછો', kn: 'ಮತ್ತೆ ಕೇಳಿ', ml: 'വീണ്ടും ചോദിക്കൂ',
    pa: 'ਫਿਰ ਪੁੱਛੋ', or: 'ପୁଣି ପଚାରନ୍ତୁ', as: 'পুনৰ সোধক',
  },
  change: {
    en: 'Change', hi: 'बदलें', bn: 'পরিবর্তন',
    ta: 'மாற்று', te: 'మార్చు', mr: 'बदला',
    gu: 'બદলો', kn: 'ಬದಲಿಸಿ', ml: 'മാറ്റുക',
    pa: 'ਬਦਲੋ', or: 'ବଦଳ', as: 'সলনি কৰক',
  },
  useForm: {
    en: 'Use Form', hi: 'फ़ॉर्म भरें', bn: 'ফর্ম ব্যবহার করুন',
    ta: 'படிவம் பயன்படுத்து', te: 'ఫారమ్ వాడు', mr: 'फॉर्म वापरा',
    gu: 'ફોર્મ વાપરો', kn: 'ಫಾರ್ಮ್ ಬಳಸಿ', ml: 'ഫോം ഉപയോഗിക്കൂ',
    pa: 'ਫਾਰਮ ਵਰਤੋ', or: 'ଫର୍ମ ବ୍ୟବହାର', as: 'ফৰ্ম ব্যৱহাৰ',
  },
}

function t(key: string, lang: string): string {
  return UI[key]?.[lang] || UI[key]?.['en'] || key
}

// ── Stage definitions ─────────────────────────────────────────────────────────
type Stage =
  | 'language_select'
  | 'greeting'
  | 'asking_title'
  | 'asking_description'
  | 'asking_category'
  | 'asking_address'
  | 'asking_photos'
  | 'confirming'
  | 'submit'
  | 'submitted'

const STAGE_ORDER: Stage[] = [
  'language_select', 'greeting', 'asking_title', 'asking_description',
  'asking_category', 'asking_address', 'asking_photos', 'confirming', 'submitted',
]

// Which preview field each stage is actively filling (used inside ReviewPanel)
// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'bot' | 'system'
  text: string
  textEn?: string
  ts: Date
  widget?: 'location' | 'photos' | 'confirm_category' | 'confirm_final'
  widgetDone?: boolean
}

interface ExtractedData {
  title: string | null
  title_original: string | null
  description: string | null
  description_original: string | null
  category: string | null
  address: string | null
}

// ── Concise system prompt ─────────────────────────────────────────────────────
function buildSystemPrompt(language: string, stage: Stage, collected: Record<string, any>): string {
  const langNames: Record<string, string> = {
    en: 'English', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
    mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', as: 'Assamese', ur: 'Urdu', mai: 'Maithili', kok: 'Konkani',
    ne: 'Nepali', sd: 'Sindhi', doi: 'Dogri', sa: 'Sanskrit', mni: 'Manipuri',
    brx: 'Bodo', ks: 'Kashmiri',
  }
  const langName = langNames[language] || 'English'
  const isEn = language === 'en'

  return `You are NagarMind, a civic complaint assistant for MCD Delhi.

LANGUAGE: Respond ONLY in ${langName}. Keep replies to 1-3 short sentences MAX.
${isEn ? '' : `Also provide reply_en (English translation of your reply).`}

CURRENT STAGE: ${stage}
COLLECTED: ${JSON.stringify(collected)}

STAGE GUIDE (follow strictly, be BRIEF):
- asking_title: Ask for a short title (5-10 words) for the issue. Extract from what user said if possible.
- asking_description: Ask for more details — location, severity, how long. Extract if already given.
- asking_category: Auto-detect category, ask user to confirm. Show category name in ${langName}.
- asking_address: Tell user to pin location on map. Don't ask again if already given.
- asking_photos: Ask if they want to add photos as evidence (optional).
- confirming: Summarize all details briefly, ask for confirmation.

CATEGORIES: pothole, garbage, sewage, water_supply, streetlight, tree, stray_animals, encroachment, noise, other
URGENCY from description: critical (safety risk), high (major), medium (normal), low (minor)

IMPORTANT:
- Extract title/description from ANY message, don't wait for perfect formatting
- If user confirms category → move to address stage
- If user says YES/confirms → move to next stage  
- Keep it CONVERSATIONAL. Never repeat questions already answered.
- In confirming stage: if user says YES/submit → set confirmed: true

RESPOND AS JSON ONLY:
{
  "reply": "Your response in ${langName} (1-3 sentences MAX)",
  ${isEn ? '' : '"reply_en": "English translation",'}
  "extracted": {
    "title": "English title or null",
    "title_original": "${langName} title or null",
    "description": "English description or null",
    "description_original": "${langName} description or null",
    "category": "category_key or null",
    "address": "address text or null"
  },
  "next_stage": "same|asking_title|asking_description|asking_category|asking_address|asking_photos|confirming|submit",
  "confirmed": false
}`
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ChatIntakePage() {
  const navigate = useNavigate()

  // Core state
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [language, setLanguage] = useState('en')
  const [stage, setStage] = useState<Stage>('language_select')
  const [loading, setLoading] = useState(false)
  const [threadId] = useState(() => uuidv4())

  // Extracted data
  const [extracted, setExtracted] = useState<ExtractedData>({
    title: null, title_original: null,
    description: null, description_original: null,
    category: null, address: null,
  })

  // Location
  const [lat, setLat] = useState(28.6139)
  const [lng, setLng] = useState(77.2090)
  const [address, setAddress] = useState('')
  const [locationConfirmed, setLocationConfirmed] = useState(false)

  // Photos
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [photosConfirmed, setPhotosConfirmed] = useState(false)

  // Voice
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  // Translation
  const [translating, setTranslating] = useState(false)

  // Edit in review
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editOrigVal, setEditOrigVal] = useState('')
  const [editEnVal, setEditEnVal] = useState('')

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [complaintId, setComplaintId] = useState<string | null>(null)

  // Layout
  const [wideLayout, setWideLayout] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const hasInit = useRef(false)

  const isNonEnglish = language !== 'en'
  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === language)
  const catCfg = extracted.category
    ? CATEGORY_CONFIG[extracted.category as CategoryKey] ?? null
    : null

  // ── Layout detection ────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setWideLayout(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Add message helper ──────────────────────────────────────────────────────
  const addMsg = useCallback((
    role: Message['role'],
    text: string,
    textEn?: string,
    widget?: Message['widget'],
    widgetDone?: boolean
  ) => {
    setMessages(prev => [
      ...prev,
      { id: uuidv4(), role, text, textEn, ts: new Date(), widget, widgetDone },
    ])
  }, [])

  // ── Mark widget as done ──────────────────────────────────────────────────────
  const markWidgetDone = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, widgetDone: true } : m))
  }, [])

  // ── Call LLM agent ─────────────────────────────────────────────────────────
  const callAgent = useCallback(async (userMsg: string, isInit = false) => {
    if (loading) return

    if (!isInit && userMsg.trim()) {
      addMsg('user', userMsg)
    }
    setInputText('')
    setLoading(true)

    const collected: Record<string, any> = {}
    if (extracted.title_original || extracted.title) collected.title = extracted.title_original || extracted.title
    if (extracted.description_original || extracted.description) collected.description = extracted.description_original || extracted.description
    if (extracted.category) collected.category = extracted.category
    if (address) collected.address = address

    const sysPrompt = buildSystemPrompt(language, stage, collected)

    try {
      const history: { role: string; content: string }[] = []
      // Build history from messages (last 10 exchanges)
      const recentMsgs = messages.slice(-20)
      for (const m of recentMsgs) {
        if (m.role === 'user') history.push({ role: 'user', content: m.text })
        else if (m.role === 'bot') history.push({ role: 'assistant', content: m.textEn || m.text })
      }
      if (userMsg.trim() && !isInit) {
        history.push({ role: 'user', content: userMsg.trim() })
      }

      // Use Groq via backend chatbot endpoint
      const { data } = await api.post('/api/chatbot/message', {
        message: userMsg || '',
        thread_id: threadId,
        language,
        latitude: lat,
        longitude: lng,
      })

      const newStage = (data.stage || stage) as Stage
      setStage(newStage)

      if (data.extracted) {
        setExtracted(prev => {
          const upd = { ...prev }
          const e = data.extracted
          if (e.title) upd.title = e.title
          if (e.title_original) upd.title_original = e.title_original
          if (e.description) upd.description = e.description
          if (e.description_original) upd.description_original = e.description_original
          if (e.category) upd.category = e.category
          if (e.address) { upd.address = e.address; setAddress(e.address) }
          return upd
        })
      }

      const replyText = data.reply || ''
      const replyEn = data.reply_en || replyText

      // Determine widget based on new stage
      let widget: Message['widget'] | undefined
      if (newStage === 'asking_address') widget = 'location'
      else if (newStage === 'asking_photos') widget = 'photos'
      else if (newStage === 'asking_category' && data.extracted?.category) widget = 'confirm_category'
      else if (newStage === 'confirming') widget = 'confirm_final'

      addMsg('bot', replyText, replyEn, widget)

      // Handle submission
      if (newStage === 'submit' && data.complaint_payload) {
        await doSubmit(data.complaint_payload)
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || 'Connection issue. Try again.'
      addMsg('bot', errMsg)
    } finally {
      setLoading(false)
    }
  }, [loading, language, stage, extracted, address, lat, lng, threadId, messages, addMsg])

  // ── Submit complaint ────────────────────────────────────────────────────────
  const doSubmit = async (payload?: any) => {
    setSubmitting(true)
    try {
      const titleEn = extracted.title || extracted.title_original || payload?.title || 'Civic Issue'
      const descEn = extracted.description || extracted.description_original || payload?.description || ''

      const { data } = await complaintsAPI.submit({
        title: titleEn,
        description: descEn,
        category: extracted.category || payload?.category || 'other',
        original_language: language,
        location_address: address || extracted.address || '',
        location_lat: lat,
        location_lng: lng,
        photos,
        voice_transcript: null,
      })
      setComplaintId(data.complaint_id)
      setStage('submitted')
      addMsg('bot', t('submittedTitle', language), t('submittedTitle', 'en'))
      toast.success(t('submittedTitle', language))
      setTimeout(() => navigate(`/citizen/track/${data.complaint_id}`), 2500)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Language selected → init chat ───────────────────────────────────────────
  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang)
    setStage('greeting')
    hasInit.current = true
    // Add welcome message
    const langNames: Record<string, string> = {
      en: 'English', hi: 'हिंदी', bn: 'বাংলা', ta: 'தமிழ்', te: 'తెలుగు',
      mr: 'मराठी', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ',
      or: 'ଓଡ଼ିଆ', as: 'অসমীয়া',
    }
    const greetings: Record<string, string> = {
      en: "Hello! I'm NagarMind 🏙️ I'll help you report a civic issue. What's the problem you want to report?",
      hi: "नमस्ते! मैं NagarMind हूँ 🏙️ आपकी नागरिक समस्या दर्ज करने में मदद करूँगा। आप कौन सी समस्या रिपोर्ट करना चाहते हैं?",
      bn: "নমস্কার! আমি NagarMind 🏙️ আপনার নাগরিক সমস্যা নথিভুক্ত করতে সাহায্য করব। কী সমস্যা জানাতে চান?",
      ta: "வணக்கம்! நான் NagarMind 🏙️ உங்கள் குடிமை பிரச்சினையை பதிவு செய்ய உதவுகிறேன். என்ன சிக்கல்?",
      te: "నమస్కారం! నేను NagarMind 🏙️ మీ పౌర సమస్యను నమోదు చేయడంలో సహాయం చేస్తాను. ఏ సమస్య చెప్పాలనుకుంటున్నారు?",
      mr: "नमस्कार! मी NagarMind आहे 🏙️ तुमची नागरी तक्रार नोंदवण्यास मदत करेन. कोणती समस्या सांगायची आहे?",
      gu: "નમસ્તે! હું NagarMind છું 🏙️ તમારી નાગરિક સમસ્યા નોંધવામાં મદદ કરીશ. શું સમસ્યા છે?",
      kn: "ನಮಸ್ಕಾರ! ನಾನು NagarMind 🏙️ ನಿಮ್ಮ ನಾಗರಿಕ ಸಮಸ್ಯೆ ದಾಖಲಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ಯಾವ ಸಮಸ್ಯೆ?",
      ml: "നമസ്കാരം! ഞാൻ NagarMind 🏙️ നിങ്ങളുടെ നഗര പ്രശ്നം രേഖപ്പെടുത്താൻ സഹായിക്കും. എന്ത് പ്രശ്നം?",
      pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ NagarMind ਹਾਂ 🏙️ ਤੁਹਾਡੀ ਨਾਗਰਿਕ ਸਮੱਸਿਆ ਦਰਜ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗਾ।",
      or: "ନମସ୍କାର! ମୁଁ NagarMind 🏙️ ଆପଣଙ୍କ ନାଗରିକ ସମସ୍ୟା ଦାଖଲ କରିବାରେ ସାହାଯ୍ୟ କରିବି।",
      as: "নমস্কাৰ! মই NagarMind 🏙️ আপোনাৰ নাগৰিক সমস্যা দাখিল কৰিবলৈ সহায় কৰিম।",
    }
    const greeting = greetings[lang] || greetings['en']
    const greetingEn = greetings['en']
    setTimeout(() => {
      addMsg('bot', greeting, greetingEn)
      setStage('asking_title')
    }, 300)
  }

  // ── Location confirmation ────────────────────────────────────────────────────
  const confirmLocation = useCallback((msgId: string) => {
    if (!address.trim()) {
      toast.error('Please select a location first')
      return
    }
    setLocationConfirmed(true)
    markWidgetDone(msgId)
    addMsg('user', `📍 ${address.slice(0, 80)}${address.length > 80 ? '...' : ''}`)
    setExtracted(prev => ({ ...prev, address }))
    callAgent(address)
  }, [address, addMsg, callAgent, markWidgetDone])

  // ── Photo handling ────────────────────────────────────────────────────────────
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} too large (max 5MB)`); continue }
      try {
        const { data } = await uploadAPI.uploadPhoto(file)
        if (data.public_url) {
          setPhotos(p => [...p, data.public_url])
        } else {
          throw new Error('No public_url')
        }
      } catch {
        // Fallback: convert to base64 data URI so it persists through submission
        try {
          const base64 = await new Promise<string>((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result as string)
            reader.onerror = rej
            reader.readAsDataURL(file)
          })
          setPhotos(p => [...p, base64])
        } catch {
          toast.error(`Failed to process ${file.name}`)
        }
      }
    }
    setUploading(false)
    if (e.target) e.target.value = ''
  }

  const confirmPhotos = useCallback((msgId: string, skip = false) => {
    setPhotosConfirmed(true)
    markWidgetDone(msgId)
    if (!skip && photos.length > 0) {
      addMsg('user', `📸 ${photos.length} photo${photos.length > 1 ? 's' : ''} added`)
      callAgent(`I have added ${photos.length} photo(s) as evidence`)
    } else {
      addMsg('user', t('skipPhotos', language))
      callAgent('No photos, please continue')
    }
  }, [photos, language, addMsg, callAgent, markWidgetDone])

  // ── Voice recording ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 300) { toast.error('Too short — speak clearly'); return }
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
            toast.error('Could not understand. Please try again or type.')
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

  // ── Translate helper ─────────────────────────────────────────────────────────
  const translateToEn = async (text: string): Promise<string> => {
    if (!text.trim() || language === 'en') return text
    try {
      const { data } = await api.post('/api/translate/single', {
        text, target_language: 'en-IN',
        source_language: langMeta?.sarvam || 'hi-IN',
      })
      return data.translated || text
    } catch { return text }
  }

  // ── Edit field handlers ──────────────────────────────────────────────────────
  const startEdit = (field: string) => {
    const origVal =
      field === 'title' ? (extracted.title_original || extracted.title || '') :
      field === 'description' ? (extracted.description_original || extracted.description || '') :
      field === 'category' ? (extracted.category || '') :
      field === 'address' ? (address || '') : ''
    const enVal =
      field === 'title' ? (extracted.title || '') :
      field === 'description' ? (extracted.description || '') :
      field === 'category' ? (extracted.category || '') : (address || '')
    setEditingField(field)
    setEditOrigVal(origVal)
    setEditEnVal(enVal)
  }

  const saveEdit = async () => {
    if (!editingField) return
    const f = editingField
    let enVal = editEnVal
    // Auto-translate if only original edited
    if (isNonEnglish && editOrigVal && !editEnVal) {
      setTranslating(true)
      enVal = await translateToEn(editOrigVal)
      setTranslating(false)
    }
    setExtracted(prev => {
      const n = { ...prev }
      if (f === 'title') { n.title = enVal || editOrigVal; n.title_original = editOrigVal }
      if (f === 'description') { n.description = enVal || editOrigVal; n.description_original = editOrigVal }
      if (f === 'category') n.category = editEnVal
      if (f === 'address') { n.address = editOrigVal; setAddress(editOrigVal) }
      return n
    })
    // Tell chatbot about the change
    if (editOrigVal.trim()) {
      callAgent(`I want to change the ${f} to: ${editOrigVal}`)
    }
    setEditingField(null)
  }

  // ── Jump back to re-answer a field ──────────────────────────────────────────
  const jumpBack = (field: string) => {
    const stageMap: Record<string, Stage> = {
      title: 'asking_title',
      description: 'asking_description',
      category: 'asking_category',
      address: 'asking_address',
      photos: 'asking_photos',
    }
    const targetStage = stageMap[field]
    if (!targetStage) return
    setStage(targetStage)
    const jumpMsgs: Record<string, string> = {
      en: `I want to change my ${field}`,
      hi: `मैं अपना ${field} बदलना चाहता हूँ`,
      bn: `আমি আমার ${field} পরিবর্তন করতে চাই`,
    }
    callAgent(jumpMsgs[language] || jumpMsgs['en'])
  }

  // ── Progress for preview ─────────────────────────────────────────────────────
  const filledCount = [extracted.title, extracted.description, extracted.category, address]
    .filter(Boolean).length

  // ── Language select screen ───────────────────────────────────────────────────
  if (stage === 'language_select') {
    return (
      <AppShell navItems={NAV_ITEMS} role="citizen">
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-8 space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3"
          >
            <div className="w-16 h-16 rounded-3xl bg-primary-600/20 border border-primary-500/40 flex items-center justify-center mx-auto text-3xl">
              🏙️
            </div>
            <h1 className="font-display font-bold text-2xl text-white">NagarMind</h1>
            <p className="text-slate-400 text-sm font-body max-w-xs text-center">
              Report civic issues in your language — AI will guide you step by step
            </p>
          </motion.div>

          {/* Language grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="w-full max-w-lg"
          >
            {/* Row: label + Use Form button */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-body text-slate-500 uppercase tracking-wider">
                Select your language / अपनी भाषा चुनें
              </p>
              <button
                onClick={() => navigate('/citizen/submit-form')}
                title="Use step-by-step form instead"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700
                  rounded-xl text-slate-400 text-xs font-body hover:bg-slate-700 hover:text-slate-200
                  transition-colors shrink-0 ml-3"
              >
                <FileText size={12} />
                <span>Use Form</span>
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {SUPPORTED_LANGUAGES.map((lang, i) => (
                <motion.button
                  key={lang.code}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className="relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl
                    bg-slate-900 border-2 border-slate-800 text-center
                    hover:border-primary-500/60 hover:bg-primary-600/10
                    transition-all group"
                >
                  <span className="font-semibold text-white text-sm font-body">{lang.nativeName}</span>
                  <span className="text-slate-500 text-[10px] font-body">{lang.name}</span>
                  {lang.sttSupported && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full"
                      title="Voice supported" />
                  )}
                </motion.button>
              ))}
            </div>
            <p className="text-center text-[10px] text-slate-600 mt-3 font-body flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
              Green dot = voice input supported
            </p>
          </motion.div>
        </div>
      </AppShell>
    )
  }

  // ── Chat view ────────────────────────────────────────────────────────────────
  // At this point stage is never 'language_select' (early return above handles it)
  const chatStage = stage as Exclude<Stage, 'language_select'>
  const isSubmitted = chatStage === 'submitted'
  const canSendText = !loading && !transcribing && !isSubmitted &&
    chatStage !== 'asking_address' && chatStage !== 'asking_photos'

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className={`-mx-4 md:-mx-8 flex ${wideLayout ? 'h-[calc(100dvh-64px)]' : 'flex-col min-h-[calc(100dvh-64px)]'}`}>

        {/* ══════════ CHAT PANEL ══════════ */}
        <div className={`flex flex-col bg-slate-950 ${wideLayout ? 'w-[56%] border-r border-slate-800' : 'flex-1'}`}>

          {/* Chat header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
            <button
              onClick={() => navigate('/citizen/dashboard')}
              className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 shrink-0"
            >
              <ArrowLeft size={15} className="text-slate-300" />
            </button>

            {/* Language badge + change option */}
            <button
              onClick={() => setStage('language_select')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700
                rounded-xl text-slate-300 text-xs font-body hover:bg-slate-700 transition-colors"
            >
              <Globe size={12} />
              <span>{langMeta?.nativeName || 'EN'}</span>
              <span className="text-slate-500 text-[10px]">▼</span>
            </button>

            <div className="flex-1" />

            {/* Switch to form */}
            <button
              onClick={() => navigate('/citizen/submit-form')}
              title="Use step-by-step form"
              className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400"
            >
              <FileText size={14} />
            </button>

            {/* Mobile preview toggle */}
            {!wideLayout && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400"
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>

          {/* Mobile preview strip */}
          {!wideLayout && (
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="shrink-0 overflow-hidden border-b border-slate-800"
                >
                  <MiniPreview
                    extracted={extracted} address={address} photos={photos}
                    catCfg={catCfg} stage={chatStage} language={language}
                    isNonEnglish={isNonEnglish} filledCount={filledCount}
                    onJumpBack={jumpBack}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                language={language}
                isNonEnglish={isNonEnglish}
                // Location widget
                lat={lat} lng={lng} address={address}
                locationConfirmed={locationConfirmed}
                onLocationSelect={(la, lo, addr) => { setLat(la); setLng(lo); setAddress(addr) }}
                onConfirmLocation={() => confirmLocation(msg.id)}
                // Photos widget
                photos={photos} uploading={uploading} photosConfirmed={photosConfirmed}
                fileRef={fileRef}
                onConfirmPhotos={(skip) => confirmPhotos(msg.id, skip)}
                // Category confirm
                extracted={extracted} catCfg={catCfg}
                onQuickReply={(text) => callAgent(text)}
                onDirectSubmit={() => doSubmit()}
                // General
                loading={loading}
              />
            ))}

            {/* Typing indicator */}
            {(loading || transcribing || submitting) && (
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center shrink-0 text-sm">
                  🏙️
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  {submitting ? (
                    <p className="text-xs text-slate-400 font-body flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" /> Submitting to MCD...
                    </p>
                  ) : transcribing ? (
                    <p className="text-xs text-slate-400 font-body flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" /> Transcribing...
                    </p>
                  ) : (
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                          className="w-2 h-2 bg-slate-400 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success */}
            {isSubmitted && !submitting && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center"
              >
                <div className="bg-green-900/30 border border-green-700/40 rounded-2xl px-6 py-5 text-center max-w-xs">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-green-300 font-semibold font-body text-sm">
                    {t('submittedTitle', language)}
                  </p>
                  <p className="text-green-500/70 text-xs font-body mt-1">
                    Redirecting to tracking...
                  </p>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <AnimatePresence>
            {!isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="shrink-0 px-4 py-3 bg-slate-900 border-t border-slate-800"
              >
                <div className="flex gap-2 items-end">
                  <textarea
                    value={inputText}
                    onChange={e => {
                      setInputText(e.target.value)
                      // Auto-resize
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (inputText.trim()) callAgent(inputText)
                      }
                    }}
                    placeholder={t('typePlaceholder', language)}
                    rows={1}
                    disabled={!canSendText}
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-2xl
                      px-4 py-2.5 text-sm font-body resize-none outline-none
                      focus:border-primary-500 placeholder:text-slate-500 disabled:opacity-50
                      transition-colors leading-normal"
                    style={{ maxHeight: 120, overflowY: 'auto' }}
                  />

                  {/* Voice button */}
                  <motion.button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={e => { e.preventDefault(); startRecording() }}
                    onTouchEnd={e => { e.preventDefault(); stopRecording() }}
                    disabled={loading || transcribing || isSubmitted}
                    whileTap={{ scale: 0.92 }}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
                      select-none touch-none transition-all disabled:opacity-40
                      ${isRecording
                        ? 'bg-red-600 border-2 border-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                        : 'bg-slate-800 border border-slate-700 hover:border-slate-500'}`}
                  >
                    {transcribing
                      ? <Loader2 size={15} className="animate-spin text-primary-400" />
                      : isRecording
                        ? <MicOff size={15} className="text-white" />
                        : <Mic size={15} className="text-slate-400" />}
                  </motion.button>

                  {/* Send button */}
                  <button
                    onClick={() => inputText.trim() && callAgent(inputText)}
                    disabled={!inputText.trim() || loading || isSubmitted}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
                      bg-primary-600 hover:bg-primary-500 text-white
                      disabled:opacity-40 disabled:cursor-default
                      shadow-glow-blue disabled:shadow-none transition-all"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>

                <p className="text-center text-slate-600 text-[10px] font-body mt-1.5">
                  {langMeta?.nativeName} • Hold mic to speak • Enter to send
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══════════ REVIEW/PREVIEW PANEL (Desktop) ══════════ */}
        {wideLayout && (
          <div className="w-[44%] flex flex-col overflow-hidden bg-slate-900">
            <ReviewPanel
              extracted={extracted}
              address={address}
              photos={photos}
              catCfg={catCfg}
              language={language}
              isNonEnglish={isNonEnglish}
              stage={chatStage}
              filledCount={filledCount}
              isSubmitted={isSubmitted}
              submitting={submitting}
              translating={translating}
              editingField={editingField}
              editOrigVal={editOrigVal}
              editEnVal={editEnVal}
              onStartEdit={startEdit}
              onEditOrigChange={(v) => setEditOrigVal(v)}
              onEditEnChange={(v) => setEditEnVal(v)}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingField(null)}
              onJumpBack={jumpBack}
              onSubmit={() => doSubmit()}
              onTranslateOrig={async () => {
                setTranslating(true)
                const en = await translateToEn(editOrigVal)
                setEditEnVal(en)
                setTranslating(false)
              }}
              onTranslateEn={async () => {
                // translate English back to native (via single endpoint)
                if (!editEnVal.trim()) return
                setTranslating(true)
                try {
                  const { data } = await api.post('/api/translate/single', {
                    text: editEnVal,
                    target_language: langMeta?.sarvam || 'hi-IN',
                    source_language: 'en-IN',
                  })
                  setEditOrigVal(data.translated || editEnVal)
                } catch { /* ignore */ }
                setTranslating(false)
              }}
            />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoSelect}
      />
    </AppShell>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ══════════════════════════════════════════════════════════════════════════════
interface MsgBubbleProps {
  msg: Message; language: string; isNonEnglish: boolean
  lat: number; lng: number; address: string
  locationConfirmed: boolean
  onLocationSelect: (la: number, lo: number, addr: string) => void
  onConfirmLocation: () => void
  photos: string[]; uploading: boolean; photosConfirmed: boolean
  fileRef: React.RefObject<HTMLInputElement>
  onConfirmPhotos: (skip: boolean) => void
  extracted: ExtractedData; catCfg: any
  onQuickReply: (text: string) => void
  onDirectSubmit: () => void
  loading: boolean
}

function MessageBubble({
  msg, language, isNonEnglish,
  lat, lng, address, locationConfirmed,
  onLocationSelect, onConfirmLocation,
  photos, uploading, photosConfirmed, fileRef,
  onConfirmPhotos, extracted, catCfg, onQuickReply, onDirectSubmit, loading,
}: MsgBubbleProps) {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
      >
        {msg.role === 'bot' && (
          <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center shrink-0 mb-0.5 text-sm">
            🏙️
          </div>
        )}
        <div className="max-w-[82%] space-y-1">
          <div className={`px-4 py-2.5 text-sm font-body leading-relaxed rounded-2xl
            ${msg.role === 'user'
              ? 'bg-primary-600 text-white rounded-br-sm'
              : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'}`}>
            {msg.text}
          </div>
          {/* English translation for bot messages */}
          {msg.role === 'bot' && isNonEnglish && msg.textEn && msg.textEn !== msg.text && (
            <div className="px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-xl text-[11px] text-slate-500 font-body italic">
              {msg.textEn}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Location widget ── */}
      {msg.widget === 'location' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="ml-10 mt-3"
        >
          {!msg.widgetDone ? (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-4 pt-3 pb-2">
                <p className="text-xs font-semibold text-primary-400 font-body flex items-center gap-1.5">
                  <MapPin size={12} /> Pin the exact location
                </p>
              </div>
              <div className="px-3 pb-1">
                <LocationPicker
                  initialLat={lat}
                  initialLng={lng}
                  initialAddress={address}
                  onLocationSelect={onLocationSelect}
                />
              </div>
              <div className="px-3 pb-3 pt-1">
                <button
                  onClick={onConfirmLocation}
                  disabled={!address.trim()}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50
                    text-white text-sm font-semibold rounded-xl font-body transition-colors
                    flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={15} />
                  {t('confirmLocation', language)}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-green-400 font-body ml-1">
              <CheckCircle2 size={12} />
              <span className="truncate max-w-[250px]">{address}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Photos widget ── */}
      {msg.widget === 'photos' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="ml-10 mt-3"
        >
          {!msg.widgetDone ? (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary-400 font-body flex items-center gap-1.5">
                  <Camera size={12} /> Evidence Photos ({photos.length}/5)
                </p>
              </div>
              {/* Upload button */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={photos.length >= 5 || uploading}
                className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl
                  flex items-center justify-center gap-2 text-slate-400
                  hover:border-primary-500 hover:text-primary-400 transition-colors text-sm font-body
                  disabled:opacity-50"
              >
                {uploading
                  ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                  : <><ImageIcon size={14} /> Tap to add photos (optional)</>}
              </button>
              {/* Photo grid */}
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onConfirmPhotos(false)}
                  className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm
                    font-semibold rounded-xl font-body transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={14} />
                  {photos.length > 0 ? t('addPhotos', language) : t('skipPhotos', language)}
                </button>
                {photos.length > 0 && (
                  <button
                    onClick={() => onConfirmPhotos(true)}
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-400
                      text-sm rounded-xl font-body hover:border-slate-600 transition-colors"
                  >
                    {t('skip', language)}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-green-400 font-body ml-1">
              <CheckCircle2 size={12} />
              <span>{photos.length > 0 ? `${photos.length} photo(s) added` : 'No photos'}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Category confirm widget ── */}
      {msg.widget === 'confirm_category' && extracted.category && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="ml-10 mt-2 flex gap-2"
        >
          {!msg.widgetDone ? (
            <>
              <button
                onClick={() => onQuickReply(t('yes', language))}
                disabled={loading}
                className="px-5 py-2 bg-green-600/20 border border-green-500/40 text-green-400 text-sm
                  rounded-xl font-body hover:bg-green-600/30 transition-all font-semibold"
              >
                {t('yes', language)}
              </button>
              <button
                onClick={() => onQuickReply(t('no', language))}
                disabled={loading}
                className="px-5 py-2 bg-red-600/20 border border-red-500/40 text-red-400 text-sm
                  rounded-xl font-body hover:bg-red-600/30 transition-all font-semibold"
              >
                {t('no', language)}
              </button>
            </>
          ) : null}
        </motion.div>
      )}

      {/* ── Final confirmation widget ── */}
      {msg.widget === 'confirm_final' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="ml-10 mt-2 flex gap-2"
        >
          {!msg.widgetDone ? (
            <>
              <button
                onClick={onDirectSubmit}
                disabled={loading}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm
                  rounded-xl font-body font-semibold transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} />
                {t('submit', language)}
              </button>
              <button
                onClick={() => onQuickReply('I want to change something')}
                disabled={loading}
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 text-sm
                  rounded-xl font-body hover:border-slate-600 transition-all flex items-center gap-1.5"
              >
                <Edit3 size={13} /> {t('editThis', language)}
              </button>
            </>
          ) : null}
        </motion.div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MINI PREVIEW (mobile top strip)
// ══════════════════════════════════════════════════════════════════════════════
interface MiniPreviewProps {
  extracted: ExtractedData; address: string; photos: string[]
  catCfg: any; stage: Exclude<Stage, 'language_select'>; language: string; isNonEnglish: boolean
  filledCount: number; onJumpBack: (field: string) => void
}

function MiniPreview({ extracted, address, photos, catCfg, stage, language, isNonEnglish, filledCount, onJumpBack }: MiniPreviewProps) {
  return (
    <div className="bg-slate-900/80 px-4 py-3 overflow-x-auto">
      <div className="flex gap-2 items-center min-w-max">
        {/* Progress */}
        <div className="flex gap-1 mr-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-6 h-1.5 rounded-full ${i < filledCount ? 'bg-primary-500' : 'bg-slate-700'}`} />
          ))}
        </div>

        {[
          { key: 'title', icon: '✏️', label: extracted.title_original || extracted.title, stage: 'asking_title' },
          { key: 'category', icon: '🏷️', label: catCfg?.label, stage: 'asking_category' },
          { key: 'address', icon: '📍', label: address, stage: 'asking_address' },
          { key: 'photos', icon: '📸', label: photos.length > 0 ? `${photos.length} photos` : null, stage: 'asking_photos' },
        ].map(({ key, icon, label, stage: s }) => (
          <button
            key={key}
            onClick={() => label && onJumpBack(key)}
            disabled={!label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-body whitespace-nowrap
              border transition-all shrink-0
              ${label
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-primary-500/50 cursor-pointer'
                : 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-default'}`}
          >
            <span>{icon}</span>
            {label ? (
              <span className="max-w-[80px] truncate">{label}</span>
            ) : (
              <span className="italic">...</span>
            )}
            {label && <Edit3 size={9} className="text-slate-500" />}
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FULL REVIEW PANEL (desktop right side)
// ══════════════════════════════════════════════════════════════════════════════
interface ReviewPanelProps {
  extracted: ExtractedData; address: string; photos: string[]
  catCfg: any; language: string; isNonEnglish: boolean; stage: Exclude<Stage, 'language_select'>
  filledCount: number; isSubmitted: boolean; submitting: boolean; translating: boolean
  editingField: string | null; editOrigVal: string; editEnVal: string
  onStartEdit: (field: string) => void
  onEditOrigChange: (v: string) => void
  onEditEnChange: (v: string) => void
  onSaveEdit: () => void; onCancelEdit: () => void
  onJumpBack: (field: string) => void
  onSubmit: () => void
  onTranslateOrig: () => void; onTranslateEn: () => void
}

function ReviewPanel({
  extracted, address, photos, catCfg, language, isNonEnglish, stage,
  filledCount, isSubmitted, submitting, translating,
  editingField, editOrigVal, editEnVal,
  onStartEdit, onEditOrigChange, onEditEnChange, onSaveEdit, onCancelEdit,
  onJumpBack, onSubmit, onTranslateOrig, onTranslateEn,
}: ReviewPanelProps) {
  const STAGE_ACTIVE_FIELD_MAP: Partial<Record<Exclude<Stage, 'language_select'>, string>> = {
    asking_title: 'title',
    asking_description: 'description',
    asking_category: 'category',
    asking_address: 'address',
    asking_photos: 'photos',
  }
  const activeField = STAGE_ACTIVE_FIELD_MAP[stage]
  const isConfirming = stage === 'confirming' || stage === 'submit' || isSubmitted

  const langName = SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName || 'English'

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="shrink-0 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <p className="font-display font-bold text-white text-sm">
            {isConfirming ? t('finalReview', language) : t('livePreview', language)}
          </p>
          {isNonEnglish && (
            <p className="text-[10px] text-slate-500 font-body mt-0.5">
              {langName} + English
            </p>
          )}
        </div>
        {/* Progress dots */}
        <div className="flex gap-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i}
              className={`w-2 h-2 rounded-full transition-all ${i < filledCount ? 'bg-primary-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Title */}
        <ReviewField
          fieldKey="title"
          icon={<Edit3 size={12} />}
          label={t('fieldTitle', language)}
          origValue={extracted.title_original || extracted.title}
          enValue={extracted.title}
          isActive={activeField === 'title'}
          isEditing={editingField === 'title'}
          editOrigVal={editOrigVal}
          editEnVal={editEnVal}
          language={language} isNonEnglish={isNonEnglish}
          translating={translating}
          onStartEdit={onStartEdit}
          onEditOrigChange={onEditOrigChange}
          onEditEnChange={onEditEnChange}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onJumpBack={onJumpBack}
          onTranslateOrig={onTranslateOrig}
          onTranslateEn={onTranslateEn}
          isConfirming={isConfirming}
        />

        {/* Description */}
        <ReviewField
          fieldKey="description"
          icon={<AlignLeft size={12} />}
          label={t('fieldDescription', language)}
          origValue={extracted.description_original || extracted.description}
          enValue={extracted.description}
          isActive={activeField === 'description'}
          isEditing={editingField === 'description'}
          editOrigVal={editOrigVal}
          editEnVal={editEnVal}
          language={language} isNonEnglish={isNonEnglish}
          translating={translating}
          onStartEdit={onStartEdit}
          onEditOrigChange={onEditOrigChange}
          onEditEnChange={onEditEnChange}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onJumpBack={onJumpBack}
          onTranslateOrig={onTranslateOrig}
          onTranslateEn={onTranslateEn}
          isConfirming={isConfirming}
          multiline
        />

        {/* Category */}
        <div className={`rounded-xl border p-3 transition-all ${activeField === 'category' ? 'border-primary-500/60 bg-primary-600/5' : 'border-slate-700 bg-slate-800/40'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Tag size={12} className={activeField === 'category' ? 'text-primary-400' : 'text-slate-500'} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('fieldCategory', language)}</span>
              {activeField === 'category' && <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />}
            </div>
            {extracted.category && isConfirming && (
              <button onClick={() => onJumpBack('category')}
                className="text-[10px] text-slate-500 hover:text-primary-400 font-body flex items-center gap-0.5">
                <RotateCcw size={9} /> {t('change', language)}
              </button>
            )}
          </div>
          {extracted.category ? (
            <div className="flex items-center gap-2">
              <span className="text-xl">{catCfg?.icon || '📋'}</span>
              <span className="text-sm font-semibold text-slate-200 font-body">{catCfg?.label || extracted.category}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic font-body">
              {activeField === 'category' ? t('autoDetecting', language) : `${t('fieldCategory', language)}...`}
            </p>
          )}
        </div>

        {/* Location */}
        <div className={`rounded-xl border p-3 transition-all ${activeField === 'address' ? 'border-primary-500/60 bg-primary-600/5' : 'border-slate-700 bg-slate-800/40'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <MapPin size={12} className={activeField === 'address' ? 'text-primary-400' : 'text-slate-500'} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('fieldLocation', language)}</span>
            </div>
            {address && isConfirming && (
              <button onClick={() => onJumpBack('address')}
                className="text-[10px] text-slate-500 hover:text-primary-400 font-body flex items-center gap-0.5">
                <RotateCcw size={9} /> {t('change', language)}
              </button>
            )}
          </div>
          {address ? (
            <p className="text-xs text-slate-200 font-body leading-snug">{address}</p>
          ) : (
            <p className="text-xs text-slate-600 italic font-body">{t('fieldLocation', language)}...</p>
          )}
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Camera size={12} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {t('fieldPhotos', language)} ({photos.length})
              </span>
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

        {/* Bilingual note */}
        {isNonEnglish && isConfirming && (
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3">
            <p className="text-xs text-blue-300 font-body">
              📘 Both {SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName} and English versions will be saved. Officers see the English version.
            </p>
          </div>
        )}

        {/* Submit button in review panel */}
        {isConfirming && !isSubmitted && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold
              rounded-2xl font-body flex items-center justify-center gap-2 transition-all
              shadow-glow-blue disabled:opacity-50 disabled:shadow-none text-sm"
          >
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> {t('submittingStatus', language)}</>
              : <><CheckCircle2 size={16} /> {t('submitToMcd', language)}</>}
          </motion.button>
        )}

        {isSubmitted && (
          <div className="bg-green-900/30 border border-green-700/40 rounded-2xl p-4 text-center">
            <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-green-300 font-semibold text-sm font-body">{t('submittedTitle', language)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// REVIEW FIELD — shared editable field component
// ══════════════════════════════════════════════════════════════════════════════
interface ReviewFieldProps {
  fieldKey: string; icon: React.ReactNode; label: string
  origValue: string | null; enValue: string | null
  isActive: boolean; isEditing: boolean
  editOrigVal: string; editEnVal: string
  language: string; isNonEnglish: boolean; translating: boolean
  onStartEdit: (f: string) => void
  onEditOrigChange: (v: string) => void
  onEditEnChange: (v: string) => void
  onSaveEdit: () => void; onCancelEdit: () => void
  onJumpBack: (f: string) => void
  onTranslateOrig: () => void; onTranslateEn: () => void
  isConfirming: boolean; multiline?: boolean
}

function ReviewField({
  fieldKey, icon, label, origValue, enValue,
  isActive, isEditing, editOrigVal, editEnVal,
  language, isNonEnglish, translating,
  onStartEdit, onEditOrigChange, onEditEnChange, onSaveEdit, onCancelEdit,
  onJumpBack, onTranslateOrig, onTranslateEn,
  isConfirming, multiline,
}: ReviewFieldProps) {
  const langName = SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName || 'English'

  return (
    <div className={`rounded-xl border p-3 transition-all ${isActive ? 'border-primary-500/60 bg-primary-600/5 shadow-[0_0_10px_rgba(37,99,235,0.15)]' : 'border-slate-700 bg-slate-800/40'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={isActive ? 'text-primary-400' : 'text-slate-500'}>{icon}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          {isActive && <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />}
        </div>
        {origValue && !isEditing && (
          <div className="flex gap-2">
            {isConfirming && (
              <button onClick={() => onJumpBack(fieldKey)}
                className="text-[10px] text-slate-500 hover:text-amber-400 font-body flex items-center gap-0.5">
                <RotateCcw size={9} /> {t('reask', language)}
              </button>
            )}
            <button onClick={() => onStartEdit(fieldKey)}
              className="text-[10px] text-slate-500 hover:text-primary-400 font-body flex items-center gap-0.5">
              <Edit3 size={9} /> {t('editThis', language)}
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {/* Original language field */}
          {isNonEnglish && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] text-primary-400 font-body uppercase tracking-wider">{langName}</p>
                <button onClick={onTranslateEn} disabled={translating}
                  className="text-[9px] text-slate-500 hover:text-green-400 font-body flex items-center gap-0.5">
                  {translating ? <Loader2 size={8} className="animate-spin" /> : <Languages size={8} />}
                  ← from English
                </button>
              </div>
              {multiline ? (
                <textarea value={editOrigVal} onChange={e => onEditOrigChange(e.target.value)} rows={3} autoFocus
                  className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg px-2.5 py-2 text-xs font-body resize-none outline-none" />
              ) : (
                <input type="text" value={editOrigVal} onChange={e => onEditOrigChange(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }}
                  className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg px-2.5 py-2 text-xs font-body outline-none" />
              )}
            </div>
          )}
          {/* English field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] text-green-400 font-body uppercase tracking-wider">English</p>
              {isNonEnglish && (
                <button onClick={onTranslateOrig} disabled={translating}
                  className="text-[9px] text-slate-500 hover:text-green-400 font-body flex items-center gap-0.5">
                  {translating ? <Loader2 size={8} className="animate-spin" /> : <Languages size={8} />}
                  Translate →
                </button>
              )}
            </div>
            {multiline ? (
              <textarea
                value={isNonEnglish ? editEnVal : editOrigVal}
                onChange={e => isNonEnglish ? onEditEnChange(e.target.value) : onEditOrigChange(e.target.value)}
                rows={3}
                autoFocus={!isNonEnglish}
                className="w-full bg-slate-700/60 border border-green-600/40 text-green-200 rounded-lg px-2.5 py-2 text-xs font-body resize-none outline-none"
              />
            ) : (
              <input
                type="text"
                value={isNonEnglish ? editEnVal : editOrigVal}
                onChange={e => isNonEnglish ? onEditEnChange(e.target.value) : onEditOrigChange(e.target.value)}
                autoFocus={!isNonEnglish}
                onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }}
                className="w-full bg-slate-700/60 border border-green-600/40 text-green-200 rounded-lg px-2.5 py-2 text-xs font-body outline-none"
              />
            )}
          </div>
          <div className="flex gap-1.5">
            <button onClick={onSaveEdit}
              className="flex-1 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-body text-xs font-semibold transition-colors flex items-center justify-center gap-1">
              <Check size={11} /> Save
            </button>
            <button onClick={onCancelEdit}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-body text-xs transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : origValue ? (
        <div className="space-y-1.5">
          {isNonEnglish && (
            <p className="text-xs text-slate-200 font-body leading-snug">
              {(origValue || '').slice(0, 120)}{(origValue || '').length > 120 ? '…' : ''}
            </p>
          )}
          {isNonEnglish && enValue && enValue !== origValue && (
            <p className="text-[10px] text-slate-500 font-body italic">
              {(enValue || '').slice(0, 80)}{(enValue || '').length > 80 ? '…' : ''}
            </p>
          )}
          {!isNonEnglish && (
            <p className="text-xs text-slate-200 font-body leading-snug">
              {(origValue || '').slice(0, 120)}{(origValue || '').length > 120 ? '…' : ''}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic font-body">
          {isActive ? '⌨️ ...' : `${label}...`}
        </p>
      )}
    </div>
  )
}