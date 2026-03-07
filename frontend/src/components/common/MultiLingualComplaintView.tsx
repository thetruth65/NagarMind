/**
 * MultilingualComplaintView
 *
 * Displays complaint text and status updates in the user's chosen language.
 * This is the ONLY place multilingual translation is used — the app UI
 * remains in English, but complaint content and action notes translate on demand.
 *
 * Supports 15+ Indian languages via Sarvam AI.
 * Usage:
 *   <MultilingualComplaintView complaint={c} />
 *   <MultilingualStatusTimeline historyItems={items} />
 */

import { useState, useEffect, useCallback } from 'react'
import { translateAPI } from '@/lib/api'
import { Globe, Loader2, ChevronDown } from 'lucide-react'

// All supported languages with Sarvam BCP-47 codes
export const MULTILINGUAL_LANGUAGES = [
  { code: 'en',   sarvam: 'en-IN', name: 'English',    native: 'English' },
  { code: 'hi',   sarvam: 'hi-IN', name: 'Hindi',      native: 'हिंदी' },
  { code: 'bn',   sarvam: 'bn-IN', name: 'Bengali',    native: 'বাংলা' },
  { code: 'ta',   sarvam: 'ta-IN', name: 'Tamil',      native: 'தமிழ்' },
  { code: 'te',   sarvam: 'te-IN', name: 'Telugu',     native: 'తెలుగు' },
  { code: 'mr',   sarvam: 'mr-IN', name: 'Marathi',    native: 'मराठी' },
  { code: 'gu',   sarvam: 'gu-IN', name: 'Gujarati',   native: 'ગુજરાતી' },
  { code: 'kn',   sarvam: 'kn-IN', name: 'Kannada',    native: 'ಕನ್ನಡ' },
  { code: 'ml',   sarvam: 'ml-IN', name: 'Malayalam',  native: 'മലയാളം' },
  { code: 'pa',   sarvam: 'pa-IN', name: 'Punjabi',    native: 'ਪੰਜਾਬੀ' },
  { code: 'or',   sarvam: 'od-IN', name: 'Odia',       native: 'ଓଡ଼ିଆ' },
  { code: 'ur',   sarvam: 'ur-IN', name: 'Urdu',       native: 'اردو' },
  { code: 'as',   sarvam: 'as-IN', name: 'Assamese',   native: 'অসমীয়া' },
  { code: 'sa',   sarvam: 'sa-IN', name: 'Sanskrit',   native: 'संस्कृत' },
  { code: 'kok',  sarvam: 'kok-IN',name: 'Konkani',    native: 'कोंकणी' },
]

// Translation cache: `langCode||text` → translated text
const TRANSLATION_CACHE = new Map<string, string>()

async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  if (targetLang === 'en') return texts

  const sarvamLang = MULTILINGUAL_LANGUAGES.find(l => l.code === targetLang)?.sarvam || 'hi-IN'
  const cacheKeys = texts.map(t => `${targetLang}||${t}`)
  const uncachedIdx: number[] = []
  const uncachedTexts: string[] = []

  texts.forEach((t, i) => {
    if (!TRANSLATION_CACHE.has(cacheKeys[i])) {
      uncachedIdx.push(i)
      uncachedTexts.push(t)
    }
  })

  if (uncachedTexts.length > 0) {
    try {
      const res = await translateAPI.batch(uncachedTexts, sarvamLang, 'en-IN')
      const translations: string[] = res.data?.translations || uncachedTexts
      uncachedIdx.forEach((origIdx, i) => {
        TRANSLATION_CACHE.set(cacheKeys[origIdx], translations[i] || texts[origIdx])
      })
    } catch {
      // Fallback: cache original text
      uncachedIdx.forEach(origIdx => {
        TRANSLATION_CACHE.set(cacheKeys[origIdx], texts[origIdx])
      })
    }
  }

  return texts.map((_, i) => TRANSLATION_CACHE.get(cacheKeys[i]) || texts[i])
}

// ─── Language Picker (compact dropdown) ───────────────────────────────────────
function LanguagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = MULTILINGUAL_LANGUAGES.find(l => l.code === value) || MULTILINGUAL_LANGUAGES[0]

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-200
                   text-primary-700 rounded-xl text-sm font-body hover:bg-primary-100 transition-colors">
        <Globe size={13} />
        <span className="font-medium">{current.native}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-2xl shadow-2xl
                          border border-gray-100 overflow-hidden max-h-64 overflow-y-auto">
            {MULTILINGUAL_LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => { onChange(lang.code); setOpen(false) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-primary-50
                            transition-colors text-left
                            ${lang.code === value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-700'}`}>
                <span>{lang.native}</span>
                <span className="text-gray-400 text-xs">{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Translated Text Block ────────────────────────────────────────────────────
function TranslatedText({ text, lang, className = '' }: { text: string; lang: string; className?: string }) {
  const [translated, setTranslated] = useState(text)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lang === 'en' || !text) { setTranslated(text); return }
    const cacheKey = `${lang}||${text}`
    const cached = TRANSLATION_CACHE.get(cacheKey)
    if (cached) { setTranslated(cached); return }
    setLoading(true)
    translateBatch([text], lang)
      .then(([t]) => setTranslated(t))
      .finally(() => setLoading(false))
  }, [text, lang])

  return (
    <span className={`relative ${className}`}>
      {translated}
      {loading && <Loader2 size={12} className="inline ml-1 animate-spin text-primary-400" />}
    </span>
  )
}

// ─── Main Complaint View ──────────────────────────────────────────────────────
interface Complaint {
  complaint_id: string
  title: string
  description: string
  ai_summary?: string
  category?: string
  status: string
  urgency: string
  location_address?: string
  resolution_notes?: string
  created_at: string
}

interface Props {
  complaint: Complaint
  defaultLang?: string
  showLanguagePicker?: boolean
}

export function MultilingualComplaintView({ complaint, defaultLang = 'en', showLanguagePicker = true }: Props) {
  const [lang, setLang] = useState(defaultLang)
  const [translatedTitle, setTitle] = useState(complaint.title)
  const [translatedDesc, setDesc] = useState(complaint.description)
  const [translatedSummary, setSummary] = useState(complaint.ai_summary || '')
  const [translatedResolution, setResolution] = useState(complaint.resolution_notes || '')
  const [loading, setLoading] = useState(false)

  const translate = useCallback(async (targetLang: string) => {
    if (targetLang === 'en') {
      setTitle(complaint.title)
      setDesc(complaint.description)
      setSummary(complaint.ai_summary || '')
      setResolution(complaint.resolution_notes || '')
      return
    }
    setLoading(true)
    try {
      const texts = [
        complaint.title,
        complaint.description,
        complaint.ai_summary || '',
        complaint.resolution_notes || '',
      ].filter(Boolean)

      const results = await translateBatch(texts, targetLang)
      setTitle(results[0] || complaint.title)
      setDesc(results[1] || complaint.description)
      if (complaint.ai_summary) setSummary(results[2] || complaint.ai_summary)
      if (complaint.resolution_notes) setResolution(results[3] || complaint.resolution_notes)
    } finally { setLoading(false) }
  }, [complaint])

  useEffect(() => { translate(lang) }, [lang, translate])

  return (
    <div className="space-y-4">
      {showLanguagePicker && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 font-body">Complaint language</span>
          <LanguagePicker value={lang} onChange={setLang} />
        </div>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-400 font-body uppercase tracking-wider mb-1">Title</p>
          <h3 className="font-semibold text-gray-900 font-body leading-snug">
            {loading ? <span className="opacity-50">{complaint.title}</span> : translatedTitle}
            {loading && <Loader2 size={14} className="inline ml-2 animate-spin text-primary-400" />}
          </h3>
        </div>

        <div>
          <p className="text-xs text-gray-400 font-body uppercase tracking-wider mb-1">Description</p>
          <p className="text-sm text-gray-700 font-body leading-relaxed">
            {loading ? <span className="opacity-50">{complaint.description}</span> : translatedDesc}
          </p>
        </div>

        {(complaint.ai_summary) && (
          <div className="bg-blue-50 rounded-xl px-3 py-2.5">
            <p className="text-xs font-medium text-blue-600 mb-1">🤖 AI Summary</p>
            <p className="text-sm text-blue-800 font-body">
              {loading ? <span className="opacity-50">{complaint.ai_summary}</span> : translatedSummary}
            </p>
          </div>
        )}

        {complaint.resolution_notes && (
          <div className="bg-green-50 rounded-xl px-3 py-2.5">
            <p className="text-xs font-medium text-green-600 mb-1">✅ Resolution</p>
            <p className="text-sm text-green-800 font-body">
              {loading ? <span className="opacity-50">{complaint.resolution_notes}</span> : translatedResolution}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Status Timeline with translated notes ────────────────────────────────────
interface HistoryItem {
  to_status: string
  notes?: string
  created_at: string
  changed_by_role: string
}

export function MultilingualStatusTimeline({ items, defaultLang = 'en' }: { items: HistoryItem[]; defaultLang?: string }) {
  const [lang, setLang] = useState(defaultLang)

  const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    submitted:    { label: 'Submitted',    color: 'bg-gray-100 text-gray-600',   icon: '📝' },
    assigned:     { label: 'Assigned',     color: 'bg-blue-100 text-blue-700',   icon: '👷' },
    acknowledged: { label: 'Acknowledged', color: 'bg-purple-100 text-purple-700', icon: '👀' },
    in_progress:  { label: 'In Progress',  color: 'bg-amber-100 text-amber-700', icon: '🔧' },
    resolved:     { label: 'Resolved',     color: 'bg-green-100 text-green-700', icon: '✅' },
    closed:       { label: 'Closed',       color: 'bg-gray-100 text-gray-600',   icon: '🔒' },
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 font-body text-sm">Status Timeline</h3>
        <LanguagePicker value={lang} onChange={setLang} />
      </div>

      <div className="space-y-3">
        {items.map((item, i) => {
          const cfg = STATUS_CONFIG[item.to_status] || STATUS_CONFIG.submitted
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${cfg.color}`}>
                  {cfg.icon}
                </div>
                {i < items.length - 1 && <div className="w-0.5 h-full bg-gray-100 mt-1 min-h-[16px]" />}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-gray-400 font-body">
                    {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {item.notes && (
                  <TranslatedText text={item.notes} lang={lang}
                    className="text-xs text-gray-600 font-body leading-relaxed" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Voice complaint in user's language ───────────────────────────────────────
export { LanguagePicker, TranslatedText }