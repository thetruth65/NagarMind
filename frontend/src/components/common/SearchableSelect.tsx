/**
 * SearchableSelect + WardSelect
 * Smart dropdown with substring-match search.
 * Matches any part of the label string — not just prefix.
 * Used in CitizenAuthPage, OfficerAuthPage, SubmitComplaintPage.
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface Option {
  value: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary-100 text-primary-800 rounded">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function SearchableSelect({
  options, value, onChange, placeholder = 'Search...', label, disabled, className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel || '').toLowerCase().includes(query.toLowerCase())
      )
    : options

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  return (
    <div className={`space-y-1.5 ${className || ''}`} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-gray-700 block">{label}</label>
      )}
      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-2 px-4 py-3.5 border-2 rounded-2xl bg-white text-left transition-all
                      ${open ? 'border-primary-400' : 'border-gray-200 hover:border-gray-300'}
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {selected ? (
            <div className="flex-1 min-w-0">
              <span className="text-gray-800 text-sm font-medium truncate block">{selected.label}</span>
              {selected.sublabel && (
                <span className="text-gray-400 text-xs">{selected.sublabel}</span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 text-sm flex-1">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onChange(''); setQuery('') }}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={12} />
              </button>
            )}
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-gray-50">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Type to filter..."
                  className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">No matches found</div>
              ) : (
                filtered.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors
                                ${opt.value === value ? 'bg-primary-50' : ''}`}
                  >
                    <div className="text-sm text-gray-800 font-medium">
                      <Highlight text={opt.label} query={query} />
                    </div>
                    {opt.sublabel && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        <Highlight text={opt.sublabel} query={query} />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Count */}
            {query && (
              <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
                {filtered.length} of {options.length} shown
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ward-specific convenience wrapper ─────────────────────────────────────────
interface Ward {
  ward_id: number
  ward_name: string
  zone?: string
}

interface WardSelectProps {
  wards: Ward[]
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
}

export function WardSelect({ wards, value, onChange, label = 'Ward', placeholder = 'Search ward...', disabled }: WardSelectProps) {
  const options: Option[] = wards.map(w => ({
    value: String(w.ward_id),
    label: w.ward_name,
    sublabel: w.zone ? `${w.zone} Zone · Ward ${w.ward_id}` : `Ward ${w.ward_id}`,
  }))

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      label={label}
      disabled={disabled}
    />
  )
}

export default SearchableSelect