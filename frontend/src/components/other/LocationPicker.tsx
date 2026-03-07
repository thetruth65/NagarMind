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

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export function LocationPicker({
  onLocationSelect,
  initialLat = 28.6139,
  initialLng = 77.209,
  initialAddress = 'New Delhi',
}: LocationPickerProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [loading, setLoading] = useState(false)
  const [address, setAddress] = useState(initialAddress)
  const [hasCustomLocation, setHasCustomLocation] = useState(!!initialLat && !!initialLng)
  const [coords, setCoords] = useState({
    lat: initialLat || 28.6139,
    lng: initialLng || 77.209,
  })

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView([coords.lat, coords.lng], 15)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // Create draggable marker at center
    const marker = L.marker([coords.lat, coords.lng], { draggable: true })
      .addTo(map)
      .bindPopup('📍 Drag me to move the location')

    marker.on('dragend', () => {
      const latLng = marker.getLatLng()
      updateLocation(latLng.lat, latLng.lng)
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      )
      const data = await res.json()
      const addr =
        data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      setAddress(addr)
      return addr
    } catch (err) {
      console.error('Geocoding error:', err)
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
  }

  const updateLocation = async (lat: number, lng: number) => {
    setCoords({ lat, lng })
    setHasCustomLocation(true)

    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lng], 15)
      markerRef.current.setLatLng([lat, lng])
    }

    const addr = await reverseGeocode(lat, lng)
    onLocationSelect(lat, lng, addr)
  }

  const useCurrentLocation = () => {
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const addr = await reverseGeocode(latitude, longitude)
        await updateLocation(latitude, longitude)
        toast.success('Location captured from GPS!')
        setLoading(false)
      },
      (err) => {
        console.error('Geolocation error:', err)
        toast.error('Could not access location. Please enable GPS.')
        setLoading(false)
      },
      { timeout: 10000 }
    )
  }

  const resetLocation = () => {
    const defaultLat = 28.6139
    const defaultLng = 77.209
    updateLocation(defaultLat, defaultLng)
    toast.success('Location reset to default')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm text-blue-700 font-body">
          📍 Drag the red pin on the map to pinpoint the exact location of the issue
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={useCurrentLocation}
          disabled={loading}
          className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300
                     text-white font-medium rounded-xl flex items-center justify-center gap-2
                     transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <Navigation size={18} />
              Use My Location
            </>
          )}
        </motion.button>

        {hasCustomLocation && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={resetLocation}
            className="py-3 px-4 border-2 border-gray-200 text-gray-600 hover:border-gray-300
                       hover:bg-gray-50 font-medium rounded-xl transition-colors"
          >
            <RotateCcw size={18} />
          </motion.button>
        )}
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="w-full h-64 rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm bg-gray-50"
      />

      {/* Coordinates display */}
      {hasCustomLocation && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border-2 border-green-200 rounded-xl p-4"
        >
          <div className="flex items-start gap-2 mb-2">
            <MapPin size={16} className="text-green-700 mt-1 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-green-600 mb-1">📍 Location Pinned</p>
              <p className="text-xs text-green-600">
                Coordinates: {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-700 font-body mt-2">{address}</p>
        </motion.div>
      )}

      {/* Address textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 font-body">
          Or enter address manually
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="House number, street, colony, landmark..."
          rows={2}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-body text-gray-800
                     placeholder:text-gray-400 outline-none focus:border-primary-400 bg-white
                     transition-colors resize-none"
        />
      </div>
    </motion.div>
  )
}
