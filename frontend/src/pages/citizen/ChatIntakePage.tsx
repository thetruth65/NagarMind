/**
 * NagarMind v3 — ChatIntakePage.tsx
 *
 * Stages:
 *   greeting → asking_title → asking_description → asking_category
 *   → asking_address  ← LocationPicker embedded inline in chat
 *   → asking_photos   ← Photo upload step embedded inline in chat
 *   → confirming → submitted
 *
 * Layout:
 *   Desktop (≥1024px): Split-screen — chat left, live preview right
 *   Mobile: Single column, collapsible preview panel
 *
 * Features:
 *   - Sequential AI questioning (one thing at a time)
 *   - LocationPicker embedded in chat when asking_address
 *   - Photo upload (up to 5) embedded in chat when asking_photos
 *   - Live preview panel updates in real-time
 *   - Click preview field → edit it (sends edit to chatbot)
 *   - Voice input via Groq Whisper
 *   - Full backend complaint submission with DB entry
 */

import {
  useState, useRef, useEffect, useCallback, ChangeEvent
} from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Mic, MicOff, Send, Loader2, FileText, Globe,
  Eye, EyeOff, Edit3, AlignLeft, Tag, MapPin, Camera,
  CheckCircle2, X, Image as ImageIcon, Navigation
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { AppShell } from '@/components/common/AppShell'
import { api, uploadAPI, complaintsAPI } from '@/lib/api'
import { SUPPORTED_LANGUAGES, CATEGORY_CONFIG } from '@/types'
import toast from 'react-hot-toast'

// ── nav ───────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
]

// ── types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'bot' | 'system'
  text: string
  ts: Date
  widget?: 'location' | 'photos'   // renders special inline widget
}

interface ExtractedData {
  title:       string | null
  description: string | null
  category:    string | null
  address:     string | null
  stage:       string
}

const STAGE_FIELD: Record<string, keyof ExtractedData | null> = {
  greeting:            null,
  asking_title:        'title',
  asking_description:  'description',
  asking_category:     'category',
  asking_address:      'address',
  asking_photos:       null,
  confirming:          null,
  submitted:           null,
}

const QUICK: Record<string, string[]> = {
  asking_category: ['Yes, correct ✅', 'No, change it ❌'],
  confirming:      ['✅ Yes, submit!', '❌ No, change something'],
}

// ── component ─────────────────────────────────────────────────────────────────
export function ChatIntakePage() {
  const navigate = useNavigate()

  // chat state
  const [messages,    setMessages]    = useState<Message[]>([])
  const [inputText,   setInputText]   = useState('')
  const [language,    setLanguage]    = useState('en')
  const [showLang,    setShowLang]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [stage,       setStage]       = useState('greeting')
  const [threadId]                    = useState(() => uuidv4())

  // extracted data (for preview)
  const [extracted, setExtracted] = useState<ExtractedData>({
    title: null, description: null, category: null, address: null, stage: 'greeting',
  })

  // location state
  const [lat,          setLat]          = useState(28.6139)
  const [lng,          setLng]          = useState(77.2090)
  const [address,      setAddress]      = useState('')
  const [locationDone, setLocationDone] = useState(false)

  // photo state
  const [photos,       setPhotos]       = useState<string[]>([])
  const [uploading,    setUploading]    = useState(false)
  const [photosDone,   setPhotosDone]   = useState(false)

  // voice
  const [isRecording,   setIsRecording]   = useState(false)
  const [transcribing,  setTranscribing]  = useState(false)

  // layout
  const [wideLayout,    setWideLayout]    = useState(false)
  const [showPreview,   setShowPreview]   = useState(true)
  const [editingField,  setEditingField]  = useState<string | null>(null)
  const [editValue,     setEditValue]     = useState('')

  // submission
  const [submitting,    setSubmitting]    = useState(false)
  const [complaintId,   setComplaintId]   = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const mediaRef   = useRef<MediaRecorder | null>(null)
  const chunksRef  = useRef<Blob[]>([])
  const hasInit    = useRef(false)

  // ── detect screen width ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setWideLayout(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── initial greeting ────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasInit.current) return
    hasInit.current = true
    callAgent('', true)
  }, [])

  // ── helpers ──────────────────────────────────────────────────────────────────
  const addMsg = (role: Message['role'], text: string, widget?: Message['widget']) =>
    setMessages(prev => [...prev, { id: uuidv4(), role, text, ts: new Date(), widget }])

  // ── call backend agent ───────────────────────────────────────────────────────
  const callAgent = useCallback(async (userMsg: string, isInit = false) => {
    if (loading) return
    if (!isInit && !userMsg.trim()) return

    if (!isInit && userMsg.trim()) addMsg('user', userMsg)
    setInputText('')
    setLoading(true)

    try {
      const { data } = await api.post('/api/chatbot/message', {
        message:    userMsg || '',
        thread_id:  threadId,
        language,
        latitude:   lat,
        longitude:  lng,
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

      // Show location widget when chatbot asks for address
      if (newStage === 'asking_address') {
        addMsg('bot', data.reply, 'location')
      } else if (newStage === 'asking_photos') {
        addMsg('bot', data.reply, 'photos')
      } else {
        addMsg('bot', data.reply)
      }

      // Handle submitted
      if (newStage === 'submitted' && data.complaint_payload) {
        await submitComplaint(data.complaint_payload)
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Connection error. Please try again.'
      addMsg('bot', `Sorry — ${msg}`)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [loading, language, threadId, lat, lng])

  // ── submit complaint to DB ───────────────────────────────────────────────────
  const submitComplaint = async (payload: any) => {
    setSubmitting(true)
    try {
      const { data } = await complaintsAPI.submit({
        title:             payload.title       || 'Civic Issue',
        description:       payload.description || '',
        category:          payload.category    || 'other',
        original_language: payload.original_language || language,
        location_address:  address || payload.location_address || '',
        location_lat:      lat,
        location_lng:      lng,
        photos:            photos,
        voice_transcript:  payload.voice_transcript || null,
      })
      setComplaintId(data.complaint_id)
      toast.success('✅ Complaint submitted successfully!')
      setTimeout(() => navigate(`/citizen/track/${data.complaint_id}`), 2500)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── location confirmed by user ───────────────────────────────────────────────
  const confirmLocation = async () => {
    if (!address.trim()) {
      toast.error('Please pin a location or type an address first')
      return
    }
    setLocationDone(true)
    addMsg('user', `📍 ${address}`)
    // Send the address as a message to the agent so it can proceed
    await callAgent(address)
  }

  // ── photos uploaded, move on ─────────────────────────────────────────────────
  const confirmPhotos = async () => {
    setPhotosDone(true)
    const msg = photos.length > 0
      ? `📸 Added ${photos.length} photo${photos.length > 1 ? 's' : ''}`
      : '⏭️ Skipping photos'
    addMsg('user', msg)
    await callAgent(photos.length > 0 ? `I've added ${photos.length} photo(s)` : 'No photos, please continue')
  }

  // ── photo file upload ─────────────────────────────────────────────────────────
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} too large (max 5MB)`); continue }
      try {
        const { data } = await uploadAPI.uploadPhoto(file)
        if (data.public_url) setPhotos(p => [...p, data.public_url])
      } catch {
        // Local preview fallback
        setPhotos(p => [...p, URL.createObjectURL(file)])
      }
    }
    setUploading(false)
    if (e.target) e.target.value = ''
  }

  // ── voice recording ───────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 500) { toast.error('Too short — speak for at least 1 second'); return }
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
          if (language !== 'en') form.append('language_hint', language)
          const { data } = await api.post('/api/chatbot/transcribe', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (data.transcript?.trim()) callAgent(data.transcript.trim())
          else toast.error('Could not understand — please speak clearly or type')
        } catch { toast.error('Transcription failed. Please type instead.') }
        finally { setTranscribing(false) }
      }
      rec.start(); mediaRef.current = rec; setIsRecording(true)
    } catch { toast.error('Microphone access denied') }
  }
  const stopRecording = () => {
    mediaRef.current?.state !== 'inactive' && mediaRef.current?.stop()
    setIsRecording(false)
  }

  // ── field editing from preview ────────────────────────────────────────────────
  const startEdit = (field: string, cur: string | null) => {
    setEditingField(field); setEditValue(cur || '')
  }
  const saveEdit = () => {
    if (!editingField || !editValue.trim()) { setEditingField(null); return }
    callAgent(`Change the ${editingField} to: ${editValue.trim()}`)
    setEditingField(null); setEditValue('')
  }

  // ── derived ───────────────────────────────────────────────────────────────────
  const activeField  = STAGE_FIELD[stage]
  const quickReplies = QUICK[stage] || []
  const catCfg       = extracted.category ? CATEGORY_CONFIG[extracted.category] : null
  const isSubmitted  = stage === 'submitted'
  const progress     = ['title','description','category','address'].filter(f => extracted[f as keyof ExtractedData]).length

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className={`-mx-4 md:-mx-8 flex ${wideLayout ? 'h-[calc(100dvh-64px)]' : 'flex-col min-h-[calc(100dvh-64px)]'}`}>

        {/* ═══════════════════════ LEFT: CHAT ═════════════════════════════════ */}
        <div className={`flex flex-col bg-slate-950 ${wideLayout ? 'w-[55%]' : 'flex-1'}`}>

          {/* Header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
            <button onClick={() => navigate('/citizen/dashboard')}
              className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 shrink-0">
              <ArrowLeft size={16} className="text-slate-300" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm font-body">Report via AI Chat</p>
              <p className="text-slate-400 text-xs font-body truncate">NagarMind guides you step by step</p>
            </div>

            {/* Language picker */}
            <div className="relative">
              <button onClick={() => setShowLang(!showLang)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700
                           rounded-xl text-slate-300 text-xs font-body hover:bg-slate-700">
                <Globe size={12} />
                <span className="hidden sm:inline">{SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName || 'EN'}</span>
              </button>
              <AnimatePresence>
                {showLang && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute right-0 top-full mt-1 z-50 w-44 bg-slate-800 border border-slate-700
                               rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {SUPPORTED_LANGUAGES.map(l => (
                      <button key={l.code} onClick={() => { setLanguage(l.code); setShowLang(false) }}
                        className={`w-full text-left px-3 py-2 text-xs font-body flex justify-between
                          ${l.code === language ? 'bg-primary-600/20 text-primary-400' : 'text-slate-300 hover:bg-slate-700'}`}>
                        <span>{l.nativeName}</span><span className="text-slate-500">{l.name}</span>
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

            {/* Toggle preview (mobile) */}
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
                <motion.div initial={{ height: 0 }} animate={{ height: 200 }} exit={{ height: 0 }}
                  className="shrink-0 overflow-hidden border-b border-slate-800">
                  <PreviewPanel {...{ extracted, activeField, catCfg, progress, isSubmitted, stage,
                    editingField, editValue, startEdit, setEditValue, saveEdit, setEditingField,
                    lat, lng, address, photos }} />
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
                    <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30
                                    flex items-center justify-center shrink-0 text-sm mb-0.5">🏙️</div>
                  )}
                  <div className={`max-w-[80%] px-4 py-2.5 text-sm font-body leading-relaxed rounded-2xl
                    ${msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'}`}>
                    {msg.text}
                  </div>
                </motion.div>

                {/* ── LOCATION WIDGET ── */}
                {msg.widget === 'location' && !locationDone && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="ml-10 mt-3 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-400 font-body flex items-center gap-1.5">
                        <MapPin size={12} /> Pin the exact location
                      </span>
                      <span className="text-xs text-slate-500 font-body">or type below</span>
                    </div>

                    {/* Inline mini-map using Leaflet — rendered via LocationPickerMini */}
                    <LocationPickerMini
                      lat={lat} lng={lng} address={address}
                      onLocationSelect={(newLat, newLng, newAddr) => {
                        setLat(newLat); setLng(newLng); setAddress(newAddr)
                        setExtracted(p => ({ ...p, address: newAddr }))
                      }}
                    />

                    {/* Address text display */}
                    {address && (
                      <div className="mx-3 mb-2 px-3 py-2 bg-slate-800 rounded-xl">
                        <p className="text-xs text-slate-400 font-body flex items-center gap-1">
                          <MapPin size={10} className="text-primary-400 shrink-0" /> {address}
                        </p>
                      </div>
                    )}

                    <div className="px-3 pb-3">
                      <button onClick={confirmLocation}
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm
                                   font-semibold rounded-xl font-body transition-colors flex items-center
                                   justify-center gap-2">
                        <CheckCircle2 size={15} /> Confirm This Location
                      </button>
                    </div>
                  </motion.div>
                )}
                {msg.widget === 'location' && locationDone && (
                  <div className="ml-10 mt-2">
                    <span className="text-xs text-green-400 font-body flex items-center gap-1">
                      <CheckCircle2 size={11} /> Location set: {address.slice(0, 50)}{address.length > 50 ? '…' : ''}
                    </span>
                  </div>
                )}

                {/* ── PHOTOS WIDGET ── */}
                {msg.widget === 'photos' && !photosDone && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="ml-10 mt-3 bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-400 font-body flex items-center gap-1.5">
                        <Camera size={12} /> Add Evidence Photos (optional)
                      </span>
                      <span className="text-xs text-slate-500 font-body">{photos.length}/5</span>
                    </div>

                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={handlePhotoSelect} />

                    {/* Upload button */}
                    <button onClick={() => fileRef.current?.click()}
                      disabled={photos.length >= 5 || uploading}
                      className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl
                                 flex items-center justify-center gap-2 text-slate-400
                                 hover:border-primary-500 hover:text-primary-400 transition-colors
                                 text-sm font-body disabled:opacity-50">
                      {uploading
                        ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                        : <><ImageIcon size={14} /> Tap to add photos</>}
                    </button>

                    {/* Photo previews */}
                    {photos.length > 0 && (
                      <div className="grid grid-cols-5 gap-2">
                        {photos.map((url, i) => (
                          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full
                                         flex items-center justify-center">
                              <X size={10} className="text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={confirmPhotos}
                        className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm
                                   font-semibold rounded-xl font-body transition-colors flex items-center
                                   justify-center gap-2">
                        <CheckCircle2 size={15} />
                        {photos.length > 0 ? `Add ${photos.length} Photo${photos.length > 1 ? 's' : ''} & Continue` : 'Skip Photos'}
                      </button>
                    </div>
                  </motion.div>
                )}
                {msg.widget === 'photos' && photosDone && (
                  <div className="ml-10 mt-2">
                    <span className="text-xs text-green-400 font-body flex items-center gap-1">
                      <CheckCircle2 size={11} /> {photos.length > 0 ? `${photos.length} photo(s) attached` : 'No photos — skipped'}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {(loading || transcribing || submitting) && (
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30
                                flex items-center justify-center shrink-0 text-sm">🏙️</div>
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
                      {[0,1,2].map(i => (
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
                  <p className="text-green-300 font-semibold font-body text-sm">Complaint Submitted!</p>
                  <p className="text-green-400/70 text-xs font-body mt-1">Redirecting to tracking page...</p>
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
                  className="shrink-0 px-4 py-1.5 bg-slate-800 border border-slate-700 rounded-full
                             text-sm text-slate-300 hover:border-primary-500 hover:text-primary-400
                             font-body transition-all whitespace-nowrap">
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Input bar — hidden during location/photo widget or after submit */}
          {!isSubmitted && stage !== 'asking_address' && stage !== 'asking_photos' && (
            <div className="shrink-0 px-4 py-3 bg-slate-900 border-t border-slate-800">
              <div className="flex gap-2 items-end">
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); callAgent(inputText) } }}
                  placeholder={language === 'hi' ? 'यहाँ लिखें या माइक दबाएं...' : 'Type or hold mic to speak...'}
                  rows={1}
                  disabled={loading || transcribing}
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-2xl
                             px-4 py-2.5 text-sm font-body resize-none outline-none
                             focus:border-primary-500 placeholder:text-slate-500 disabled:opacity-50"
                  style={{ maxHeight: 100, overflowY: 'auto' }}
                />
                {/* Voice */}
                <motion.button
                  onMouseDown={startRecording} onMouseUp={stopRecording}
                  onTouchStart={e => { e.preventDefault(); startRecording() }}
                  onTouchEnd={e => { e.preventDefault(); stopRecording() }}
                  disabled={loading || transcribing}
                  whileTap={{ scale: 0.92 }}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 select-none touch-none
                    ${isRecording
                      ? 'bg-red-600 border-2 border-red-400 animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.5)]'
                      : 'bg-slate-800 border border-slate-700 hover:border-slate-500'}
                    disabled:opacity-40`}>
                  {transcribing ? <Loader2 size={15} className="animate-spin text-primary-400" />
                    : isRecording ? <MicOff size={15} className="text-white" />
                    : <Mic size={15} className="text-slate-400" />}
                </motion.button>
                {/* Send */}
                <button onClick={() => callAgent(inputText)}
                  disabled={!inputText.trim() || loading}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
                             bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40
                             disabled:cursor-default shadow-glow-blue disabled:shadow-none transition-all">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <p className="text-center text-slate-600 text-[10px] font-body mt-1.5">
                Hold mic • Enter to send • {SUPPORTED_LANGUAGES.length} Indian languages
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════════════ RIGHT: PREVIEW (desktop) ═══════════════════ */}
        {wideLayout && (
          <div className="w-[45%] flex flex-col border-l border-slate-800">
            <PreviewPanel {...{ extracted, activeField, catCfg, progress, isSubmitted, stage,
              editingField, editValue, startEdit, setEditValue, saveEdit, setEditingField,
              lat, lng, address, photos }} />
          </div>
        )}
      </div>
    </AppShell>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// PREVIEW PANEL
// ══════════════════════════════════════════════════════════════════════════════

interface PreviewProps {
  extracted:     ExtractedData
  activeField:   keyof ExtractedData | null
  catCfg:        any
  progress:      number
  isSubmitted:   boolean
  stage:         string
  editingField:  string | null
  editValue:     string
  startEdit:     (f: string, v: string | null) => void
  setEditValue:  (v: string) => void
  saveEdit:      () => void
  setEditingField: (f: string | null) => void
  lat:     number
  lng:     number
  address: string
  photos:  string[]
}

function PreviewPanel({
  extracted, activeField, catCfg, progress, isSubmitted, stage,
  editingField, editValue, startEdit, setEditValue, saveEdit, setEditingField,
  lat, lng, address, photos,
}: PreviewProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-primary-400" />
          <span className="font-semibold text-white text-sm font-body">Live Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${(progress / 4) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-400 font-body">{progress}/4</span>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <PreviewField icon={<Edit3 size={12} />} label="Issue Title"
          value={extracted.title} isActive={activeField === 'title'}
          isEditing={editingField === 'title'} editValue={editValue}
          onEdit={() => startEdit('title', extracted.title)}
          onEditChange={setEditValue} onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          placeholder="What's the problem?" />

        <PreviewField icon={<AlignLeft size={12} />} label="Description"
          value={extracted.description} isActive={activeField === 'description'}
          isEditing={editingField === 'description'} editValue={editValue}
          onEdit={() => startEdit('description', extracted.description)}
          onEditChange={setEditValue} onSave={saveEdit}
          onCancel={() => setEditingField(null)}
          placeholder="Details about the issue" multiline />

        {/* Category */}
        <div className={`rounded-xl border p-3 transition-all
          ${activeField === 'category'
            ? 'border-primary-500 bg-primary-600/10 shadow-[0_0_10px_rgba(37,99,235,0.2)]'
            : 'border-slate-700 bg-slate-800/50'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Tag size={12} className={activeField === 'category' ? 'text-primary-400' : 'text-slate-500'} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</span>
              {activeField === 'category' && <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />}
            </div>
            {extracted.category && (
              <button onClick={() => startEdit('category', extracted.category)}
                className="text-[10px] text-slate-500 hover:text-primary-400 font-body">Edit</button>
            )}
          </div>
          {extracted.category ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{catCfg?.icon || '📋'}</span>
              <span className="text-sm font-semibold text-slate-200 font-body">{catCfg?.label || extracted.category}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic font-body">
              {activeField === 'category' ? '🤖 Auto-detecting...' : 'Will be auto-detected'}
            </p>
          )}
        </div>

        {/* Location */}
        <div className={`rounded-xl border p-3 transition-all
          ${activeField === 'address' || stage === 'asking_address'
            ? 'border-primary-500 bg-primary-600/10 shadow-[0_0_10px_rgba(37,99,235,0.2)]'
            : 'border-slate-700 bg-slate-800/50'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={12} className={activeField === 'address' ? 'text-primary-400' : 'text-slate-500'} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</span>
            {(activeField === 'address' || stage === 'asking_address') && (
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />
            )}
          </div>
          {address ? (
            <p className="text-xs text-slate-200 font-body leading-snug">{address}</p>
          ) : (
            <p className="text-xs text-slate-600 italic font-body">
              {stage === 'asking_address' ? '📍 Use the map in chat →' : 'Waiting for location...'}
            </p>
          )}
          {lat !== 28.6139 && lng !== 77.2090 && (
            <p className="text-[10px] text-slate-500 font-mono mt-1">{lat.toFixed(4)}°N {lng.toFixed(4)}°E</p>
          )}
        </div>

        {/* Photos */}
        <div className={`rounded-xl border p-3 transition-all
          ${stage === 'asking_photos'
            ? 'border-primary-500 bg-primary-600/10'
            : 'border-slate-700 bg-slate-800/50'}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Camera size={12} className={stage === 'asking_photos' ? 'text-primary-400' : 'text-slate-500'} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidence Photos</span>
          </div>
          {photos.length > 0 ? (
            <div className="grid grid-cols-5 gap-1">
              {photos.map((url, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-600">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic font-body">
              {stage === 'asking_photos' ? '📸 Use the upload widget in chat →' : 'Optional evidence photos'}
            </p>
          )}
        </div>

        {/* Stage hint */}
        {!isSubmitted && (
          <div className="mt-2 text-center">
            <p className="text-[10px] text-slate-600 font-body">
              {stage === 'greeting'           && '👋 Starting...'}
              {stage === 'asking_title'       && '✏️ Enter issue title'}
              {stage === 'asking_description' && '📝 Describe the problem'}
              {stage === 'asking_category'    && '🏷️ Confirm category'}
              {stage === 'asking_address'     && '📍 Pin location on map'}
              {stage === 'asking_photos'      && '📸 Add evidence photos'}
              {stage === 'confirming'         && '✅ Review and submit'}
            </p>
          </div>
        )}

        {/* Submitted */}
        {isSubmitted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-green-900/30 border border-green-700/40 rounded-xl p-3 text-center">
            <CheckCircle2 size={24} className="text-green-400 mx-auto mb-1" />
            <p className="text-green-300 font-semibold text-sm font-body">Submitted!</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// LOCATION PICKER MINI  (dark-themed, embedded in chat)
// ══════════════════════════════════════════════════════════════════════════════

interface LPMiniProps {
  lat: number; lng: number; address: string
  onLocationSelect: (lat: number, lng: number, addr: string) => void
}

function LocationPickerMini({ lat, lng, address, onLocationSelect }: LPMiniProps) {
  const mapRef       = useRef<any>(null)
  const markerRef    = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [searching,  setSearching] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [query,      setQuery]     = useState('')

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    // Dynamic import of Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      const Lx = L.default || L
      // Fix broken Leaflet icons
      delete (Lx.Icon.Default.prototype as any)._getIconUrl
      Lx.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })

      const RED_ICON = Lx.divIcon({
        className: '',
        html: `<div style="width:28px;height:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">
          <svg viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 12.25 21.333 13.25 22.333a1 1 0 001.5 0C15.75 35.333 28 23.333 28 14 28 6.268 21.732 0 14 0z" fill="#3b82f6"/>
            <circle cx="14" cy="13" r="5" fill="white" opacity="0.9"/>
            <circle cx="14" cy="13" r="3" fill="#3b82f6"/>
          </svg></div>`,
        iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -40],
      })

      if (!containerRef.current) return
      const map = Lx.map(containerRef.current, {
        center: [lat, lng], zoom: 15,
        scrollWheelZoom: false, zoomControl: true,
      })

      Lx.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)

      const marker = Lx.marker([lat, lng], { draggable: true, icon: RED_ICON }).addTo(map)
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

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  const reverseGeocode = async (la: number, lo: number): Promise<string> => {
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&zoom=17`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      const a    = data.address || {}
      const parts = [
        a.road || a.pedestrian || a.footway,
        a.neighbourhood || a.suburb || a.quarter || a.village,
        a.city || a.town || a.county,
      ].filter(Boolean)
      return parts.length > 0
        ? parts.join(', ')
        : data.display_name?.split(',').slice(0, 3).join(', ') || `${la.toFixed(5)}, ${lo.toFixed(5)}`
    } catch {
      return `${la.toFixed(5)}, ${lo.toFixed(5)}`
    }
  }

  const useGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS not supported'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: la, longitude: lo } }) => {
        if (mapRef.current && markerRef.current) {
          markerRef.current.setLatLng([la, lo])
          mapRef.current.setView([la, lo], 17, { animate: true })
        }
        const addr = await reverseGeocode(la, lo)
        onLocationSelect(la, lo, addr)
        setGpsLoading(false)
        toast.success('📍 GPS location captured!')
      },
      () => { toast.error('GPS failed — pin on map instead'); setGpsLoading(false) },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const searchLocation = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Delhi India')}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const results = await res.json()
      if (results[0]) {
        const la = parseFloat(results[0].lat)
        const lo = parseFloat(results[0].lon)
        if (mapRef.current && markerRef.current) {
          markerRef.current.setLatLng([la, lo])
          mapRef.current.setView([la, lo], 16, { animate: true })
        }
        const addr = results[0].display_name.split(',').slice(0, 3).join(', ')
        onLocationSelect(la, lo, addr)
        setQuery('')
      } else {
        toast.error('Location not found — try a different address')
      }
    } catch { toast.error('Search failed') }
    finally { setSearching(false) }
  }

  return (
    <div className="px-3 pb-1 space-y-2">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchLocation()}
          placeholder="Search area, colony, landmark..."
          className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl
                     px-3 py-2 text-xs font-body outline-none focus:border-primary-500
                     placeholder:text-slate-600"
        />
        <button onClick={searchLocation} disabled={searching}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-body transition-colors">
          {searching ? <Loader2 size={12} className="animate-spin" /> : '🔍'}
        </button>
        <button onClick={useGPS} disabled={gpsLoading}
          className="px-3 py-2 bg-primary-600/20 border border-primary-500/40 hover:bg-primary-600/30
                     text-primary-400 rounded-xl text-xs font-body transition-colors flex items-center gap-1">
          {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
          <span className="hidden sm:inline">GPS</span>
        </button>
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-700">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none
                        bg-slate-900/90 text-slate-300 text-[10px] font-body px-2 py-1 rounded-full
                        whitespace-nowrap flex items-center gap-1">
          <MapPin size={9} className="text-primary-400" /> Click map or drag pin
        </div>
        <div ref={containerRef} style={{ height: 200, width: '100%' }} />
      </div>
    </div>
  )
}


// ── Reusable text preview field ───────────────────────────────────────────────

interface PFProps {
  icon: React.ReactNode; label: string
  value: string | null; isActive: boolean
  isEditing: boolean; editValue: string
  onEdit: () => void; onEditChange: (v: string) => void
  onSave: () => void; onCancel: () => void
  placeholder: string; multiline?: boolean
}
function PreviewField({ icon, label, value, isActive, isEditing, editValue,
  onEdit, onEditChange, onSave, onCancel, placeholder, multiline }: PFProps) {
  return (
    <div className={`rounded-xl border p-3 transition-all
      ${isActive
        ? 'border-primary-500 bg-primary-600/10 shadow-[0_0_10px_rgba(37,99,235,0.2)]'
        : 'border-slate-700 bg-slate-800/50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={isActive ? 'text-primary-400' : 'text-slate-500'}>{icon}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          {isActive && <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />}
        </div>
        {value && !isEditing && (
          <button onClick={onEdit}
            className="text-[10px] text-slate-500 hover:text-primary-400 font-body flex items-center gap-0.5">
            <Edit3 size={9} /> Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-1.5">
          {multiline
            ? <textarea value={editValue} onChange={e => onEditChange(e.target.value)} rows={2} autoFocus
                className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg
                           px-2 py-1.5 text-xs font-body resize-none outline-none" />
            : <input type="text" value={editValue} onChange={e => onEditChange(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
                className="w-full bg-slate-700 border border-primary-500/50 text-white rounded-lg
                           px-2 py-1.5 text-xs font-body outline-none" />
          }
          <div className="flex gap-1.5">
            <button onClick={onSave}
              className="flex-1 py-1 bg-primary-600 text-white text-[10px] rounded-lg font-semibold font-body">Save</button>
            <button onClick={onCancel}
              className="flex-1 py-1 bg-slate-700 text-slate-300 text-[10px] rounded-lg font-body">Cancel</button>
          </div>
        </div>
      ) : value ? (
        <p className={`text-xs font-body leading-snug ${isActive ? 'text-primary-200' : 'text-slate-200'}`}>
          {value.length > 100 ? value.slice(0, 100) + '…' : value}
        </p>
      ) : (
        <p className="text-xs text-slate-600 italic font-body">
          {isActive ? '⌨️ Answering now...' : placeholder}
        </p>
      )}
    </div>
  )
}