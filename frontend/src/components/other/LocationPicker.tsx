// import { useState, useEffect, useRef } from 'react'
// import { motion } from 'framer-motion'
// import { MapPin, Loader2, Navigation, RotateCcw } from 'lucide-react'
// import L from 'leaflet'
// import 'leaflet/dist/leaflet.css'
// import toast from 'react-hot-toast'

// interface LocationPickerProps {
//   onLocationSelect: (lat: number, lng: number, address: string) => void
//   initialLat?: number | null
//   initialLng?: number | null
//   initialAddress?: string
// }

// // Fix Leaflet default marker icons (broken by webpack/vite asset hashing)
// delete (L.Icon.Default.prototype as any)._getIconUrl
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//   iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//   shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
// })

// const DEFAULT_LAT = 28.6139
// const DEFAULT_LNG = 77.2090

// export function LocationPicker({
//   onLocationSelect,
//   initialLat,
//   initialLng,
//   initialAddress = '',
// }: LocationPickerProps) {
//   const containerRef = useRef<HTMLDivElement>(null)
//   const mapRef       = useRef<L.Map | null>(null)
//   const markerRef    = useRef<L.Marker | null>(null)

//   const startLat = initialLat  ?? DEFAULT_LAT
//   const startLng = initialLng  ?? DEFAULT_LNG

//   const [loading,           setLoading]           = useState(false)
//   const [address,           setAddress]           = useState(initialAddress)
//   const [hasCustomLocation, setHasCustomLocation] = useState(!!(initialLat && initialLng))
//   const [coords,            setCoords]            = useState({ lat: startLat, lng: startLng })

//   // ── Initialise Leaflet map exactly once ────────────────────────────────────
//   useEffect(() => {
//     if (!containerRef.current || mapRef.current) return

//     const map = L.map(containerRef.current, {
//       center: [startLat, startLng],
//       zoom: 15,
//       // Prevents the map stealing scroll on mobile
//       scrollWheelZoom: false,
//     })

//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//       attribution: '© OpenStreetMap contributors',
//       maxZoom: 19,
//     }).addTo(map)

//     const marker = L.marker([startLat, startLng], { draggable: true })
//       .addTo(map)
//       .bindPopup('📍 Drag me to the exact location')
//       .openPopup()

//     marker.on('dragend', () => {
//       const { lat, lng } = marker.getLatLng()
//       handleLocationChange(lat, lng)
//     })

//     mapRef.current    = map
//     markerRef.current = marker

//     // ⚠️  KEY FIX: Leaflet needs the container to be fully painted before it
//     // can measure its dimensions. Without this, the map renders as a grey box.
//     setTimeout(() => map.invalidateSize(), 150)

//     return () => {
//       map.remove()
//       mapRef.current    = null
//       markerRef.current = null
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [])

//   // ── Reverse geocode ────────────────────────────────────────────────────────
//   const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
//     try {
//       const res  = await fetch(
//         `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
//       )
//       const data = await res.json()
//       return (
//         data.display_name?.split(',').slice(0, 3).join(', ') ??
//         `${lat.toFixed(5)}, ${lng.toFixed(5)}`
//       )
//     } catch {
//       return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
//     }
//   }

//   // ── Central location change handler ───────────────────────────────────────
//   const handleLocationChange = async (lat: number, lng: number) => {
//     setCoords({ lat, lng })
//     setHasCustomLocation(true)

//     // Move map + marker
//     if (mapRef.current && markerRef.current) {
//       mapRef.current.setView([lat, lng], 15, { animate: true })
//       markerRef.current.setLatLng([lat, lng])
//     }

//     const addr = await reverseGeocode(lat, lng)
//     setAddress(addr)
//     onLocationSelect(lat, lng, addr)
//   }

//   // ── Use device GPS ─────────────────────────────────────────────────────────
//   const useCurrentLocation = () => {
//     if (!navigator.geolocation) {
//       toast.error('Geolocation is not supported by your browser')
//       return
//     }
//     setLoading(true)
//     navigator.geolocation.getCurrentPosition(
//       async ({ coords: { latitude, longitude } }) => {
//         await handleLocationChange(latitude, longitude)
//         toast.success('Location captured from GPS!')
//         setLoading(false)
//       },
//       (err) => {
//         console.error('Geolocation error:', err)
//         toast.error('Could not access GPS. Please enable location permissions.')
//         setLoading(false)
//       },
//       { timeout: 10000, enableHighAccuracy: true }
//     )
//   }

//   // ── Reset to Delhi centre ──────────────────────────────────────────────────
//   const resetLocation = async () => {
//     await handleLocationChange(DEFAULT_LAT, DEFAULT_LNG)
//     setHasCustomLocation(false)
//     toast.success('Location reset to New Delhi')
//   }

//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 10 }}
//       animate={{ opacity: 1, y: 0 }}
//       className="space-y-4"
//     >
//       {/* Hint */}
//       <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
//         <p className="text-sm text-blue-700 font-body">
//           📍 Drag the pin on the map to pinpoint the exact location of the issue
//         </p>
//       </div>

//       {/* Action buttons */}
//       <div className="flex gap-2">
//         <motion.button
//           whileTap={{ scale: 0.95 }}
//           onClick={useCurrentLocation}
//           disabled={loading}
//           className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700
//                      disabled:bg-gray-300 text-white font-medium rounded-xl
//                      flex items-center justify-center gap-2 transition-colors"
//         >
//           {loading ? (
//             <><Loader2 size={18} className="animate-spin" /> Getting location...</>
//           ) : (
//             <><Navigation size={18} /> Use My Location</>
//           )}
//         </motion.button>

//         {hasCustomLocation && (
//           <motion.button
//             whileTap={{ scale: 0.95 }}
//             onClick={resetLocation}
//             className="py-3 px-4 border-2 border-gray-200 text-gray-600
//                        hover:border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
//           >
//             <RotateCcw size={18} />
//           </motion.button>
//         )}
//       </div>

//       {/* ── MAP CONTAINER ──
//           Height must be set here (not just on the inner ref div) so Leaflet
//           can measure it correctly. Using an explicit px height is the safest
//           approach — Tailwind's h-64 (256px) works fine here.
//       */}
//       <div
//         ref={containerRef}
//         style={{ height: '256px' }}
//         className="w-full rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm z-0"
//       />

//       {/* Coordinates badge */}
//       {hasCustomLocation && (
//         <motion.div
//           initial={{ opacity: 0, y: -6 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="bg-green-50 border-2 border-green-200 rounded-xl p-4"
//         >
//           <div className="flex items-start gap-2 mb-1">
//             <MapPin size={16} className="text-green-700 mt-0.5 shrink-0" />
//             <div>
//               <p className="text-xs font-semibold text-green-600">📍 Location Pinned</p>
//               <p className="text-xs text-green-600 mt-0.5">
//                 {coords.lat.toFixed(5)}°N, {coords.lng.toFixed(5)}°E
//               </p>
//             </div>
//           </div>
//           {address && <p className="text-sm text-gray-700 font-body mt-2">{address}</p>}
//         </motion.div>
//       )}

//       {/* Manual address textarea */}
//       <div className="space-y-2">
//         <label className="text-sm font-medium text-gray-700 font-body">
//           Or describe the location manually
//         </label>
//         <textarea
//           value={address}
//           onChange={(e) => {
//             setAddress(e.target.value)
//             // Propagate manual text changes too (keep lat/lng from last pin drop)
//             onLocationSelect(coords.lat, coords.lng, e.target.value)
//           }}
//           placeholder="House number, street, colony, landmark..."
//           rows={2}
//           className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-body
//                      text-gray-800 placeholder:text-gray-400 outline-none
//                      focus:border-primary-400 bg-white transition-colors resize-none"
//         />
//       </div>
//     </motion.div>
//   )
// }
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Loader2, Navigation, RotateCcw, Search, X } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import toast from 'react-hot-toast'

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
  initialLat?: number | null
  initialLng?: number | null
  initialAddress?: string
}

// ── Fix Leaflet broken default icons (Vite asset hashing) ────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom red pin icon — looks like a proper map marker
const RED_ICON = L.divIcon({
  className: '',
  html: `
    <div style="width:32px;height:40px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
      <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.016 23.041 15.077 24.006a1.333 1.333 0 001.846 0C17.984 39.041 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#EF4444"/>
        <circle cx="16" cy="15" r="6.5" fill="white" opacity="0.95"/>
        <circle cx="16" cy="15" r="3.5" fill="#EF4444"/>
      </svg>
    </div>
  `,
  iconSize:    [32, 40],
  iconAnchor:  [16, 40],
  popupAnchor: [0, -44],
})

const DEFAULT_LAT = 28.6139
const DEFAULT_LNG = 77.2090

// ── Nominatim reverse geocode ─────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=17&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const a    = data.address || {}
    const parts = [
      a.road || a.pedestrian || a.footway || a.path,
      a.neighbourhood || a.suburb || a.quarter || a.village,
      a.city || a.town || a.county,
      a.state,
    ].filter(Boolean)
    return parts.length > 0
      ? parts.join(', ')
      : (data.display_name?.split(',').slice(0, 3).join(', ') ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

// ── Nominatim forward geocode ─────────────────────────────────────────────────
interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  place_id: number
}

async function forwardGeocode(query: string): Promise<NominatimResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query + ' Delhi India'
      )}&format=json&addressdetails=1&limit=5&countrycodes=IN`,
      { headers: { 'Accept-Language': 'en' } }
    )
    return await res.json()
  } catch {
    return []
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress = '',
}: LocationPickerProps) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<L.Map | null>(null)
  const markerRef      = useRef<L.Marker | null>(null)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startLat = initialLat ?? DEFAULT_LAT
  const startLng = initialLng ?? DEFAULT_LNG

  const [gpsLoading,         setGpsLoading]         = useState(false)
  const [geocoding,          setGeocoding]           = useState(false)
  const [address,            setAddress]             = useState(initialAddress)
  const [hasCustomLocation,  setHasCustomLocation]   = useState(!!(initialLat && initialLng))
  const [coords,             setCoords]              = useState({ lat: startLat, lng: startLng })
  const [searchQuery,        setSearchQuery]         = useState('')
  const [searchResults,      setSearchResults]       = useState<NominatimResult[]>([])
  const [searchLoading,      setSearchLoading]       = useState(false)
  const [showResults,        setShowResults]         = useState(false)

  // ── Move marker + reverse geocode ──────────────────────────────────────────
  const moveTo = useCallback(async (lat: number, lng: number, knownAddress?: string) => {
    setCoords({ lat, lng })
    setHasCustomLocation(true)

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

  // ── Init Leaflet map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:          [startLat, startLng],
      zoom:            15,
      scrollWheelZoom: 'center',
      zoomControl:     true,
    })

    // OSM tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Draggable red pin
    const marker = L.marker([startLat, startLng], {
      draggable: true,
      icon:      RED_ICON,
      autoPan:   true,
    }).addTo(map)

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      moveTo(lat, lng)
    })

    // Click anywhere on map to move pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      moveTo(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current    = map
    markerRef.current = marker

    // CRITICAL FIX: Leaflet calculates its size once at mount.
    // If the container hasn't finished rendering, it gets 0×0 → grey box.
    // We call invalidateSize at 100 ms and again at 500 ms to catch both
    // cases (immediate render and CSS transition delays).
    const t1 = setTimeout(() => map.invalidateSize(), 100)
    const t2 = setTimeout(() => map.invalidateSize(), 500)

    // Seed initial address if not provided
    if (initialLat && initialLng && !initialAddress) {
      reverseGeocode(initialLat, initialLng).then((addr) => {
        setAddress(addr)
        onLocationSelect(initialLat, initialLng, addr)
      })
    } else if (!initialLat) {
      reverseGeocode(DEFAULT_LAT, DEFAULT_LNG).then((addr) => {
        setAddress(addr)
        onLocationSelect(DEFAULT_LAT, DEFAULT_LNG, addr)
      })
    }

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      map.remove()
      mapRef.current    = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── GPS button ─────────────────────────────────────────────────────────────
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        await moveTo(latitude, longitude)
        if (mapRef.current) mapRef.current.setZoom(17)
        toast.success('📍 Location captured from GPS!')
        setGpsLoading(false)
      },
      (err) => {
        console.error('GPS error:', err)
        toast.error('Could not get GPS. Enable location permissions and try again.')
        setGpsLoading(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // ── Reset button ───────────────────────────────────────────────────────────
  const resetLocation = async () => {
    await moveTo(DEFAULT_LAT, DEFAULT_LNG)
    setHasCustomLocation(false)
    toast('Location reset to New Delhi', { icon: '🔄' })
  }

  // ── Search input handler ───────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 3) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      const results = await forwardGeocode(val)
      setSearchResults(results)
      setShowResults(results.length > 0)
      setSearchLoading(false)
    }, 500)
  }

  const selectResult = async (r: NominatimResult) => {
    const lat      = parseFloat(r.lat)
    const lng      = parseFloat(r.lon)
    const shortAddr = r.display_name.split(',').slice(0, 3).join(', ')
    setSearchQuery(shortAddr)
    setShowResults(false)
    setSearchResults([])
    await moveTo(lat, lng, shortAddr)
    if (mapRef.current) mapRef.current.setZoom(16)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="relative z-20">
        <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl
                        px-3 py-2.5 focus-within:border-primary-400 transition-colors shadow-sm">
          {searchLoading
            ? <Loader2 size={15} className="text-gray-400 animate-spin shrink-0" />
            : <Search  size={15} className="text-gray-400 shrink-0" />
          }
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Search address, landmark, colony, pincode…"
            className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setShowResults(false) }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown results */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200
                         rounded-xl shadow-xl overflow-hidden"
            >
              {searchResults.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onMouseDown={() => selectResult(r)}   // mousedown fires before blur
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50
                             border-b border-gray-100 last:border-0 flex items-start gap-2 transition-colors"
                >
                  <MapPin size={13} className="text-red-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2 leading-snug">
                    {r.display_name.split(',').slice(0, 4).join(', ')}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── GPS + Reset buttons ──────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={useCurrentLocation}
          disabled={gpsLoading}
          className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     text-white font-medium rounded-xl
                     flex items-center justify-center gap-2 transition-colors text-sm"
        >
          {gpsLoading
            ? <><Loader2 size={15} className="animate-spin" /> Locating…</>
            : <><Navigation size={15} /> Use My Location</>
          }
        </motion.button>

        <AnimatePresence>
          {hasCustomLocation && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              whileTap={{ scale: 0.92 }}
              onClick={resetLocation}
              title="Reset to Delhi centre"
              className="py-2.5 px-4 border-2 border-gray-200 text-gray-500
                         hover:border-red-200 hover:text-red-500 hover:bg-red-50
                         rounded-xl transition-colors"
            >
              <RotateCcw size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Map wrapper ──────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">

        {/* Top hint */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none
                        bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow
                        text-xs text-gray-600 whitespace-nowrap flex items-center gap-1">
          <MapPin size={10} className="text-red-500" />
          Drag pin or click map to set exact location
        </div>

        {/* Geocoding spinner */}
        <AnimatePresence>
          {geocoding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000]
                         bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow
                         text-xs text-gray-600 flex items-center gap-1.5"
            >
              <Loader2 size={10} className="animate-spin text-primary-500" />
              Getting address…
            </motion.div>
          )}
        </AnimatePresence>

        {/*
          THE MAP DIV
          Must have an explicit pixel height. Leaflet reads this synchronously
          at init — if it's 0 the tiles won't render (grey box bug).
        */}
        <div
          ref={containerRef}
          style={{ height: '300px', width: '100%' }}
        />
      </div>

      {/* ── Pinned address badge ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasCustomLocation && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <MapPin size={11} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-green-700">Location Pinned</span>
              <span className="ml-auto text-xs text-green-500 font-mono">
                {coords.lat.toFixed(4)}°N, {coords.lng.toFixed(4)}°E
              </span>
            </div>
            {address && (
              <p className="text-sm text-gray-700 mt-2 pl-7 leading-snug">{address}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Manual address description ───────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
          Add more location details
          <span className="text-gray-400 font-normal text-xs">(optional)</span>
        </label>
        <textarea
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            onLocationSelect(coords.lat, coords.lng, e.target.value)
          }}
          placeholder="e.g. Near red gate, opposite Sharma Medical, Lane 3…"
          rows={2}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                     text-gray-800 placeholder:text-gray-400 text-sm
                     outline-none focus:border-primary-400 bg-white
                     transition-colors resize-none"
        />
      </div>

    </motion.div>
  )
}