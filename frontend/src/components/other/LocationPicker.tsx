/**
 * LocationPicker.tsx
 *
 * Vanilla Leaflet (no react-leaflet) + portal-based search dropdown.
 *
 * Fixes vs previous version:
 *  - Does NOT import react-leaflet (which wasn't installed)
 *  - Uses vanilla L.map() / L.marker() via refs (matches your original approach)
 *  - Smart address search dropdown portalled into document.body (never buried under map)
 *  - NO "drag pin or click map" overlay hint — removed as requested
 *  - Draggable red pin (matching original)
 *  - GPS button
 *  - Reverse geocode on map click / drag
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Search, Loader2, Navigation, X, RotateCcw } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import toast from 'react-hot-toast'

// ── Fix Leaflet default icon paths broken by Vite asset hashing ──────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ── Custom red pin ────────────────────────────────────────────────────────────
const RED_ICON = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:36px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4))">
    <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.016 23.041 15.077 24.006a1.333 1.333 0 001.846 0C17.984 39.041 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#EF4444"/>
      <circle cx="16" cy="15" r="6.5" fill="white" opacity="0.95"/>
      <circle cx="16" cy="15" r="3.5" fill="#EF4444"/>
    </svg>
  </div>`,
  iconSize:    [28, 36],
  iconAnchor:  [14, 36],
  popupAnchor: [0, -40],
})

const DEFAULT_LAT = 28.6139
const DEFAULT_LNG = 77.2090

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  place_id: number
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=17&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const a = data.address || {}
    const parts = [
      a.road || a.pedestrian || a.footway || a.path,
      a.neighbourhood || a.suburb || a.quarter || a.village,
      a.city || a.town || a.county,
      a.state,
    ].filter(Boolean)
    return parts.length > 0
      ? parts.join(', ')
      : (data.display_name?.split(',').slice(0, 4).join(', ') ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

async function forwardGeocode(query: string): Promise<NominatimResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Delhi India')}&format=json&addressdetails=1&limit=6&countrycodes=IN`,
      { headers: { 'Accept-Language': 'en' } }
    )
    return await res.json()
  } catch {
    return []
  }
}

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
  initialLat?: number | null
  initialLng?: number | null
  initialAddress?: string
}

interface SugPos { top: number; left: number; width: number }

export function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress = '',
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const markerRef    = useRef<L.Marker | null>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  const startLat = initialLat ?? DEFAULT_LAT
  const startLng = initialLng ?? DEFAULT_LNG

  const [address, setAddress]             = useState(initialAddress)
  const [geocoding, setGeocoding]         = useState(false)
  const [gpsLoading, setGpsLoading]       = useState(false)
  const [hasCustomLoc, setHasCustomLoc]   = useState(!!(initialLat && initialLng))
  const [coords, setCoords]               = useState({ lat: startLat, lng: startLng })

  // Search state
  const [searchQuery, setSearchQuery]     = useState('')
  const [results, setResults]             = useState<NominatimResult[]>([])
  const [searching, setSearching]         = useState(false)
  const [showSug, setShowSug]             = useState(false)
  const [sugPos, setSugPos]               = useState<SugPos>({ top: 0, left: 0, width: 300 })

  // ── Compute suggestion dropdown position ──────────────────────────────────
  const computeSugPos = useCallback(() => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setSugPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  // ── Move pin + reverse geocode ────────────────────────────────────────────
  const moveTo = useCallback(async (lat: number, lng: number, knownAddress?: string) => {
    setCoords({ lat, lng })
    setHasCustomLoc(true)
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
      mapRef.current.setView([lat, lng], 16, { animate: true })
    }
    if (knownAddress) {
      setAddress(knownAddress)
      onLocationSelect(lat, lng, knownAddress)
      return
    }
    setGeocoding(true)
    const addr = await reverseGeocode(lat, lng)
    setAddress(addr)
    setGeocoding(false)
    onLocationSelect(lat, lng, addr)
  }, [onLocationSelect])

  // ── Init Leaflet map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:          [startLat, startLng],
      zoom:            15,
      scrollWheelZoom: 'center',
      zoomControl:     true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([startLat, startLng], {
      draggable: true,
      icon:      RED_ICON,
      autoPan:   true,
    }).addTo(map)

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      moveTo(lat, lng)
    })

    map.on('click', (e: L.LeafletMouseEvent) => moveTo(e.latlng.lat, e.latlng.lng))

    mapRef.current    = map
    markerRef.current = marker

    // Leaflet needs invalidateSize after CSS transitions / animations settle
    const t1 = setTimeout(() => map.invalidateSize(), 100)
    const t2 = setTimeout(() => map.invalidateSize(), 500)

    // Seed initial address
    if (initialLat && initialLng && !initialAddress) {
      reverseGeocode(initialLat, initialLng).then(addr => {
        setAddress(addr)
        onLocationSelect(initialLat, initialLng, addr)
      })
    } else if (!initialLat) {
      reverseGeocode(DEFAULT_LAT, DEFAULT_LNG).then(addr => {
        setAddress(addr)
        onLocationSelect(DEFAULT_LAT, DEFAULT_LNG, addr)
      })
    }

    return () => {
      clearTimeout(t1); clearTimeout(t2)
      map.remove()
      mapRef.current    = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── GPS button ────────────────────────────────────────────────────────────
  const geolocate = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        await moveTo(latitude, longitude)
        if (mapRef.current) mapRef.current.setZoom(17)
        toast.success('📍 Location captured!')
        setGpsLoading(false)
      },
      () => { toast.error('Could not get GPS. Enable location access.'); setGpsLoading(false) },
      { timeout: 10_000, enableHighAccuracy: true }
    )
  }

  // ── Search handler (debounced) ────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 3) { setResults([]); setShowSug(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const res = await forwardGeocode(val)
      setResults(res)
      computeSugPos()
      setShowSug(res.length > 0)
      setSearching(false)
    }, 450)
  }

  const selectResult = async (r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const shortAddr = r.display_name.split(',').slice(0, 4).join(', ')
    setSearchQuery(shortAddr)
    setShowSug(false)
    setResults([])
    await moveTo(lat, lng, shortAddr)
    if (mapRef.current) mapRef.current.setZoom(16)
  }

  // ── Close suggestions on outside click ───────────────────────────────────
  useEffect(() => {
    if (!showSug) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-loc-suggestions]') && !t.closest('[data-loc-input]')) setShowSug(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSug])

  // ── Reposition suggestions on scroll/resize ───────────────────────────────
  useEffect(() => {
    if (!showSug) return
    window.addEventListener('scroll', computeSugPos, true)
    window.addEventListener('resize', computeSugPos)
    return () => {
      window.removeEventListener('scroll', computeSugPos, true)
      window.removeEventListener('resize', computeSugPos)
    }
  }, [showSug, computeSugPos])

  // ── Portal suggestions dropdown ───────────────────────────────────────────
  const sugDropdown = showSug ? createPortal(
    <div data-loc-suggestions style={{
      position: 'fixed',
      top:   sugPos.top,
      left:  sugPos.left,
      width: sugPos.width,
      zIndex: 9998,
      borderRadius: '0.875rem',
      border: '1px solid rgb(51 65 85)',
      background: 'rgb(15 23 42)',
      boxShadow: '0 20px 40px -8px rgba(0,0,0,0.85)',
      overflow: 'hidden',
      maxHeight: 260,
      overflowY: 'auto',
    }}>
      {results.map((r, i) => (
        <div key={r.place_id || i}
          onMouseDown={() => selectResult(r)}   // mousedown fires before blur
          style={{
            padding: '0.625rem 0.875rem',
            borderBottom: '1px solid rgb(30 41 59)',
            cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        >
          <MapPin size={14} style={{ color: 'rgb(239 68 68)', flexShrink: 0, marginTop: 2 }} />
          <span style={{ color: 'rgb(226 232 240)', fontSize: '0.82rem', lineHeight: 1.4 }}>
            {r.display_name.split(',').slice(0, 4).join(', ')}
          </span>
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <div className="space-y-3">
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl
                          px-3 py-2.5 focus-within:border-primary-500 transition-colors">
            {searching
              ? <Loader2 size={14} className="text-primary-400 animate-spin shrink-0" />
              : <Search size={14} className="text-slate-500 shrink-0" />
            }
            <input
              ref={inputRef}
              data-loc-input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => { if (results.length > 0) { computeSugPos(); setShowSug(true) } }}
              placeholder="Search address, colony, landmark…"
              className="flex-1 text-sm text-white placeholder:text-slate-500 outline-none bg-transparent font-body"
            />
            {searchQuery && (
              <button type="button"
                onClick={() => { setSearchQuery(''); setResults([]); setShowSug(false) }}
                className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* GPS */}
        <button type="button" onClick={geolocate} disabled={gpsLoading} title="Use my location"
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-700
                     bg-slate-800 text-slate-400 hover:border-primary-500 hover:text-primary-400
                     disabled:opacity-60 transition-colors shrink-0">
          {gpsLoading ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
        </button>

        {/* Reset */}
        {hasCustomLoc && (
          <button type="button" onClick={() => { moveTo(DEFAULT_LAT, DEFAULT_LNG); setHasCustomLoc(false) }}
            title="Reset to Delhi centre"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-700
                       bg-slate-800 text-slate-400 hover:border-red-500 hover:text-red-400
                       transition-colors shrink-0">
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Portal dropdown */}
      {sugDropdown}

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden border border-slate-700"
        style={{ height: 280 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
        {geocoding && (
          <div style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, background: 'rgba(15,23,42,0.9)',
            borderRadius: '999px', padding: '4px 12px',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            color: 'rgb(96 165 250)', fontSize: '0.75rem',
          }}>
            <Loader2 size={11} className="animate-spin" />
            Getting address…
          </div>
        )}
      </div>

      {/* ── Pinned address badge ─────────────────────────────────────────────── */}
      {address && (
        <div className="flex items-start gap-2 bg-primary-950/40 border border-primary-500/20
                        rounded-xl px-3 py-2.5">
          <MapPin size={14} className="text-primary-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-300 font-body leading-snug flex-1">{address}</p>
          {geocoding && <Loader2 size={12} className="text-primary-400 shrink-0 animate-spin mt-0.5" />}
        </div>
      )}

      {/* ── Manual override ──────────────────────────────────────────────────── */}
      <div>
        <label className="text-xs font-semibold text-slate-500 font-body block mb-1">
          Add more details <span className="font-normal">(optional)</span>
        </label>
        <textarea
          value={address}
          onChange={e => {
            setAddress(e.target.value)
            onLocationSelect(coords.lat, coords.lng, e.target.value)
          }}
          placeholder="e.g. Near red gate, opposite Sharma Medical, Lane 3…"
          rows={2}
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl
                     text-white text-sm font-body placeholder:text-slate-600
                     outline-none focus:border-primary-500 resize-none transition-colors"
        />
      </div>
    </div>
  )
}