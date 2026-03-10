import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Loader2, Navigation, RotateCcw } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import toast from 'react-hot-toast'

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
  initialLat?: number | null
  initialLng?: number | null
  initialAddress?: string
}

// Fix Leaflet default marker icons (broken by webpack/vite asset hashing)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const DEFAULT_LAT = 28.6139
const DEFAULT_LNG = 77.2090

export function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress = '',
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const markerRef    = useRef<L.Marker | null>(null)

  const startLat = initialLat  ?? DEFAULT_LAT
  const startLng = initialLng  ?? DEFAULT_LNG

  const [loading,           setLoading]           = useState(false)
  const [address,           setAddress]           = useState(initialAddress)
  const [hasCustomLocation, setHasCustomLocation] = useState(!!(initialLat && initialLng))
  const [coords,            setCoords]            = useState({ lat: startLat, lng: startLng })

  // ── Initialise Leaflet map exactly once ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [startLat, startLng],
      zoom: 15,
      // Prevents the map stealing scroll on mobile
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([startLat, startLng], { draggable: true })
      .addTo(map)
      .bindPopup('📍 Drag me to the exact location')
      .openPopup()

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      handleLocationChange(lat, lng)
    })

    mapRef.current    = map
    markerRef.current = marker

    // ⚠️  KEY FIX: Leaflet needs the container to be fully painted before it
    // can measure its dimensions. Without this, the map renders as a grey box.
    setTimeout(() => map.invalidateSize(), 150)

    return () => {
      map.remove()
      mapRef.current    = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reverse geocode ────────────────────────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      )
      const data = await res.json()
      return (
        data.display_name?.split(',').slice(0, 3).join(', ') ??
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      )
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
  }

  // ── Central location change handler ───────────────────────────────────────
  const handleLocationChange = async (lat: number, lng: number) => {
    setCoords({ lat, lng })
    setHasCustomLocation(true)

    // Move map + marker
    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lng], 15, { animate: true })
      markerRef.current.setLatLng([lat, lng])
    }

    const addr = await reverseGeocode(lat, lng)
    setAddress(addr)
    onLocationSelect(lat, lng, addr)
  }

  // ── Use device GPS ─────────────────────────────────────────────────────────
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        await handleLocationChange(latitude, longitude)
        toast.success('Location captured from GPS!')
        setLoading(false)
      },
      (err) => {
        console.error('Geolocation error:', err)
        toast.error('Could not access GPS. Please enable location permissions.')
        setLoading(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // ── Reset to Delhi centre ──────────────────────────────────────────────────
  const resetLocation = async () => {
    await handleLocationChange(DEFAULT_LAT, DEFAULT_LNG)
    setHasCustomLocation(false)
    toast.success('Location reset to New Delhi')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm text-blue-700 font-body">
          📍 Drag the pin on the map to pinpoint the exact location of the issue
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={useCurrentLocation}
          disabled={loading}
          className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700
                     disabled:bg-gray-300 text-white font-medium rounded-xl
                     flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Getting location...</>
          ) : (
            <><Navigation size={18} /> Use My Location</>
          )}
        </motion.button>

        {hasCustomLocation && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={resetLocation}
            className="py-3 px-4 border-2 border-gray-200 text-gray-600
                       hover:border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <RotateCcw size={18} />
          </motion.button>
        )}
      </div>

      {/* ── MAP CONTAINER ──
          Height must be set here (not just on the inner ref div) so Leaflet
          can measure it correctly. Using an explicit px height is the safest
          approach — Tailwind's h-64 (256px) works fine here.
      */}
      <div
        ref={containerRef}
        style={{ height: '256px' }}
        className="w-full rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm z-0"
      />

      {/* Coordinates badge */}
      {hasCustomLocation && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border-2 border-green-200 rounded-xl p-4"
        >
          <div className="flex items-start gap-2 mb-1">
            <MapPin size={16} className="text-green-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-600">📍 Location Pinned</p>
              <p className="text-xs text-green-600 mt-0.5">
                {coords.lat.toFixed(5)}°N, {coords.lng.toFixed(5)}°E
              </p>
            </div>
          </div>
          {address && <p className="text-sm text-gray-700 font-body mt-2">{address}</p>}
        </motion.div>
      )}

      {/* Manual address textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 font-body">
          Or describe the location manually
        </label>
        <textarea
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            // Propagate manual text changes too (keep lat/lng from last pin drop)
            onLocationSelect(coords.lat, coords.lng, e.target.value)
          }}
          placeholder="House number, street, colony, landmark..."
          rows={2}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-body
                     text-gray-800 placeholder:text-gray-400 outline-none
                     focus:border-primary-400 bg-white transition-colors resize-none"
        />
      </div>
    </motion.div>
  )
}