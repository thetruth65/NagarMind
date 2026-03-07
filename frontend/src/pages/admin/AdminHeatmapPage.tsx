import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MapPin, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { adminAPI } from '@/lib/api'
import { healthColor } from '@/lib/utils'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type WardPoint = {
  ward_id: number; ward_name: string; zone: string
  lat_center?: number; lng_center?: number
  health_score: number; health_grade: string
  open_count: number; resolved_week: number; overdue_count: number
  top_category?: string
}

type GradeFilter = 'all' | 'A' | 'B' | 'C' | 'D' | 'F'

export function AdminHeatmapPage() {
  const navigate = useNavigate()
  const mapRef = useRef<L.Map | null>(null)
  const mapEl  = useRef<HTMLDivElement>(null)
  const [wards, setWards]       = useState<WardPoint[]>([])
  const [selected, setSelected] = useState<WardPoint | null>(null)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<GradeFilter>('all')

  useEffect(() => {
    adminAPI.heatmap().then(r => {
      setWards(r.data.wards ||[])
    }).catch(() => toast.error('Failed to load heatmap'))
      .finally(() => setLoading(false))
  },[])

  useEffect(() => {
    if (!mapEl.current || mapRef.current || loading) return
    const map = L.map(mapEl.current, { zoomControl: false }).setView([28.65, 77.22], 11)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [loading])

  useEffect(() => {
    if (!mapRef.current || !wards.length) return
    mapRef.current.eachLayer(l => {
      if ((l as any)._isWardMarker) mapRef.current!.removeLayer(l)
    })

    const filtered = filter === 'all' ? wards : wards.filter(w => w.health_grade === filter)
    filtered.forEach(ward => {
      if (!ward.lat_center || !ward.lng_center) return
      const col = healthColor(ward.health_score)
      const radius = Math.max(ward.open_count * 60, 500)
      const circle = L.circle([ward.lat_center, ward.lng_center], {
        radius,
        color: col,
        fillColor: col,
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(mapRef.current!)
      ;(circle as any)._isWardMarker = true

      circle.on('click', () => setSelected(ward))
      
      // ✅ NEW: Beautiful Custom Dark Tooltip
      circle.bindTooltip(
        `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 14px; color: #f1f5f9; min-width: 220px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); backdrop-filter: blur(8px);">
          <div style="border-bottom: 1px solid #1e293b; padding-bottom: 8px; margin-bottom: 10px;">
            <h4 style="margin: 0; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: bold; color: #fff;">${ward.ward_name}</h4>
            <span style="font-size: 11px; color: #94a3b8; font-family: 'DM Sans', sans-serif;">Zone: ${ward.zone}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-family: 'DM Sans', sans-serif;">
            <span style="font-size: 12px; color: #94a3b8;">Health Grade</span>
            <strong style="font-size: 12px; color: ${col};">${ward.health_grade} (${Number(ward.health_score).toFixed(1)})</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-family: 'DM Sans', sans-serif;">
            <span style="font-size: 12px; color: #94a3b8;">Active Open Cases</span>
            <strong style="font-size: 12px; color: #facc15;">${ward.open_count}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-family: 'DM Sans', sans-serif;">
            <span style="font-size: 12px; color: #94a3b8;">Resolved (7 Days)</span>
            <strong style="font-size: 12px; color: #4ade80;">${ward.resolved_week}</strong>
          </div>
        </div>
        `,
        { className: 'leaflet-tooltip-custom', sticky: true, direction: 'top', offset: [0, -10] }
      )
    })
  }, [wards, filter])

  const grades =['A', 'B', 'C', 'D', 'F']
  const GRADE_COLORS: Record<string, string> = {
    A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444'
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        {/* ✅ NEW: Back to Dashboard Button */}
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-white">City Heatmap</h1>
            <p className="text-slate-400 text-sm font-body">All 272 MCD Delhi wards — health score overlay</p>
          </div>
        </div>

        {/* Grade filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', ...grades] as const).map(g => (
            <button key={g} onClick={() => setFilter(g as GradeFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-body border-2 transition-all
                ${filter === g
                  ? 'border-primary-500 bg-primary-600/20 text-primary-300'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
              style={g !== 'all' && filter !== g ? { borderColor: GRADE_COLORS[g] + '40', color: GRADE_COLORS[g] } : {}}>
              {g === 'all' ? 'All Grades' : `Grade ${g}`}
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800" style={{ height: '60vh' }}>
          {loading ? (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-body">Loading heatmap...</p>
              </div>
            </div>
          ) : (
            <div ref={mapEl} className="w-full h-full" />
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[999] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-2xl p-3">
            <p className="text-xs text-slate-400 font-body font-semibold mb-2">Health Score</p>
            <div className="flex gap-2">
              {[
                { label: '80+', color: '#22c55e' },
                { label: '65+', color: '#3b82f6' },
                { label: '50+', color: '#f59e0b' },
                { label: '35+', color: '#f97316' },
                { label: '<35', color: '#ef4444' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                  <span className="text-[10px] text-slate-400 font-body">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats overlay */}
          <div className="absolute top-4 right-4 z-[999] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-2xl p-3 text-right">
            <p className="text-xs text-slate-400 font-body">{filter === 'all' ? wards.length : wards.filter(w => w.health_grade === filter).length} wards</p>
            <p className="text-[10px] text-slate-500 font-body">shown</p>
          </div>
        </div>

        {/* Ward detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-lg text-white">{selected.ward_name}</h3>
                  <p className="text-sm text-slate-400 font-body flex items-center gap-1">
                    <MapPin size={12} /> {selected.zone} Zone
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl"
                    style={{ background: `${GRADE_COLORS[selected.health_grade]}20`, color: GRADE_COLORS[selected.health_grade] }}>
                    {selected.health_grade}
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700">
                    <X size={14} className="text-slate-300" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Health Score', value: Number(selected.health_score).toFixed(1), icon: '💯', color: 'text-white' },
                  { label: 'Open Issues', value: selected.open_count, icon: '⏳', color: 'text-amber-300' },
                  { label: 'Overdue', value: selected.overdue_count, icon: '🚨', color: 'text-red-400' },
                  { label: 'Resolved (7d)', value: selected.resolved_week, icon: '✅', color: 'text-green-300' },
                  { label: 'Top Issue', value: (selected.top_category || 'N/A').replace(/_/g, ' '), icon: '📋', color: 'text-slate-300' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/60 rounded-xl p-3">
                    <div className="text-lg mb-1">{s.icon}</div>
                    <div className={`font-bold text-sm capitalize ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-slate-500 font-body">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminShell>
  )
}