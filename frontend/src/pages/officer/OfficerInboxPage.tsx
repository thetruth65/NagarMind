import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Map as MapIcon, List, CheckCircle } from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { ComplaintCard } from '@/components/citizen/ComplaintCard'
import { complaintsAPI } from '@/lib/api'
import type { Complaint } from '@/types'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const NAV_ITEMS =[
  { to: '/officer/dashboard', label: 'Dashboard', icon: <span>🏠</span> },
  { to: '/officer/inbox',     label: 'Inbox',     icon: <span>📋</span> },
  { to: '/officer/digest',    label: 'Digest',    icon: <span>📊</span> },
  { to: '/officer/profile',   label: 'Profile',   icon: <span>👤</span> },
]

const STATUS_FILTERS =[
  { value: '', label: 'All Tasks', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  { value: 'assigned', label: 'New Assigned', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'disputed', label: 'Disputed ⚠️', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
]

export function OfficerInboxPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialView = searchParams.get('view') === 'map' ? 'map' : 'list'

  const [view, setView] = useState<'list' | 'map'>(initialView)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const[loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    complaintsAPI.inbox({ status: statusFilter || undefined, limit: 100 })
      .then(r => setComplaints(r.data.complaints ||[]))
      .catch(() => toast.error('Failed to load inbox'))
      .finally(() => setLoading(false))
  }, [statusFilter])

  // ✅ FIX: Safe Leaflet Initialization for React 18 Strict Mode
  useEffect(() => {
    if (view !== 'map' || !mapContainerRef.current) return
    
    // Clear any existing Leaflet instances from the DOM element directly
    const container = mapContainerRef.current as any
    if (container._leaflet_id) { container._leaflet_id = null }

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([28.6139, 77.2090], 12)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 20
      }).addTo(map)
      mapRef.current = map
    }

    mapRef.current.eachLayer(l => { if (l instanceof L.Marker) mapRef.current?.removeLayer(l) })

    const bounds = L.latLngBounds([])
    complaints.forEach(c => {
      if (c.location_lat && c.location_lng) {
        L.marker([c.location_lat, c.location_lng])
         .addTo(mapRef.current!)
         .bindPopup(`<div style="color:#0f172a;font-family:sans-serif;"><b>${c.title}</b><br/>${c.urgency.toUpperCase()} Priority<br/><a href="/officer/complaint/${c.complaint_id}" style="color:#2563eb;font-weight:bold;">View Details</a></div>`)
        bounds.extend([c.location_lat, c.location_lng])
      }
    })
    if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [20, 20] })

    return () => {
      if (mapRef.current && view !== 'map') {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [view, complaints])

  const filtered = search ? complaints.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.complaint_id.includes(search)) : complaints

  return (
    <AppShell navItems={NAV_ITEMS} role="officer">
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-white">Task Inbox</h1>
            <p className="text-sm text-slate-400 font-body">Manage your ward's civic issues</p>
          </div>
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button onClick={() => setView('list')} className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all ${view === 'list' ? 'bg-primary-600 text-white shadow-glow-blue' : 'text-slate-500 hover:text-slate-300'}`}><List size={16} /> List</button>
            <button onClick={() => setView('map')} className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all ${view === 'map' ? 'bg-primary-600 text-white shadow-glow-blue' : 'text-slate-500 hover:text-slate-300'}`}><MapIcon size={16} /> Map</button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold font-body whitespace-nowrap border-2 transition-all ${statusFilter === f.value ? 'border-primary-500 bg-primary-600/20 text-primary-400' : `bg-slate-900 ${f.color} hover:brightness-125`}`}>{f.label}</button>
          ))}
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search complaint title..." className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-800 text-white rounded-2xl outline-none focus:border-primary-500 text-sm font-body transition-colors" />
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-800/60 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
            <h3 className="font-display font-bold text-xl text-white">Inbox Zero!</h3>
            <p className="text-slate-400 text-sm font-body mt-1">No complaints match your filters right now.</p>
          </div>
        ) : view === 'list' ? (
          <div className="space-y-3">
            {filtered.map((c, i) => (
              <motion.div key={c.complaint_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <ComplaintCard complaint={c} officerView={true} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-slate-700 rounded-2xl overflow-hidden shadow-lg p-1 bg-slate-800">
            <div ref={mapContainerRef} className="w-full h-[60vh] rounded-xl overflow-hidden z-10 bg-slate-900" />
          </div>
        )}
      </div>
    </AppShell>
  )
}