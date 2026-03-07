import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Mic, MicOff, Camera, MapPin, Upload,
  CheckCircle, Loader2, Globe, Volume2, X, Image
} from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { complaintsAPI, uploadAPI, translateAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { CATEGORY_CONFIG, SUPPORTED_LANGUAGES } from '@/types'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

type Step = 1 | 2 | 3 | 4

const STEPS =['Category', 'Details', 'Location & Media', 'Review']

const NAV_ITEMS =[
  { to: '/citizen/dashboard',   label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',      label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints',  label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',      label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',     label: 'Profile',   icon: <span>👤</span> },
]

export function SubmitComplaintPage() {
  const navigate = useNavigate()
  const { preferredLanguage } = useAuthStore()

  const [step, setStep]       = useState<Step>(1)
  const[lang, setLang]       = useState(preferredLanguage || 'en')
  const [category, setCategory] = useState('')
  const [title, setTitle]     = useState('')
  const [desc, setDesc]       = useState('')
  const [photos, setPhotos]   = useState<string[]>([])
  const[lat, setLat]         = useState<number>(28.6139)
  const[lng, setLng]         = useState<number>(77.2090)
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Voice recording
  const[isRecording, setIsRecording]   = useState(false)
  const [transcript, setTranscript]     = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Map
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const[gettingLocation, setGettingLocation] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 3 && mapContainerRef.current && !mapRef.current) {
      setTimeout(() => {
        if (!mapContainerRef.current) return
        const map = L.map(mapContainerRef.current).setView([lat, lng], 15)
        
        // ✅ PREMIUM DARK MAP THEME
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map)

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
        marker.on('dragend', async () => {
          const p = marker.getLatLng()
          setLat(p.lat); setLng(p.lng)
          const addr = await reverseGeocode(p.lat, p.lng)
          setAddress(addr)
        })
        mapRef.current = map; markerRef.current = marker
      }, 100)
    }
  }, [step])

  const reverseGeocode = async (la: number, lo: number) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json`)
      const d = await r.json()
      return d.display_name?.split(',').slice(0, 3).join(',') || `${la.toFixed(4)}, ${lo.toFixed(4)}`
    } catch { return `${la.toFixed(4)}, ${lo.toFixed(4)}` }
  }

  const getLocation = () => {
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords
      setLat(latitude); setLng(longitude)
      const addr = await reverseGeocode(latitude, longitude)
      setAddress(addr)
      if (mapRef.current && markerRef.current) {
        mapRef.current.setView([latitude, longitude], 16)
        markerRef.current.setLatLng([latitude, longitude])
      }
      toast.success('Location captured!')
      setGettingLocation(false)
    }, () => { toast.error('Could not get location'); setGettingLocation(false) }, { timeout: 10000 })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current =[]
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const { data: ps } = await uploadAPI.presign('voice.webm', 'audio/webm', 'complaints')
          if (ps.upload_url) await fetch(ps.upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'audio/webm' } })
          const audioUrl = ps.public_url
          const { data } = await complaintsAPI.transcribeUrl(audioUrl, lang !== 'en' ? lang : undefined)
          let text = data.transcript || ''
          if (lang !== 'en' && text) {
            const sarvamLang = SUPPORTED_LANGUAGES.find(l => l.code === lang)?.sarvam || 'hi-IN'
            setDesc(text)
            try {
              const tr = await translateAPI.single(text, 'en-IN', sarvamLang)
              setTitle(tr.data.translated?.slice(0, 80) || text.slice(0, 80))
            } catch {}
          } else {
            setDesc(text)
            if (!title) setTitle(text.slice(0, 80))
          }
          setTranscript(text)
          toast.success('Voice transcribed!')
        } catch (e) {
          toast.error('Transcription failed')
        } finally { setTranscribing(false) }
      }
      mr.start(); mediaRef.current = mr; setIsRecording(true)
    } catch { toast.error('Microphone access denied') }
  }

  const stopRecording = () => {
    mediaRef.current?.stop(); setIsRecording(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ||[]).slice(0, 5 - photos.length)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      try {
        const { data: ps } = await uploadAPI.presign(file.name, file.type, 'complaints')
        if (ps.upload_url) {
          await fetch(ps.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          setPhotos(p =>[...p, ps.public_url])
        } else {
          setPhotos(p =>[...p, URL.createObjectURL(file)])
        }
      } catch {}
    }
    setUploading(false)
  }

  const submit = async () => {
    if (!title.trim()) { toast.error('Add a title'); return }
    if (!desc.trim())  { toast.error('Add a description'); return }
    if (!address)      { toast.error('Add location'); return }
    setSubmitting(true)
    try {
      const { data } = await complaintsAPI.submit({
        title: title.trim(),
        description: desc.trim(),
        category: category || undefined,
        original_language: lang,
        location_address: address,
        location_lat: lat,
        location_lng: lng,
        photos,
      })
      toast.success('Complaint submitted! AI is classifying it.')
      navigate(`/citizen/track/${data.complaint_id}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  const canNext = () => {
    if (step === 1) return true
    if (step === 2) return title.trim().length >= 5 && desc.trim().length >= 10
    if (step === 3) return !!address
    return true
  }

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display font-bold text-xl text-white">Report an Issue</h1>
            <span className="text-sm text-primary-400 font-body font-semibold">Step {step} of 4</span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-300
                ${i < step ? 'bg-primary-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : i === step - 1 ? 'bg-primary-500/50' : 'bg-slate-800'}`} />
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
          {/* ── Step 1: Category ── */}
          {step === 1 && (
            <motion.div key="s1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">What type of issue?</h2>
                <p className="text-sm text-slate-400 font-body">Select the category that best matches the problem.</p>
              </div>

              {/* Language */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <label className="text-sm font-semibold text-slate-300 font-body flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-primary-400" /> Complaint Language
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {SUPPORTED_LANGUAGES.slice(0, 8).map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)}
                      className={`py-2.5 px-2 rounded-xl text-sm font-body font-medium border-2 transition-all
                        ${lang === l.code
                          ? 'border-primary-500 bg-primary-600/20 text-primary-400'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
                      {l.nativeName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <motion.button key={key} whileTap={{ scale: 0.97 }}
                    onClick={() => setCategory(key)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all
                      ${category === key
                        ? 'border-primary-500 bg-primary-600/10'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>
                    <div className="text-3xl mb-3 opacity-90">{cfg.icon}</div>
                    <p className={`text-sm font-semibold font-body
                      ${category === key ? 'text-primary-400' : 'text-slate-300'}`}>
                      {cfg.label}
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Details ── */}
          {step === 2 && (
            <motion.div key="s2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">Describe the Issue</h2>
                <p className="text-sm text-slate-400 font-body">Provide clear details. You can use voice typing.</p>
              </div>

              {/* Voice input */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-200 font-body flex items-center gap-2">
                    <Mic size={16} className="text-primary-400" /> Smart Voice Input
                  </p>
                  <span className="text-xs text-primary-300 font-body font-semibold px-2 py-1 bg-primary-900/30 border border-primary-500/30 rounded-lg">
                    {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.nativeName || 'English'}
                  </span>
                </div>

                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={transcribing}
                  className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold
                    font-body transition-all text-sm border-2
                    ${isRecording
                      ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                      : 'bg-slate-800 border-slate-700 text-primary-400 hover:border-primary-500/50'}`}>
                  {transcribing ? <Loader2 size={16} className="animate-spin text-primary-400" /> :
                   isRecording ? <><MicOff size={18} /> Stop Recording</> :
                                 <><Mic size={18} /> Tap to Speak</>}
                </motion.button>

                {transcript && (
                  <div className="bg-primary-900/20 border border-primary-800/50 rounded-xl p-4">
                    <p className="text-xs text-primary-400 font-semibold mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                      <Volume2 size={14} /> Auto-Transcribed
                    </p>
                    <p className="text-sm text-primary-200 font-body leading-relaxed">{transcript}</p>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-semibold text-slate-300 font-body block mb-2">Issue Title (English)</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Deep pothole near sector 4 market"
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 transition-colors" maxLength={200} />
                <p className="text-xs text-slate-500 mt-1.5 font-body">{title.length}/200 characters</p>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-slate-300 font-body block mb-2">
                  Detailed Description
                  {lang !== 'en' && <span className="ml-2 text-xs text-primary-400 font-normal">
                    ({SUPPORTED_LANGUAGES.find(l => l.code === lang)?.nativeName})
                  </span>}
                </label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5}
                  placeholder={lang === 'hi' ? 'यहाँ समस्या का विवरण दें...' : 'Describe the exact location and extent of the issue...'}
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 transition-colors resize-none" maxLength={2000} />
                <p className="text-xs text-slate-500 mt-1.5 font-body">{desc.length}/2000 characters</p>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Location & Media ── */}
          {step === 3 && (
            <motion.div key="s3"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">Location & Evidence</h2>
                <p className="text-sm text-slate-400 font-body">Pin the exact spot and attach photos.</p>
              </div>

              {/* GPS button */}
              <motion.button whileTap={{ scale: 0.95 }} onClick={getLocation} disabled={gettingLocation}
                className="w-full py-4 bg-slate-800 border border-slate-700 hover:border-primary-500 hover:text-primary-400 disabled:opacity-50 text-slate-300 font-semibold rounded-2xl flex items-center justify-center gap-2 font-body transition-colors">
                {gettingLocation ? <Loader2 size={18} className="animate-spin text-primary-400" /> : <MapPin size={18} />}
                {gettingLocation ? 'Detecting Location...' : 'Auto-detect My Location'}
              </motion.button>

              {/* Map */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-lg">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full border border-slate-700 text-xs font-bold text-white shadow-xl pointer-events-none flex items-center gap-2">
                  👆 Drag the marker to the exact spot
                </div>
                <div ref={mapContainerRef} className="w-full h-64 bg-slate-800" />
              </div>

              {/* Address */}
              <div>
                <label className="text-sm font-semibold text-slate-300 font-body flex items-center gap-2 mb-2">
                  <MapPin size={14} /> Full Address
                </label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
                  placeholder="House number, landmark, street name..."
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 transition-colors resize-none" />
              </div>

              {/* Photos */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <label className="text-sm font-semibold text-slate-300 font-body flex items-center gap-2 mb-3">
                  <Camera size={16} className="text-primary-400" /> Upload Photos ({photos.length}/5)
                </label>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                
                <button onClick={() => fileRef.current?.click()} disabled={photos.length >= 5 || uploading}
                  className="w-full py-6 border-2 border-dashed border-slate-700 bg-slate-800/50 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-primary-500 hover:text-primary-400 transition-colors disabled:opacity-50 font-body">
                  {uploading ? <Loader2 size={24} className="animate-spin text-primary-400" /> : <Image size={24} />}
                  <span className="text-sm font-medium">{uploading ? 'Uploading securely...' : 'Tap to select photos'}</span>
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

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <motion.div key="s4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6">
              <div>
                <h2 className="font-display font-semibold text-xl text-white mb-1">Final Review</h2>
                <p className="text-sm text-slate-400 font-body">Confirm details before AI classification begins.</p>
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
                  <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-1.5">Title</p>
                  <p className="font-semibold text-white font-body">{title}</p>
                </div>
                
                <div className="border-b border-slate-800 pb-4">
                  <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-1.5">Description</p>
                  <p className="text-sm text-slate-300 font-body leading-relaxed">{desc}</p>
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
                      Attached Evidence ({photos.length})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {photos.map((url, i) => (
                        <img key={i} src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-700" />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-slate-500 font-body uppercase tracking-wider mb-1.5">Original Language</p>
                  <span className="inline-block px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold">
                    {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.nativeName || 'English'}
                  </span>
                </div>
              </div>

              <div className="bg-primary-900/20 border border-primary-500/30 rounded-2xl p-5">
                <p className="text-sm text-primary-300 font-body leading-relaxed flex items-start gap-3">
                  <span className="text-xl">🤖</span>
                  <span>Once submitted, our AI will instantly classify the urgency and auto-assign this to the exact responsible officer. You will receive real-time SMS updates.</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigation Buttons ── */}
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
            <motion.button whileTap={{ scale: 0.97 }} onClick={submit}
              disabled={submitting}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-2xl font-body flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(22,163,74,0.4)] disabled:shadow-none">
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Submitting to MCD...</> :
                            <><CheckCircle size={18} /> Confirm & Submit</>}
            </motion.button>
          )}
        </div>
      </div>
    </AppShell>
  )
}