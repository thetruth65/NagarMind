import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Map as MapIcon, List, CheckCircle, Inbox, UserPlus, Loader2 } from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { ComplaintCard } from '@/components/citizen/ComplaintCard'
import { complaintsAPI } from '@/lib/api'
import type { Complaint } from '@/types'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const NAV_ITEMS = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: <span>🏠</span> },
  { to: '/officer/inbox',     label: 'Inbox',     icon: <span>📋</span> },
  { to: '/officer/digest',    label: 'Digest',    icon: <span>📊</span> },
  { to: '/officer/profile',   label: 'Profile',   icon: <span>👤</span> },
]

const STATUS_FILTERS = [
  { value: '',             label: 'All Tasks',    color: 'bg-slate-800 text-slate-300 border-slate-700'      },
  { value: 'assigned',     label: 'New Assigned', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'   },
  { value: 'acknowledged', label: 'Acknowledged', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'in_progress',  label: 'In Progress',  color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'disputed',     label: 'Disputed ⚠️',  color: 'bg-red-500/20 text-red-400 border-red-500/30'      },
]

export function OfficerInboxPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialView = searchParams.get('view') === 'map' ? 'map' : 'list'

  const [view, setView]               = useState<'list' | 'map'>(initialView)
  const [complaints, setComplaints]   = useState<Complaint[]>([])
  const [unassigned, setUnassigned]   = useState<Complaint[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]           = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [activeTab, setActiveTab]     = useState<'mine' | 'unassigned'>('mine')

  const mapRef          = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const load = () => {
    setLoading(true)
    complaintsAPI.inbox({ status: statusFilter || undefined, limit: 100 })
      .then(r => {
        setComplaints(r.data.complaints || [])
        setUnassigned(r.data.unassigned_in_ward || [])
      })
      .catch(() => toast.error('Failed to load inbox'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])

  // ── Self-assign: officer takes up an unassigned complaint ─────────────────
  const takeUp = async (complaintId: string) => {
    setAssigningId(complaintId)
    try {
      await complaintsAPI.assignComplaint(complaintId)
      toast.success('Complaint assigned to you! SLA timer started.')
      // Move from unassigned → mine list
      const taken = unassigned.find(c => c.complaint_id === complaintId)
      if (taken) {
        setUnassigned(prev => prev.filter(c => c.complaint_id !== complaintId))
        setComplaints(prev => [{ ...taken, status: 'assigned' }, ...prev])
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Could not assign complaint')
    } finally {
      setAssigningId(null)
    }
  }

  // ── Leaflet map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'map' || !mapContainerRef.current) return
    const container = mapContainerRef.current as any
    if (container._leaflet_id) { container._leaflet_id = null }

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([28.6139, 77.2090], 12)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 20,
      }).addTo(map)
      mapRef.current = map
    }

    mapRef.current.eachLayer(l => { if (l instanceof L.Marker) mapRef.current?.removeLayer(l) })

    const allVisible = [...complaints, ...unassigned]
    const bounds = L.latLngBounds([])
    allVisible.forEach(c => {
      if (c.location_lat && c.location_lng) {
        const isUnassigned = !c.officer_id
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${isUnassigned ? '#f59e0b' : '#3b82f6'};
            border:2px solid ${isUnassigned ? '#d97706' : '#2563eb'};
            display:flex;align-items:center;justify-content:center;
            font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
            ${isUnassigned ? '⚡' : '📋'}
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
        L.marker([c.location_lat, c.location_lng], { icon })
          .addTo(mapRef.current!)
          .bindPopup(`
            <div style="color:#0f172a;font-family:sans-serif;min-width:180px;">
              <b>${c.title}</b><br/>
              <span style="color:${isUnassigned ? '#d97706' : '#2563eb'};">
                ${isUnassigned ? '⚡ Unassigned (take up)' : `${c.urgency?.toUpperCase()} Priority`}
              </span><br/>
              <a href="/officer/complaint/${c.complaint_id}" style="color:#2563eb;font-weight:bold;">View Details →</a>
            </div>`)
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
  }, [view, complaints, unassigned])

  const filtered = search
    ? complaints.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.complaint_id.includes(search))
    : complaints

  const filteredUnassigned = search
    ? unassigned.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.complaint_id.includes(search))
    : unassigned

  return (
    <AppShell navItems={NAV_ITEMS} role="officer">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-white">Task Inbox</h1>
            <p className="text-sm text-slate-400 font-body">Manage your ward's civic issues</p>
          </div>
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button onClick={() => setView('list')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all
                ${view === 'list' ? 'bg-primary-600 text-white shadow-glow-blue' : 'text-slate-500 hover:text-slate-300'}`}>
              <List size={16} /> List
            </button>
            <button onClick={() => setView('map')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all
                ${view === 'map' ? 'bg-primary-600 text-white shadow-glow-blue' : 'text-slate-500 hover:text-slate-300'}`}>
              <MapIcon size={16} /> Map
            </button>
          </div>
        </div>

        {/* Tab switcher: My Tasks vs Unassigned in Ward */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit gap-1">
          <button onClick={() => setActiveTab('mine')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold font-body flex items-center gap-2 transition-all
              ${activeTab === 'mine' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            <Inbox size={15} /> My Tasks
            {complaints.length > 0 && (
              <span className="bg-primary-500/30 text-primary-300 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {complaints.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('unassigned')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold font-body flex items-center gap-2 transition-all
              ${activeTab === 'unassigned' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            <UserPlus size={15} /> Unassigned in Ward
            {unassigned.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                ${activeTab === 'unassigned' ? 'bg-amber-500/30 text-amber-200' : 'bg-amber-500/20 text-amber-400'}`}>
                {unassigned.length}
              </span>
            )}
          </button>
        </div>

        {/* Status filters — only for "My Tasks" tab */}
        {activeTab === 'mine' && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold font-body whitespace-nowrap border-2 transition-all
                  ${statusFilter === f.value
                    ? 'border-primary-500 bg-primary-600/20 text-primary-400'
                    : `bg-slate-900 ${f.color} hover:brightness-125`}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or ID..."
            className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-800 text-white rounded-2xl
                       outline-none focus:border-primary-500 text-sm font-body transition-colors" />
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : view === 'map' ? (
          /* Map view — shows all complaints + unassigned */
          <div className="border-2 border-slate-700 rounded-2xl overflow-hidden shadow-lg p-1 bg-slate-800">
            <div ref={mapContainerRef} className="w-full h-[60vh] rounded-xl overflow-hidden z-10 bg-slate-900" />
            <div className="flex items-center gap-4 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-body">
                <div className="w-3 h-3 rounded-full bg-blue-500" /> My assigned
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-body">
                <div className="w-3 h-3 rounded-full bg-amber-500" /> Unassigned in ward
              </div>
            </div>
          </div>
        ) : activeTab === 'mine' ? (
          /* My Tasks list */
          filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
              <h3 className="font-display font-bold text-xl text-white">Inbox Zero!</h3>
              <p className="text-slate-400 text-sm font-body mt-1">
                No complaints match your filters.
              </p>
              {unassigned.length > 0 && (
                <button onClick={() => setActiveTab('unassigned')}
                  className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl
                             text-sm font-semibold font-body transition-colors">
                  ⚡ {unassigned.length} unassigned in your ward →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c, i) => (
                <motion.div key={c.complaint_id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}>
                  <ComplaintCard complaint={c} officerView={true} />
                </motion.div>
              ))}
            </div>
          )
        ) : (
          /* Unassigned in Ward */
          filteredUnassigned.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
              <h3 className="font-display font-bold text-xl text-white">All Clear!</h3>
              <p className="text-slate-400 text-sm font-body mt-1">
                No unassigned complaints in your ward right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
                <p className="text-amber-300 text-sm font-semibold font-body flex items-center gap-2">
                  <UserPlus size={15} />
                  {filteredUnassigned.length} complaint{filteredUnassigned.length !== 1 ? 's' : ''} waiting for assignment in your ward
                </p>
                <p className="text-amber-400/70 text-xs font-body mt-0.5">
                  Click "Take Up" to self-assign and start the SLA timer.
                </p>
              </div>

              {filteredUnassigned.map((c, i) => (
                <motion.div key={c.complaint_id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative">
                  <ComplaintCard complaint={c} officerView={true} />
                  {/* Take Up button overlaid on card */}
                  <div className="absolute top-3 right-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); takeUp(c.complaint_id) }}
                      disabled={assigningId === c.complaint_id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400
                                 text-white text-xs font-bold rounded-xl shadow-lg transition-all
                                 disabled:opacity-60 disabled:cursor-not-allowed font-body">
                      {assigningId === c.complaint_id
                        ? <><Loader2 size={12} className="animate-spin" /> Assigning...</>
                        : <><UserPlus size={12} /> Take Up</>}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </AppShell>
  )
}