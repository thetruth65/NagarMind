/**
 * useTranslation — Smart translation hook using Sarvam AI via backend proxy.
 *
 * HOW IT WORKS:
 * 1. Component calls `t('some_key', 'English text')` to register strings
 * 2. Hook batches ALL strings within 80ms into a single API call
 * 3. Returns translated strings, re-renders component
 * 4. Results cached in memory — no duplicate API calls
 * 5. When language changes → clears cache → retranslates everything
 *
 * USAGE:
 *   const { t, isTranslating } = useTranslation()
 *   <h1>{t('page_title', 'Citizen Login')}</h1>
 *   <button>{t('send_otp', 'Send OTP')}</button>
 *
 * On language switch to Hindi, it will show:
 *   <h1>नागरिक लॉगिन</h1>
 *   <button>OTP भेजें</button>
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { translateAPI } from '@/lib/api'

// Sarvam BCP-47 codes
const LANG_TO_SARVAM: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  or: 'od-IN',
}

// ─── Global translation cache (shared across components) ──────────────────────
// Key: `langCode||englishText`  Value: translated string
const GLOBAL_CACHE = new Map<string, string>()

// ─── Pending batch queue ───────────────────────────────────────────────────────
interface PendingItem {
  cacheKey: string
  source: string
  sarvamLang: string
  resolve: (text: string) => void
}

let pendingItems: PendingItem[] = []
let batchTimer: ReturnType<typeof setTimeout> | null = null

async function flushBatch() {
  if (pendingItems.length === 0) return
  const batch = [...pendingItems]
  pendingItems = []
  batchTimer = null

  // Group by target language
  const byLang = new Map<string, PendingItem[]>()
  for (const item of batch) {
    if (!byLang.has(item.sarvamLang)) byLang.set(item.sarvamLang, [])
    byLang.get(item.sarvamLang)!.push(item)
  }

  // Translate each language group with one API call
  const promises = Array.from(byLang.entries()).map(async ([sarvamLang, items]) => {
    if (sarvamLang === 'en-IN') {
      // No translation needed
      items.forEach(item => {
        GLOBAL_CACHE.set(item.cacheKey, item.source)
        item.resolve(item.source)
      })
      return
    }

    try {
      const texts = items.map(i => i.source)
      const res = await translateAPI.batch(texts, sarvamLang, 'en-IN')
      const translations: string[] = res.data?.translations || texts

      items.forEach((item, idx) => {
        const translated = translations[idx] || item.source
        GLOBAL_CACHE.set(item.cacheKey, translated)
        item.resolve(translated)
      })
    } catch (err) {
      console.warn('[useTranslation] Sarvam API error, using English fallback:', err)
      items.forEach(item => {
        GLOBAL_CACHE.set(item.cacheKey, item.source)
        item.resolve(item.source)
      })
    }
  })

  await Promise.allSettled(promises)
}

function queueForTranslation(cacheKey: string, source: string, sarvamLang: string): Promise<string> {
  return new Promise(resolve => {
    pendingItems.push({ cacheKey, source, sarvamLang, resolve })
    // Debounce: collect all strings within 80ms, then send as one batch
    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = setTimeout(flushBatch, 80)
  })
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export function useTranslation() {
  const { preferredLanguage } = useAuthStore()
  const lang = preferredLanguage || 'en'
  const sarvamLang = LANG_TO_SARVAM[lang] || 'en-IN'

  // Local state: cacheKey → translated string
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [isTranslating, setIsTranslating] = useState(false)

  // Track which keys are currently being fetched
  const inFlight = useRef(new Set<string>())

  // Clear all when language changes
  useEffect(() => {
    setTranslations({})
    inFlight.current.clear()
    setIsTranslating(false)
  }, [lang])

  /**
   * t(key, source) — returns translated string (or source while loading)
   *
   * @param key     Unique identifier for this string (used as cache key)
   * @param source  English source text
   */
  const t = useCallback(
    (key: string, source: string): string => {
      if (!source) return source

      // English — return as-is immediately
      if (lang === 'en') return source

      const cacheKey = `${lang}||${key}||${source}`

      // Already translated
      const cached = GLOBAL_CACHE.get(cacheKey)
      if (cached) {
        // Sync with local state if not there yet
        if (!translations[cacheKey]) {
          setTranslations(prev => ({ ...prev, [cacheKey]: cached }))
        }
        return cached
      }

      // Currently in-flight
      if (inFlight.current.has(cacheKey)) {
        return translations[cacheKey] || source
      }

      // Queue for translation
      inFlight.current.add(cacheKey)
      setIsTranslating(true)

      queueForTranslation(cacheKey, source, sarvamLang).then(translated => {
        inFlight.current.delete(cacheKey)
        setTranslations(prev => ({ ...prev, [cacheKey]: translated }))
        if (inFlight.current.size === 0) {
          setIsTranslating(false)
        }
      })

      // Return English while translation loads (graceful degradation)
      return translations[cacheKey] || source
    },
    [lang, sarvamLang, translations],
  )

  return { t, isTranslating, lang }
}