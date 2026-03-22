/**
 * SearchableSelect.tsx — Portal-based dropdown
 *
 * Same portal fix: the dropdown list is mounted into document.body via
 * createPortal so it can never be clipped by a parent overflow:hidden
 * (e.g., the AppShell scroll container) or buried by Framer Motion transforms.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, ChevronDown, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string
  badge?: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  emptyMessage?: string
}

interface DropdownPos { top: number; left: number; width: number; openUp: boolean }

export function SearchableSelect({
  options, value, onChange, placeholder = 'Select…',
  label, disabled = false, className = '', emptyMessage = 'No results',
}: SearchableSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [pos, setPos]       = useState<DropdownPos>({ top: 0, left: 0, width: 240, openUp: false })
  const searchRef           = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : options

  // ── Compute dropdown position ─────────────────────────────────────────────
  const computePos = useCallback(() => {
    if (!triggerRef.current) return
    const r   = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    const maxH       = 280
    const openUp     = spaceBelow < maxH && spaceAbove > spaceBelow
    setPos({
      top:   openUp ? r.top - maxH - 4 : r.bottom + 4,
      left:  r.left,
      width: r.width,
      openUp,
    })
  }, [])

  const handleOpen = () => {
    if (disabled) return
    computePos()
    setOpen(v => !v)
    setQuery('')
  }

  // ── Focus search on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30)
  }, [open])

  // ── Reposition on scroll / resize ────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', computePos, true)
    window.addEventListener('resize', computePos)
    return () => {
      window.removeEventListener('scroll', computePos, true)
      window.removeEventListener('resize', computePos)
    }
  }, [open, computePos])

  // ── Close on outside click / Escape ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-searchable-dropdown]') && !t.closest('[data-searchable-btn]')) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', esc) }
  }, [open])

  const select = (opt: SelectOption) => { onChange(opt.value); setOpen(false); setQuery('') }
  const clear  = (e: React.MouseEvent) => { e.stopPropagation(); onChange('') }

  // ── Portal dropdown ───────────────────────────────────────────────────────
  const dropdown = open ? createPortal(
    <>
      <div onClick={() => setOpen(false)}
        style={{ position:'fixed', inset:0, zIndex:9997 }} aria-hidden />

      <div data-searchable-dropdown style={{
        position: 'fixed',
        top:   pos.top,
        left:  pos.left,
        width: pos.width,
        zIndex: 9998,
        borderRadius: '0.75rem',
        border: '1px solid rgb(51 65 85)',
        background: 'rgb(15 23 42)',
        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.8)',
        overflow: 'hidden',
        maxHeight: 280,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Search */}
        <div style={{ padding:'0.5rem', borderBottom:'1px solid rgb(30 41 59)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem',
            background:'rgb(30 41 59)', borderRadius:'0.5rem', padding:'0.4rem 0.6rem' }}>
            <Search size={13} style={{ color:'rgb(100 116 139)', flexShrink:0 }} />
            <input ref={searchRef} type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              style={{
                flex:1, border:'none', background:'transparent', outline:'none',
                color:'white', fontSize:'0.82rem', fontFamily:'inherit',
              }} />
          </div>
        </div>

        {/* Options */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {filtered.length === 0
            ? <div style={{ padding:'1rem', textAlign:'center', color:'rgb(100 116 139)', fontSize:'0.82rem' }}>{emptyMessage}</div>
            : filtered.map(opt => (
              <div key={opt.value} onClick={() => select(opt)}
                style={{
                  padding:'0.6rem 0.875rem',
                  background: opt.value === value ? 'rgba(37,99,235,0.15)' : 'transparent',
                  cursor:'pointer', display:'flex', alignItems:'center',
                  gap:'0.5rem', borderBottom:'1px solid rgba(30,41,59,0.5)',
                }}
                onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = opt.value === value ? 'rgba(37,99,235,0.15)' : 'transparent' }}
              >
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color: opt.value === value ? 'rgb(96 165 250)' : 'rgb(226 232 240)',
                    fontSize:'0.82rem', fontWeight: opt.value === value ? 600 : 400,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {opt.label}
                  </p>
                  {opt.sublabel && <p style={{ color:'rgb(100 116 139)', fontSize:'0.72rem',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {opt.sublabel}
                  </p>}
                </div>
                {opt.badge && <span style={{
                  padding:'1px 6px', borderRadius:'999px',
                  background:'rgba(37,99,235,0.2)', color:'rgb(96 165 250)',
                  fontSize:'0.68rem', fontWeight:600, flexShrink:0,
                }}>{opt.badge}</span>}
                {opt.value === value && <span style={{ color:'rgb(37 99 235)', flexShrink:0 }}>✓</span>}
              </div>
            ))
          }
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <div className={className} style={{ position:'relative' }}>
      {label && <label style={{ display:'block', color:'rgb(148 163 184)', fontSize:'0.8rem',
        fontWeight:500, marginBottom:'0.375rem' }}>{label}</label>}

      <button ref={triggerRef} data-searchable-btn type="button"
        onClick={handleOpen} disabled={disabled}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:'0.5rem',
          padding:'0.6rem 0.875rem', borderRadius:'0.75rem',
          border:`1px solid ${open ? 'rgb(59 130 246)' : 'rgb(51 65 85)'}`,
          background: disabled ? 'rgb(15 23 42)' : open ? 'rgb(17 24 39)' : 'rgb(15 23 42)',
          color: selected ? 'white' : 'rgb(100 116 139)',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
          textAlign:'left', transition:'border-color 0.15s',
        }}>
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          fontSize:'0.875rem' }}>
          {selected ? selected.label : placeholder}
        </span>
        {value && !disabled && (
          <span onClick={clear} style={{ display:'flex', alignItems:'center', color:'rgb(100 116 139)',
            borderRadius:'50%', padding:2, cursor:'pointer', flexShrink:0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgb(239 68 68)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgb(100 116 139)')}>
            <X size={13} />
          </span>
        )}
        <ChevronDown size={14} style={{ color:'rgb(100 116 139)', flexShrink:0,
          transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
      </button>

      {dropdown}
    </div>
  )
}

// ─── WardSelect convenience wrapper ──────────────────────────────────────────
interface WardSelectProps {
  wards: { ward_number: number; ward_name: string; zone?: string }[]
  value?: string
  onChange: (val: string) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function WardSelect({ wards, value, onChange, label = 'Ward', disabled, className }: WardSelectProps) {
  const options: SelectOption[] = wards.map(w => ({
    value:    w.ward_number.toString(),
    label:    `Ward ${w.ward_number} — ${w.ward_name}`,
    sublabel: w.zone ? `Zone: ${w.zone}` : undefined,
    badge:    w.ward_number.toString(),
  }))
  return (
    <SearchableSelect
      options={options} value={value} onChange={onChange}
      placeholder="Select ward…" label={label}
      disabled={disabled} className={className}
      emptyMessage="No wards found"
    />
  )
}