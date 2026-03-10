import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Mic, MicOff, Camera, MapPin,
  CheckCircle, Loader2, Globe, Volume2, X, Image, Languages,
  RefreshCw, Pencil
} from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { complaintsAPI, uploadAPI, translateAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { CATEGORY_CONFIG, SUPPORTED_LANGUAGES } from '@/types'
import { LocationPicker } from '@/components/other/LocationPicker'
import toast from 'react-hot-toast'

type Step = 1 | 2 | 3 | 4
const STEPS = ['Category', 'Details', 'Location & Media', 'Review']

const NAV_ITEMS = [
  { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
]

const LANG_PLACEHOLDERS: Record<string, string> = {
  hi: 'यहाँ समस्या का विवरण लिखें या बोलकर दर्ज करें...',
  bn: 'এখানে সমস্যার বিবরণ লিখুন বা বলুন...',
  ta: 'பிரச்சனையை இங்கே விவரிக்கவும்...',
  te: 'సమస్యను ఇక్కడ వివరించండి...',
  mr: 'येथे समस्येचे वर्णन लिहा किंवा बोला...',
  gu: 'અહીં સમસ્યાનું વર્ણન લખો અથવા બોલો...',
  kn: 'ಇಲ್ಲಿ ಸಮಸ್ಯೆಯನ್ನು ವಿವರಿಸಿ...',
  ml: 'ഇവിടെ പ്രശ്നം വിവരിക്കുക...',
  pa: 'ਇੱਥੇ ਸਮੱਸਿਆ ਦਾ ਵੇਰਵਾ ਦਿਓ...',
  or: 'ଏଠାରେ ସମସ୍ୟା ବର୍ଣ୍ଣନା କରନ୍ତୁ...',
  as: 'ইয়াত সমস্যাটো বৰ্ণনা কৰক...',
  ur: 'یہاں مسئلہ کی تفصیل لکھیں...',
  en: 'Describe the exact location and extent of the issue...',
}

export function SubmitComplaintPage() {
  const navigate = useNavigate()
  const { preferredLanguage } = useAuthStore()

  const [step, setStep]         = useState<Step>(1)
  const [lang, setLang]         = useState(preferredLanguage || 'en')
  const [category, setCategory] = useState('')

  const [titleNative, setTitleNative] = useState('')
  const [titleEn, setTitleEn]         = useState('')
  const [descNative, setDescNative]   = useState('')
  const [descEn, setDescEn]           = useState('')

  const [photos, setPhotos]     = useState<string[]>([])
  const [lat, setLat]           = useState<number>(28.6139)
  const [lng, setLng]           = useState<number>(77.2090)
  const [address, setAddress]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Voice recording
  const [isRecording, setIsRecording]   = useState(false)
  const [transcript, setTranscript]     = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [translating, setTranslating]   = useState(false)
  const [audioDataUri, setAudioDataUri] = useState<string>()
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const langMeta     = SUPPORTED_LANGUAGES.find(l => l.code === lang)
  const isNonEnglish = lang !== 'en'

  // Cleanup mic on unmount / step change
  useEffect(() => {
    return () => {
      if (mediaRef.current?.stream) {
        mediaRef.current.stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [step])

  // ── Translation helpers ──────────────────────────────────────────────────
  const translateToEnglish = async (nativeText: string): Promise<string> => {
    if (!nativeText.trim() || lang === 'en') return nativeText
    try {
      const sarvamCode = langMeta?.sarvam || 'hi-IN'
      const { data } = await translateAPI.single(nativeText, 'en-IN', sarvamCode)
      return data.translated_text || data.translated || nativeText
    } catch {
      return nativeText
    }
  }

  const translateNativeToEn = async () => {
    if (!descNative.trim()) return
    setTranslating(true)
    try {
      const [enDesc, enTitle] = await Promise.all([
        translateToEnglish(descNative),
        titleNative ? translateToEnglish(titleNative) : Promise.resolve(''),
      ])
      setDescEn(enDesc)
      if (enTitle) setTitleEn(enTitle)
    } finally {
      setTranslating(false)
    }
  }

  // ── Voice recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          if (blob.size < 500) {
            toast.error('Recording too short. Please speak for at least 1 second.')
            return
          }
          const langHint = lang !== 'en' ? lang : undefined
          const { data } = await uploadAPI.uploadAudioAndTranscribe(blob, langHint)
          if (data.public_url) setAudioDataUri(data.public_url)

          const nativeText: string = data.transcript || ''
          if (!nativeText.trim()) {
            toast.error('No speech detected. Please try again or type your complaint.')
            return
          }

          setTranscript(nativeText)
          setDescNative(nativeText)
          const firstSentence = nativeText.split(/[।.!?\n]/)[0].trim()
          if (firstSentence) setTitleNative(firstSentence.slice(0, 100))
          toast.success('Voice captured! Translating to English...')

          if (lang !== 'en') {
            setTranslating(true)
            try {
              const [enDesc, enTitle] = await Promise.all([
                translateToEnglish(nativeText),
                firstSentence ? translateToEnglish(firstSentence.slice(0, 100)) : Promise.resolve(''),
              ])
              setDescEn(enDesc)
              if (enTitle) setTitleEn(enTitle)
              toast.success('Done! Review and edit below.')
            } finally {
              setTranslating(false)
            }
          } else {
            setDescEn(nativeText)
            setTitleEn(firstSentence.slice(0, 100))
            toast.success('Voice captured! Review and edit below.')
          }
        } catch (err: any) {
          const msg = err?.response?.data?.detail || err?.message || 'Transcription failed'
          toast.error(`${msg}. Please type your complaint manually.`)
        } finally {
          setTranscribing(false)
          setTranslating(false)
        }
      }

      mr.start(100)
      mediaRef.current = mr
      setIsRecording(true)
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone in browser settings.')
      } else {
        toast.error('Could not start recording: ' + (err?.message || 'Unknown error'))
      }
    }
  }

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop()
    }
    setIsRecording(false)
  }

  // ── Photo upload ─────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max 5MB per photo.`)
        continue
      }
      try {
        const { data } = await uploadAPI.uploadPhoto(file)
        if (data.public_url) setPhotos(p => [...p, data.public_url])
      } catch {
        const localUrl = URL.createObjectURL(file)
        setPhotos(p => [...p, localUrl])
        toast.error(`Could not upload ${file.name} to server — using local preview`)
      }
    }
    setUploading(false)
    if (e.target) e.target.value = ''
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const submit = async () => {
    const finalTitle       = (isNonEnglish ? titleEn       : titleNative).trim()
    const finalDesc        = (isNonEnglish ? descEn        : descNative).trim()
    const finalTitleNative = titleNative.trim()
    const finalDescNative  = descNative.trim()

    if (!finalTitleNative && !finalTitle) { toast.error('Add a title');       return }
    if (!finalDescNative  && !finalDesc)  { toast.error('Add a description'); return }
    if (!address)                          { toast.error('Add a location');    return }

    setSubmitting(true)
    try {
      const { data } = await complaintsAPI.submit({
        title:                finalTitle || finalTitleNative,
        description:          finalDesc  || finalDescNative,
        title_original:       isNonEnglish ? finalTitleNative : undefined,
        description_original: isNonEnglish ? finalDescNative  : undefined,
        category:             category || undefined,
        original_language:    lang,
        location_address:     address,
        location_lat:         lat,
        location_lng:         lng,
        photos,
        voice_audio_url:      audioDataUri,
        voice_transcript:     transcript || undefined,
      })
      toast.success('Complaint submitted! AI is classifying it.')
      navigate(`/citizen/track/${data.complaint_id}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const canNext = () => {
    if (step === 1) return true
    if (step === 2) {
      const hasTitle = titleNative.trim().length >= 3 || titleEn.trim().length >= 3
      const hasDesc  = descNative.trim().length >= 10 || descEn.trim().length >= 10
      return hasTitle && hasDesc
    }
    if (step === 3) return !!address
    return true
  }

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="max-w-2xl mx-auto">

        {/* ── Progress bar ──────────────────────────────────────────────────── */}
        <div className="mb-8 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display font-bold text-xl text-white">Report an Issue</h1>
            <span className="text-sm text-primary-400 font-body font-semibold">Step {step} of 4</span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-300
                ${i < step       ? 'bg-primary-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                : i === step - 1 ? 'bg-primary-500/50'
                :                  'bg-slate-800'}`} />
            ))}
          </div>
          <div className="flex mt-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 text-center">
                <span className={`text-[11px] font-body tracking-wide uppercase
                  ${i === step - 1 ? 'text-primary-400 font-bold' : 'text-slate-500 font-semibold'}`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: Category + Language ───────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">What type of issue?</h2>
                <p className="text-sm text-slate-400 font-body">Select the category and your preferred language.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <label className="text-sm font-semibold text-slate-300 font-body flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-primary-400" /> Complaint Language
                  <span className="text-xs text-slate-500 font-normal ml-auto">You can speak &amp; type in your language</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                  {SUPPORTED_LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)}
                      className={`py-2.5 px-2 rounded-xl text-sm font-body font-medium border-2 transition-all relative
                        ${lang === l.code
                          ? 'border-primary-500 bg-primary-600/20 text-primary-400'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
                      {l.nativeName}
                      {l.sttSupported && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900"
                          title="Voice input supported" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2 font-body flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Green dot = voice input supported
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <motion.button key={key} whileTap={{ scale: 0.97 }} onClick={() => setCategory(key)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all
                      ${category === key
                        ? 'border-primary-500 bg-primary-600/10'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>
                    <div className="text-3xl mb-3 opacity-90">{cfg.icon}</div>
                    <p className={`text-sm font-semibold font-body ${category === key ? 'text-primary-400' : 'text-slate-300'}`}>
                      {cfg.label}
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Bilingual Details ─────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-5">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">Describe the Issue</h2>
                <p className="text-sm text-slate-400 font-body">
                  Speak or type in{' '}
                  <span className="text-primary-400 font-semibold">{langMeta?.nativeName || 'your language'}</span>.
                </p>
              </div>

              {/* Voice Input */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-200 font-body flex items-center gap-2">
                    <Mic size={16} className="text-primary-400" /> Smart Voice Input
                  </p>
                  <span className="text-xs text-primary-300 font-body font-semibold px-2 py-1 bg-primary-900/30 border border-primary-500/30 rounded-lg">
                    {langMeta?.nativeName || 'English'}
                  </span>
                </div>
                <motion.button type="button" whileTap={{ scale: 0.95 }}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={transcribing || translating}
                  className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-2 font-semibold font-body transition-all text-sm border-2
                    ${isRecording
                      ? 'bg-red-500/10 border-red-500 text-red-400 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                      : transcribing || translating
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : 'bg-slate-800 border-slate-700 text-primary-400 hover:border-primary-500/50 hover:bg-slate-700/50'}`}>
                  {transcribing ? (
                    <><Loader2 size={20} className="animate-spin text-primary-400" />
                    <span>Transcribing via Groq Whisper...</span>
                    <span className="text-xs text-slate-500 font-normal">This takes 5–10 seconds</span></>
                  ) : translating ? (
                    <><Languages size={20} className="animate-pulse text-green-400" />
                    <span className="text-green-400">Translating to English...</span></>
                  ) : isRecording ? (
                    <><MicOff size={22} className="text-red-400" />
                    <span>Tap to Stop Recording</span>
                    <span className="text-xs text-red-300 font-normal opacity-75">Recording in {langMeta?.nativeName}...</span></>
                  ) : (
                    <><Mic size={22} />
                    <span>Tap to Speak</span>
                    <span className="text-xs text-slate-500 font-normal">Speak in {langMeta?.nativeName || 'any Indian language'}</span></>
                  )}
                </motion.button>
                {transcript && (
                  <div className="bg-primary-900/20 border border-primary-800/40 rounded-xl p-3">
                    <p className="text-xs text-primary-400 font-semibold mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                      <Volume2 size={12} /> Auto-Transcribed
                    </p>
                    <p className="text-sm text-primary-200 font-body leading-relaxed">{transcript}</p>
                  </div>
                )}
              </div>

              {isNonEnglish ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                        <div>
                          <p className="text-xs font-bold text-slate-200 font-body">{langMeta?.nativeName}</p>
                          <p className="text-[10px] text-slate-500">Original language</p>
                        </div>
                        <Pencil size={12} className="ml-auto text-slate-600" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 font-body block mb-1.5">Title</label>
                        <input type="text" value={titleNative} onChange={e => setTitleNative(e.target.value)}
                          placeholder={`${langMeta?.name} title...`}
                          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl outline-none focus:border-primary-500 font-body text-sm placeholder:text-slate-600 transition-colors"
                          maxLength={200} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 font-body block mb-1.5">Description</label>
                        <textarea value={descNative} onChange={e => setDescNative(e.target.value)} rows={5}
                          placeholder={LANG_PLACEHOLDERS[lang] || 'Describe in your language...'}
                          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl outline-none focus:border-primary-500 font-body text-sm placeholder:text-slate-600 transition-colors resize-none"
                          maxLength={2000} />
                        <p className="text-[10px] text-slate-600 mt-1 font-body">{descNative.length}/2000</p>
                      </div>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={translateNativeToEn}
                        disabled={translating || (!titleNative.trim() && !descNative.trim())}
                        className="w-full py-2.5 rounded-xl text-xs font-semibold font-body flex items-center justify-center gap-2 bg-green-600/10 border border-green-500/30 text-green-400 hover:bg-green-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {translating ? <><Loader2 size={12} className="animate-spin" /> Translating...</> : <><Languages size={12} /> Translate to English</>}
                      </motion.button>
                    </div>
                    <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                        <span className="text-lg">🇬🇧</span>
                        <div>
                          <p className="text-xs font-bold text-slate-200 font-body">English</p>
                          <p className="text-[10px] text-slate-500">Stored in DB · Shown to officers</p>
                        </div>
                        <Pencil size={12} className="ml-auto text-slate-600" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 font-body block mb-1.5">Title (English)</label>
                        <input type="text" value={titleEn} onChange={e => setTitleEn(e.target.value)}
                          placeholder="English title..."
                          className={`w-full px-3 py-2.5 border rounded-xl outline-none font-body text-sm transition-colors
                            ${titleEn ? 'bg-green-950/30 border-green-700/50 text-green-200 focus:border-green-500' : 'bg-slate-800 border-slate-700 text-white focus:border-primary-500 placeholder:text-slate-600'}`}
                          maxLength={200} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 font-body block mb-1.5">Description (English)</label>
                        <textarea value={descEn} onChange={e => setDescEn(e.target.value)} rows={5}
                          placeholder="English translation will appear here..."
                          className={`w-full px-3 py-2.5 border rounded-xl outline-none font-body text-sm transition-colors resize-none
                            ${descEn ? 'bg-green-950/30 border-green-700/50 text-green-200 focus:border-green-500' : 'bg-slate-800 border-slate-700 text-white focus:border-primary-500 placeholder:text-slate-600'}`}
                          maxLength={2000} />
                        <p className="text-[10px] text-slate-600 mt-1 font-body">{descEn.length}/2000</p>
                      </div>
                      {(titleEn || descEn) && (
                        <button onClick={translateNativeToEn} disabled={translating}
                          className="text-xs text-slate-500 hover:text-slate-300 font-body flex items-center gap-1.5 transition-colors">
                          <RefreshCw size={11} className={translating ? 'animate-spin' : ''} />
                          Re-translate from {langMeta?.nativeName}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 flex items-start gap-2.5">
                    <Languages size={14} className="text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-300 font-body leading-relaxed">
                      <strong>Both versions are saved.</strong> Your {langMeta?.nativeName} text is the original. The English version is shown to MCD officers and used by AI for classification.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-300 font-body block mb-2">Issue Title</label>
                    <input type="text" value={titleNative} onChange={e => setTitleNative(e.target.value)}
                      placeholder="e.g., Deep pothole near sector 4 market"
                      className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 transition-colors"
                      maxLength={200} />
                    <p className="text-xs text-slate-500 mt-1.5 font-body">{titleNative.length}/200</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 font-body block mb-2">Description</label>
                    <textarea value={descNative} onChange={e => setDescNative(e.target.value)} rows={6}
                      placeholder={LANG_PLACEHOLDERS['en']}
                      className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 transition-colors resize-none"
                      maxLength={2000} />
                    <p className="text-xs text-slate-500 mt-1.5 font-body">{descNative.length}/2000</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP 3: Location & Media ──────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="s3"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">Location & Evidence</h2>
                <p className="text-sm text-slate-400 font-body">Pin the exact spot and attach photos.</p>
              </div>

              {/* ── LocationPicker replaces the old inline map ── */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <LocationPicker
                  initialLat={lat}
                  initialLng={lng}
                  initialAddress={address}
                  onLocationSelect={(newLat, newLng, newAddress) => {
                    setLat(newLat)
                    setLng(newLng)
                    setAddress(newAddress)
                  }}
                />
              </div>

              {/* Photos */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <label className="text-sm font-semibold text-slate-300 font-body flex items-center gap-2 mb-3">
                  <Camera size={16} className="text-primary-400" /> Upload Photos ({photos.length}/5)
                  <span className="text-xs text-slate-500 font-normal ml-auto">Max 5MB each</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                <button onClick={() => fileRef.current?.click()} disabled={photos.length >= 5 || uploading}
                  className="w-full py-6 border-2 border-dashed border-slate-700 bg-slate-800/50 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-primary-500 hover:text-primary-400 transition-colors disabled:opacity-50 font-body">
                  {uploading ? <Loader2 size={24} className="animate-spin text-primary-400" /> : <Image size={24} />}
                  <span className="text-sm font-medium">{uploading ? 'Uploading...' : 'Tap to select photos'}</span>
                </button>
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {photos.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500/90 backdrop-blur rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: Review ───────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div key="s4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">Final Review</h2>
                <p className="text-sm text-slate-400 font-body">Review before submission.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
                {category && (
                  <div className="border-b border-slate-800 pb-4">
                    <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-1.5">Category</p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl bg-slate-800 p-2 rounded-xl">{CATEGORY_CONFIG[category]?.icon}</span>
                      <span className="font-semibold text-slate-200 font-body text-base">{CATEGORY_CONFIG[category]?.label}</span>
                    </div>
                  </div>
                )}
                <div className="border-b border-slate-800 pb-4">
                  <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-2">Title</p>
                  {isNonEnglish ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-primary-400 font-semibold font-body mt-0.5 w-14 shrink-0">{langMeta?.name}</span>
                        <p className="font-semibold text-white font-body">{titleNative}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-green-400 font-semibold font-body mt-0.5 w-14 shrink-0">English</span>
                        <p className="font-semibold text-green-200 font-body">{titleEn || <span className="text-slate-500 italic font-normal text-sm">Not translated yet</span>}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="font-semibold text-white font-body">{titleNative}</p>
                  )}
                </div>
                <div className="border-b border-slate-800 pb-4">
                  <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-2">Description</p>
                  {isNonEnglish ? (
                    <div className="space-y-3">
                      <div className="bg-slate-800 rounded-xl p-3">
                        <p className="text-[10px] text-primary-400 font-semibold font-body mb-1">{langMeta?.nativeName} (Original)</p>
                        <p className="text-sm text-slate-300 font-body leading-relaxed">{descNative}</p>
                      </div>
                      <div className="bg-green-950/30 border border-green-800/30 rounded-xl p-3">
                        <p className="text-[10px] text-green-400 font-semibold font-body mb-1">English (Shown to Officers)</p>
                        <p className="text-sm text-green-200 font-body leading-relaxed">
                          {descEn || <span className="text-slate-500 italic">Not translated yet — go back to Step 2</span>}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300 font-body leading-relaxed">{descNative}</p>
                  )}
                </div>
                <div className="border-b border-slate-800 pb-4">
                  <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-1.5">Location</p>
                  <p className="text-sm text-slate-300 font-body flex items-start gap-2">
                    <MapPin size={16} className="text-primary-500 shrink-0 mt-0.5" />
                    <span>{address}</span>
                  </p>
                </div>
                {photos.length > 0 && (
                  <div className="border-b border-slate-800 pb-4">
                    <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-2">
                      Evidence ({photos.length} photo{photos.length > 1 ? 's' : ''})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {photos.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-700" />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-1.5">Language</p>
                  <span className="inline-block px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold">
                    {langMeta?.nativeName || 'English'}
                  </span>
                </div>
              </div>

              {isNonEnglish && !descEn && (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-2.5">
                  <span className="text-amber-400 text-base">⚠️</span>
                  <div>
                    <p className="text-sm text-amber-300 font-semibold font-body">English translation missing</p>
                    <p className="text-xs text-amber-400/70 font-body mt-0.5">Go back to Step 2 and click "Translate to English" for best results.</p>
                  </div>
                </div>
              )}

              <div className="bg-primary-900/20 border border-primary-500/30 rounded-2xl p-5">
                <p className="text-sm text-primary-300 font-body leading-relaxed flex items-start gap-3">
                  <span className="text-xl">🤖</span>
                  <span>Once submitted, our AI will instantly classify urgency and auto-assign to the right officer. You'll get SMS updates.</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigation buttons ─────────────────────────────────────────── */}
        <div className="flex gap-3 mt-8 pb-10">
          {step > 1 && (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setStep(s => (s - 1) as Step)}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-2xl font-body flex items-center gap-2 transition-colors">
              <ArrowLeft size={16} /> Back
            </motion.button>
          )}
          {step < 4 ? (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={!canNext()}
              className="flex-1 py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-semibold rounded-2xl font-body flex items-center justify-center gap-2 transition-colors shadow-glow-blue disabled:shadow-none">
              Next Step <ArrowRight size={16} />
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={submitting}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-2xl font-body flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(22,163,74,0.4)] disabled:shadow-none">
              {submitting
                ? <><Loader2 size={18} className="animate-spin" /> Submitting to MCD...</>
                : <><CheckCircle size={18} /> Confirm & Submit</>}
            </motion.button>
          )}
        </div>

      </div>
    </AppShell>
  )
}