import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin } from 'lucide-react'
import { wardsAPI } from '@/lib/api'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import toast from 'react-hot-toast'

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899']

const CATEGORY_LABELS: Record<string, string> = {
  roads_and_footpaths:  'Roads',
  sanitation_and_garbage: 'Sanitation',
  drainage_and_flooding: 'Drainage',
  street_lighting:      'Lighting',
  parks_and_gardens:    'Parks',
  water_supply:         'Water',
  illegal_construction: 'Construction',
  noise_and_pollution:  'Pollution',
  stray_animals:        'Animals',
  other:                'Other',
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#f43f5e',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
}

/** Derive a human-readable title for zone/city header */
function getDisplayTitle(type: string, entityId: string | null, digest: any): string {
  if (type === 'ward')   return digest?.ward_name || `Ward ${entityId}`
  if (type === 'zone')   return entityId ? `${entityId} Zone` : 'Zone Digest'
  if (type === 'city')   return 'MCD Delhi — Full City'
  return digest?.ward_name || 'Digest'
}

export function WeeklyDigestPage() {
  const navigate          = useNavigate()
  const [searchParams]    = useSearchParams()
  const { digestId: paramId } = useParams()

  const type = searchParams.get('type') || 'ward'
  const id   = searchParams.get('id') || paramId || null

  const [history,  setHistory]  = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!id && type !== 'city') {
      toast.error('Missing parameters')
      navigate(-1)
      return
    }

    setLoading(true)
    wardsAPI.getDigestHistory(type, id || undefined)
      .then(r => {
        const digests = r.data.digests || []
        setHistory(digests)
        if (digests.length > 0) setSelected(digests[0])
      })
      .catch(() => toast.error('Failed to load digest history'))
      .finally(() => setLoading(false))
  }, [type, id])

  // ── Derived chart data ──────────────────────────────────────────────────────

  const trendData = [...history].reverse().map(d => ({
    week:     format(new Date(d.week_start), 'MMM d'),
    resolved: d.resolved_complaints  ?? 0,
    total:    d.total_complaints     ?? 0,
    pending:  d.pending_complaints   ?? 0,
    score:    Number(d.health_score_end ?? 0).toFixed(1),
    rate:     Number(d.resolution_rate  ?? 0).toFixed(1),
  }))

  const catPieData = (() => {
    if (!selected?.category_breakdown) return []
    try {
      const parsed = typeof selected.category_breakdown === 'string'
        ? JSON.parse(selected.category_breakdown)
        : selected.category_breakdown
      return (parsed as any[]).map(c => ({
        name:  CATEGORY_LABELS[c.category] || c.category,
        value: c.count,
      }))
    } catch { return [] }
  })()

  const urgPieData = (() => {
    if (!selected?.urgency_breakdown) return []
    try {
      const parsed = typeof selected.urgency_breakdown === 'string'
        ? JSON.parse(selected.urgency_breakdown)
        : selected.urgency_breakdown
      return (parsed as any[]).map(u => ({
        name:  u.urgency,
        value: u.count,
        fill:  URGENCY_COLORS[u.urgency] || '#94a3b8',
      }))
    } catch { return [] }
  })()

  const resRate = selected
    ? (selected.resolution_rate != null
        ? Number(selected.resolution_rate)
        : selected.total_complaints > 0
          ? Math.round((selected.resolved_complaints / selected.total_complaints) * 100)
          : 0)
    : 0

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!history.length || !selected) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">📭</div>
      <p className="text-slate-300 font-body text-center px-6">
        No digests generated yet for this{' '}
        {type === 'city' ? 'city' : type === 'zone' ? 'zone' : 'ward'}.
        <br />
        <span className="text-slate-500 text-sm">Run the digest trigger from the admin panel to generate.</span>
      </p>
      <button onClick={() => navigate(-1)} className="text-primary-400 hover:text-primary-300 text-sm font-body">
        ← Go back
      </button>
    </div>
  )

  const displayTitle = getDisplayTitle(type, id, selected)
  const typeLabel    = type === 'city' ? 'CITY' : type === 'zone' ? 'ZONE' : 'WARD'

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Sticky header */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
            <ArrowLeft size={15} className="text-slate-300" />
          </button>
          <MapPin size={14} className="text-primary-400" />
          <span className="font-display font-bold text-white text-sm">NagarMind Analytical Digest</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Page title */}
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-body font-bold
            border bg-blue-500/10 border-blue-500/30 text-blue-400 uppercase tracking-widest">
            {typeLabel} LEVEL DIGEST
          </span>
          <h1 className="font-display font-bold text-3xl text-white">{displayTitle}</h1>
          {selected.zone && type === 'ward' && (
            <p className="text-sm text-slate-500 font-body flex items-center justify-center gap-1">
              <MapPin size={12} /> {selected.zone} Zone
            </p>
          )}
        </div>

        {/* Week selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {history.map(d => (
            <button key={d.digest_id ?? d.week_start} onClick={() => setSelected(d)}
              className={`px-4 py-2 rounded-xl text-sm font-body font-medium whitespace-nowrap border transition-all shrink-0
                ${(selected.digest_id ?? selected.week_start) === (d.digest_id ?? d.week_start)
                  ? 'bg-primary-600 border-primary-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
              {format(new Date(d.week_start), 'MMM d')} – {format(new Date(d.week_end), 'MMM d')}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selected.digest_id ?? selected.week_start}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >

            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Issues',     value: selected.total_complaints    ?? 0,             color: 'text-slate-100' },
                { label: 'Resolved',         value: selected.resolved_complaints ?? 0,             color: 'text-green-400' },
                { label: 'Resolution Rate',  value: `${resRate.toFixed(0)}%`,                      color: 'text-primary-400' },
                { label: 'Health Score',     value: Number(selected.health_score_end ?? 0).toFixed(1), color: 'text-yellow-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <div className={`font-display font-bold text-3xl ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-400 font-body mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Secondary metrics row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pending',      value: selected.pending_complaints ?? Math.max(0, (selected.total_complaints ?? 0) - (selected.resolved_complaints ?? 0)) },
                { label: 'Avg Res. Time', value: selected.avg_resolution_hours ? `${Number(selected.avg_resolution_hours).toFixed(0)}h` : '—' },
                { label: 'Score Δ',      value: selected.score_change != null ? (Number(selected.score_change) >= 0 ? `+${Number(selected.score_change).toFixed(1)}` : Number(selected.score_change).toFixed(1)) : '—' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
                  <div className="font-display font-semibold text-xl text-slate-200">{s.value}</div>
                  <div className="text-xs text-slate-500 font-body mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Health score change badge */}
            {selected.score_change != null && (
              <div className={`flex items-center gap-2 text-sm font-body px-4 py-3 rounded-xl border
                ${Number(selected.score_change) >= 0
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                {Number(selected.score_change) >= 0 ? '📈' : '📉'}
                Health score {Number(selected.score_change) >= 0 ? 'improved' : 'declined'} by{' '}
                <strong>{Math.abs(Number(selected.score_change)).toFixed(1)} points</strong> this week
              </div>
            )}

            {/* AI Summary */}
            {selected.summary_en && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <p className="text-xs font-bold text-primary-400 font-body uppercase tracking-wider mb-3">
                  ✨ AI Generated Narrative
                </p>
                <p className="text-sm text-slate-300 font-body leading-relaxed whitespace-pre-line">
                  {selected.summary_en}
                </p>
              </div>
            )}

            {/* Achievements + Concerns */}
            {((selected.key_achievements?.length ?? 0) > 0 || (selected.areas_of_concern?.length ?? 0) > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {selected.key_achievements?.length > 0 && (
                  <div className="bg-slate-900 border border-green-500/20 rounded-2xl p-5">
                    <p className="text-xs font-bold text-green-400 font-body uppercase tracking-wider mb-3">
                      ✅ Key Achievements
                    </p>
                    <ul className="space-y-2">
                      {selected.key_achievements.map((a: string, i: number) => (
                        <li key={i} className="text-sm text-slate-300 font-body flex items-start gap-2">
                          <span className="text-green-500 mt-0.5 shrink-0">•</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.areas_of_concern?.length > 0 && (
                  <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5">
                    <p className="text-xs font-bold text-red-400 font-body uppercase tracking-wider mb-3">
                      ⚠️ Areas of Concern
                    </p>
                    <ul className="space-y-2">
                      {selected.areas_of_concern.map((c: string, i: number) => (
                        <li key={i} className="text-sm text-slate-300 font-body flex items-start gap-2">
                          <span className="text-red-400 mt-0.5 shrink-0">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Charts — Category + Urgency Pie */}
            {(catPieData.length > 0 || urgPieData.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {catPieData.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="font-display font-semibold text-white text-sm mb-4">Category Breakdown</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={catPieData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          } labelLine={false}>
                          {catPieData.map((_: any, i: number) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {urgPieData.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="font-display font-semibold text-white text-sm mb-4">Urgency Distribution</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={urgPieData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" outerRadius={70}>
                          {urgPieData.map((u: any, i: number) => (
                            <Cell key={i} fill={u.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Trend charts — only if multi-week history */}
            {trendData.length > 1 && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="font-display font-semibold text-white text-sm mb-4">
                    Historical Resolution Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={trendData} barGap={2}>
                      <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                      <Bar dataKey="resolved" fill="#22c55e" radius={[4, 4, 0, 0]} name="Resolved" />
                      <Bar dataKey="pending"  fill="#f43f5e" radius={[4, 4, 0, 0]} name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="font-display font-semibold text-white text-sm mb-4">
                      Health Score Progression
                    </h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={trendData}>
                        <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                        <Line type="monotone" dataKey="score" stroke="#facc15" strokeWidth={3}
                          dot={{ r: 5, fill: '#0f172a', strokeWidth: 2 }} name="Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="font-display font-semibold text-white text-sm mb-4">
                      Resolution Rate Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={trendData}>
                        <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} formatter={(v: any) => `${v}%`} />
                        <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={3}
                          dot={{ r: 5, fill: '#0f172a', strokeWidth: 2 }} name="Rate %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}