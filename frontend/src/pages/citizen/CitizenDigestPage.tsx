import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/common/AppShell'
import { citizenAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

const NAV_ITEMS = [
  { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
]

export function CitizenDigestPage() {
  const navigate = useNavigate()
  const { wardId } = useAuthStore()
  const [digests, setDigests]       = useState<any[]>([])
  const [selected, setSelected]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!wardId) return
    citizenAPI.wardDigest(wardId).then(r => {
      const d = r.data.digests || []
      setDigests(d)
      if (d.length) setSelected(d[0])
    }).finally(() => setLoading(false))
  }, [wardId])

  const trendData = digests.map((d: any) => ({
    week: new Date(d.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    score: Number(d.health_score_end || 0).toFixed(1),
    resolved: d.resolved_complaints,
    total: d.total_complaints,
  })).reverse()

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Ward Digest</h1>
            <p className="text-sm text-slate-400 font-body">Weekly civic health summary</p>
          </div>
          <button onClick={() => navigate('/digest')}
            className="text-sm text-primary-600 hover:text-primary-800 font-body">
            Full view →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="card h-32 animate-pulse bg-slate-100" />)}</div>
        ) : digests.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-display font-semibold text-slate-700">No digests yet</p>
            <p className="text-sm text-slate-400 font-body mt-1">Digests are generated weekly</p>
          </div>
        ) : (
          <>
            {/* Week selector */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {digests.map((d: any) => (
                <button key={d.digest_id} onClick={() => setSelected(d)}
                  className={`px-3 py-2 rounded-xl text-xs font-body whitespace-nowrap border-2 transition-all shrink-0
                    ${selected?.digest_id === d.digest_id
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                      : 'border-slate-200 text-slate-600'}`}>
                  {new Date(d.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </button>
              ))}
            </div>

            {selected && (
              <motion.div key={selected.digest_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4">
                {/* Header card */}
                <div className="card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-display font-bold text-lg text-slate-900">{selected.ward_name}</h2>
                      <p className="text-sm text-slate-400 font-body">
                        {formatDate(selected.week_start, 'short')} – {formatDate(selected.week_end, 'short')}
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display font-bold text-xl
                      ${Number(selected.health_score_end) >= 80 ? 'bg-green-100 text-green-700' :
                        Number(selected.health_score_end) >= 65 ? 'bg-blue-100 text-blue-700' :
                        Number(selected.health_score_end) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {Number(selected.health_score_end).toFixed(0)}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Reported', value: selected.total_complaints },
                      { label: 'Resolved', value: selected.resolved_complaints },
                      { label: 'Rate',     value: `${Number(selected.resolution_rate).toFixed(0)}%` },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                        <div className="font-display font-bold text-lg text-slate-900">{s.value}</div>
                        <div className="text-xs text-slate-400 font-body">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Score change */}
                  {selected.score_change !== undefined && (
                    <div className={`flex items-center gap-2 text-sm font-body px-3 py-2 rounded-xl
                      ${selected.score_change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {selected.score_change >= 0 ? '📈' : '📉'}
                      Health score {selected.score_change >= 0 ? 'improved' : 'declined'} by{' '}
                      {Math.abs(Number(selected.score_change)).toFixed(1)} points
                    </div>
                  )}
                </div>

                {/* AI Summary */}
                {selected.summary_en && (
                  <div className="card p-5">
                    <h3 className="font-display font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      🤖 AI Weekly Summary
                    </h3>
                    <p className="text-sm text-slate-600 font-body leading-relaxed">{selected.summary_en}</p>
                  </div>
                )}

                {/* Achievements & concerns */}
                <div className="grid md:grid-cols-2 gap-4">
                  {selected.key_achievements?.length > 0 && (
                    <div className="card p-4">
                      <h4 className="font-semibold text-green-700 text-sm mb-2">✅ Achievements</h4>
                      <ul className="space-y-1">
                        {selected.key_achievements.map((a: string, i: number) => (
                          <li key={i} className="text-xs text-slate-600 font-body flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5">•</span> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selected.areas_of_concern?.length > 0 && (
                    <div className="card p-4">
                      <h4 className="font-semibold text-red-600 text-sm mb-2">⚠️ Concerns</h4>
                      <ul className="space-y-1">
                        {selected.areas_of_concern.map((c: string, i: number) => (
                          <li key={i} className="text-xs text-slate-600 font-body flex items-start gap-1.5">
                            <span className="text-red-400 mt-0.5">•</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Trend chart */}
            {trendData.length > 1 && (
              <div className="card p-5">
                <h3 className="font-display font-semibold text-slate-800 mb-4">4-Week Health Trend</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: 'DM Sans' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}