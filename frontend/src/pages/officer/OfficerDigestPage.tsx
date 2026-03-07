import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/common/AppShell'
import { citizenAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'

const NAV_ITEMS = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: <span>🏠</span> },
  { to: '/officer/inbox',     label: 'Inbox',     icon: <span>📋</span> },
  { to: '/officer/digest',    label: 'Digest',    icon: <span>📊</span> },
  { to: '/officer/profile',   label: 'Profile',   icon: <span>👤</span> },
]

const PIE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#f43f5e','#8b5cf6','#06b6d4']

export function OfficerDigestPage() {
  const navigate  = useNavigate()
  const { wardId } = useAuthStore()
  const [digests, setDigests]   = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!wardId) return
    citizenAPI.wardDigest(wardId).then(r => {
      const d = r.data.digests || []
      setDigests(d)
      if (d.length) setSelected(d[0])
    }).finally(() => setLoading(false))
  }, [wardId])

  const trendData = digests.map((d: any) => ({
    week: new Date(d.week_start).toLocaleDateString('en-IN', { day:'numeric', month:'short' }),
    resolved: d.resolved_complaints,
    total: d.total_complaints,
    rate: Number(d.resolution_rate || 0).toFixed(1),
    score: Number(d.health_score_end || 0).toFixed(1),
  })).reverse()

  return (
    <AppShell navItems={NAV_ITEMS} role="officer">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-slate-900">Ward Digest</h1>
            <p className="text-sm text-slate-400 font-body">Weekly performance summary</p>
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
                  {new Date(d.week_start).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                </button>
              ))}
            </div>

            {selected && (
              <motion.div key={selected.digest_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Complaints', value: selected.total_complaints, icon: '📋', color: 'text-slate-700' },
                    { label: 'Resolved',   value: selected.resolved_complaints, icon: '✅', color: 'text-green-700' },
                    { label: 'Rate',       value: `${Number(selected.resolution_rate).toFixed(0)}%`, icon: '📈', color: 'text-primary-700' },
                    { label: 'Avg Hours',  value: `${Number(selected.avg_resolution_hours || 0).toFixed(0)}h`, icon: '⏱', color: 'text-amber-700' },
                  ].map(s => (
                    <div key={s.label} className="card p-4 text-center">
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className={`font-display font-bold text-xl ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-slate-400 font-body">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Health delta */}
                {selected.score_change !== undefined && (
                  <div className={`card p-3 flex items-center gap-2 text-sm font-body
                    ${selected.score_change >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                    style={{ border: '1px solid' }}>
                    {selected.score_change >= 0 ? '📈' : '📉'}
                    Health score {selected.score_change >= 0 ? 'improved' : 'declined'} by{' '}
                    {Math.abs(Number(selected.score_change)).toFixed(1)} pts this week
                  </div>
                )}

                {/* AI Summary */}
                {selected.summary_en && (
                  <div className="card p-4">
                    <h3 className="font-display font-semibold text-slate-800 mb-2 text-sm flex items-center gap-1">
                      🤖 AI Summary
                    </h3>
                    <p className="text-sm text-slate-600 font-body leading-relaxed">{selected.summary_en}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Trend charts */}
            {trendData.length > 1 && (
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="font-display font-semibold text-slate-800 mb-4 text-sm">Resolution Trend</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={trendData}>
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="resolved" fill="#22c55e" radius={[4,4,0,0]} name="Resolved" />
                      <Bar dataKey="total" fill="#e2e8f0" radius={[4,4,0,0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card p-5">
                  <h3 className="font-display font-semibold text-slate-800 mb-4 text-sm">Health Score Trend</h3>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={trendData}>
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}