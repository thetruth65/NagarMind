/**
 * LanguageSelector.tsx — Portal-based dropdown
 * Fix: uses `setLanguage` (not `setPreferredLanguage`) from useAuthStore
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { SUPPORTED_LANGUAGES } from '@/types'

interface DropdownPos { top: number; right: number }

interface Props {
  onSelect?: (code: string) => void
  compact?: boolean
}

export function LanguageSelector({ onSelect, compact = false }: Props) {
  // ← use setLanguage (matches your authStore shape)
  const { preferredLanguage, setLanguage } = useAuthStore()
  const btnRef = useRef<HTMLButtonElement>(null)

  const [open, setOpen]   = useState(false)
  const [pos, setPos]     = useState<DropdownPos>({ top: 64, right: 16 })
  const [query, setQuery] = useState('')

  const current = SUPPORTED_LANGUAGES.find(l => l.code === preferredLanguage) ?? SUPPORTED_LANGUAGES[0]

  const filtered = query.trim()
    ? SUPPORTED_LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.nativeName.toLowerCase().includes(query.toLowerCase())
      )
    : SUPPORTED_LANGUAGES

  const computePos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
  }, [])

  const handleOpen = () => { computePos(); setOpen(v => !v); setQuery('') }

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', computePos, true)
    window.addEventListener('resize', computePos)
    return () => {
      window.removeEventListener('scroll', computePos, true)
      window.removeEventListener('resize', computePos)
    }
  }, [open, computePos])

  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-lang-dropdown]') && !t.closest('[data-lang-btn]')) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', esc) }
  }, [open])

  const select = (code: string) => {
    setLanguage(code)        // ← your actual authStore method
    onSelect?.(code)
    setOpen(false)
  }

  const dropdown = open ? createPortal(
    <>
      {/* Backdrop */}
      <div onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 9997 }} aria-hidden />

      {/* Panel */}
      <div data-lang-dropdown style={{
        position: 'fixed', top: pos.top, right: pos.right,
        width: 260, zIndex: 9998,
        borderRadius: '0.875rem', border: '1px solid rgb(51 65 85)',
        background: 'rgb(15 23 42)',
        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.8)',
        overflow: 'hidden', maxHeight: 340,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header + search */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgb(30 41 59)', flexShrink: 0 }}>
          <p style={{ color: 'rgb(148 163 184)', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Preferred Language
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgb(30 41 59)', borderRadius: '0.5rem', padding: '0.35rem 0.6rem' }}>
            <Globe size={13} style={{ color: 'rgb(100 116 139)' }} />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search language…"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                color: 'white', fontSize: '0.8rem', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(lang => (
            <div key={lang.code} onClick={() => select(lang.code)}
              style={{
                padding: '0.55rem 1rem',
                background: lang.code === preferredLanguage ? 'rgba(37,99,235,0.15)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.625rem',
                borderBottom: '1px solid rgba(30,41,59,0.5)',
              }}
              onMouseEnter={e => { if (lang.code !== preferredLanguage) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = lang.code === preferredLanguage ? 'rgba(37,99,235,0.15)' : 'transparent' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: lang.code === preferredLanguage ? 'rgb(96 165 250)' : 'rgb(226 232 240)',
                  fontSize: '0.82rem', fontWeight: lang.code === preferredLanguage ? 600 : 400 }}>
                  {lang.nativeName}
                </p>
                <p style={{ color: 'rgb(100 116 139)', fontSize: '0.7rem' }}>{lang.name}</p>
              </div>
              {lang.sttSupported && (
                <span title="Voice input supported" style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'rgb(34 197 94)', flexShrink: 0,
                }} />
              )}
              {lang.code === preferredLanguage && (
                <Check size={14} style={{ color: 'rgb(37 99 235)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
      <button ref={btnRef} data-lang-btn type="button" onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: compact ? '0.35rem 0.6rem' : '0.4rem 0.75rem',
          borderRadius: '0.625rem',
          border: `1px solid ${open ? 'rgb(59 130 246)' : 'rgb(51 65 85)'}`,
          background: 'transparent', color: 'rgb(148 163 184)',
          cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit',
          transition: 'border-color 0.15s',
        }}>
        <Globe size={14} />
        {!compact && <span style={{ fontWeight: 500 }}>{current.nativeName}</span>}
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {dropdown}
    </>
  )
}