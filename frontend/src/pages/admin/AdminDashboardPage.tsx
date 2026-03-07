import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, AlertTriangle, CheckCircle, Clock, Users,
  MapPin, BarChart3, ArrowRight, RefreshCw
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { adminAPI, analyticsAPI } from '@/lib/api'
import { CATEGORY_CONFIG } from '@/types'
import { formatNumber } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import toast from 'react-hot-toast'

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444'
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<any>(null)
  const [trends, setTrends]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [ov, tr] = await Promise.all([
        adminAPI.overview(),
        analyticsAPI.cityTrends(14),
      ])
      setOverview(ov.data)
      setTrends(tr.data.trends || [])
    } catch { toast.error('Failed to load overview') }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <AdminShell>
      <div className="space-y-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-28 rounded-2xl bg-slate-800/60 animate-pulse" />
        ))}
      </div>
    </AdminShell>
  )

  const stats = overview?.stats || {}
  const wardGrades: any[] = overview?.ward_grades || []
  const topCats: any[] = overview?.top_categories || []

  const trendData = trends.map((t: any) => ({
    day: new Date(t.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    total: t.total || 0,
    resolved: t.resolved || 0,
    breached: t.breached || 0,
  }))

  const STAT_CARDS = [
    {
      label: 'Total Complaints', value: formatNumber(stats.total_complaints || 0),
      sub: `+${stats.new_today || 0} today`, icon: '📋',
      color: 'border-slate-700', textColor: 'text-white',
    },
    {
      label: 'Active Open', value: formatNumber(stats.total_open || 0),
      sub: `${stats.overdue || 0} overdue`, icon: '⏳',
      color: 'border-amber-500/40', textColor: 'text-amber-300',
    },
    {
      label: 'Resolved Today', value: stats.resolved_today || 0,
      sub: `${stats.total_resolved || 0} total`, icon: '✅',
      color: 'border-green-500/40', textColor: 'text-green-300',
    },
    {
      label: 'Active Disputes', value: stats.active_disputes || 0,
      sub: 'Needs supervisor review', icon: '⚠️',
      color: 'border-red-500/40', textColor: 'text-red-300',
    },
    {
      label: 'Avg Citizen Rating', value: stats.avg_rating ? Number(stats.avg_rating).toFixed(1) + '★' : '—',
      sub: 'Out of 5.0', icon: '⭐',
      color: 'border-yellow-500/40', textColor: 'text-yellow-300',
    },
    {
      label: 'Active Alerts', value: overview?.active_alerts || 0,
      sub: 'Predictive intelligence', icon: '🔔',
      color: 'border-purple-500/40', textColor: 'text-purple-300',
    },
  ]

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-white">City Overview</h1>
            <p className="text-slate-400 text-sm font-body mt-0.5">MCD Delhi — 272 Wards</p>
          </div>
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700
                       text-slate-300 hover:text-white rounded-xl text-sm font-body transition-colors">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STAT_CARDS.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-slate-900 border ${s.color} rounded-2xl p-4`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`font-display font-bold text-2xl ${s.textColor}`}>{s.value}</div>
              <div className="text-xs text-slate-300 font-body font-semibold mt-0.5">{s.label}</div>
              <div className="text-[10px] text-slate-500 font-body mt-0.5">{s.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Trend chart */}
        {trendData.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-display font-semibold text-white mb-4 text-sm">14-Day Complaint Trend</h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'DM Sans' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#totalGrad)" strokeWidth={2} name="Total" />
                <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="url(#resolvedGrad)" strokeWidth={2} name="Resolved" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bottom row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Ward grades */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-sm">Ward Grade Distribution</h2>
              <button onClick={() => navigate('/admin/heatmap')}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-body">
                View Map <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2.5">
              {wardGrades.map((g: any) => (
                <div key={g.health_grade} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ background: `${GRADE_COLORS[g.health_grade]}20`, color: GRADE_COLORS[g.health_grade] }}>
                    {g.health_grade}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-400 font-body">Grade {g.health_grade}</span>
                      <span className="text-xs text-slate-300 font-semibold font-body">{g.count} wards</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${(g.count / 272) * 100}%`,
                          background: GRADE_COLORS[g.health_grade]
                        }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top categories */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-sm">Top Issues (7 days)</h2>
              <button onClick={() => navigate('/admin/analytics')}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-body">
                Analytics <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {topCats.map((c: any, i: number) => {
                const cfg = CATEGORY_CONFIG[c.category] || CATEGORY_CONFIG.other
                const max = topCats[0]?.count || 1
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center">{cfg.icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-slate-300 font-body">{cfg.label}</span>
                        <span className="text-xs text-slate-400 font-body">{c.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary-500 transition-all"
                          style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div >
        </div>
      </div>
    </AdminShell>
  )
}