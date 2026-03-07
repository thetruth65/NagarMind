import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, RefreshCw } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { analyticsAPI } from '@/lib/api'
import { CATEGORY_CONFIG } from '@/types'
import { downloadBlob } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, Radar
} from 'recharts'
import toast from 'react-hot-toast'

const ZONE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#f43f5e','#8b5cf6','#ec4899','#14b8a6']

export function AdminAnalyticsPage() {
  const [days, setDays]         = useState(30)
  const navigate = useNavigate()
  const [trends, setTrends]     = useState<any[]>([])
  const [breakdown, setBreakdown] = useState<any[]>([])
  const [zones, setZones]       = useState<any[]>([])
  const [officers, setOfficers] = useState<any[]>([])
  const [worstWards, setWorstWards] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [tr, br, zn, of_, ww] = await Promise.all([
        analyticsAPI.cityTrends(days),
        analyticsAPI.categoryBreakdown(days),
        analyticsAPI.zoneComparison(),
        analyticsAPI.officerLeaderboard(10),
        analyticsAPI.worstWards(8),
      ])
      setTrends(tr.data.trends || [])
      setBreakdown(br.data.breakdown || [])
      setZones(zn.data.zones || [])
      setOfficers(of_.data.officers || [])
      setWorstWards(ww.data.wards || [])
    } catch { toast.error('Failed to load analytics') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [days])

  const exportCSV = async () => {
    setExporting(true)
    try {
      const { data } = await analyticsAPI.exportComplaints(days)
      downloadBlob(data, `nagarmind_complaints_${days}d.csv`)
      toast.success('CSV downloaded!')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  // Aggregate breakdown by category
  const catData = Object.values(
    breakdown.reduce((acc: any, row: any) => {
      if (!acc[row.category]) acc[row.category] = { category: row.category, total: 0, resolved: 0, breaches: 0 }
      acc[row.category].total += row.total
      acc[row.category].resolved += row.resolved
      acc[row.category].breaches += row.breaches
      return acc
    }, {})
  ).map((c: any) => ({
    ...c,
    label: CATEGORY_CONFIG[c.category]?.label || c.category,
    icon: CATEGORY_CONFIG[c.category]?.icon || '📋',
    rate: c.total > 0 ? Math.round((c.resolved / c.total) * 100) : 0,
  })).sort((a: any, b: any) => b.total - a.total).slice(0, 7) as any[]

  const trendData = trends.map((t: any) => ({
    day: new Date(t.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    total: t.total, resolved: t.resolved, breached: t.breached,
    rate: t.total > 0 ? Math.round((t.resolved / t.total) * 100) : 0,
  }))

  const zoneRadarData = zones.map((z: any) => ({
    zone: z.zone?.replace(/-/g, '\n') || z.zone,
    health: Number(z.avg_health_score || 0).toFixed(0),
    resolved: z.resolved || 0,
  }))

  return (
    <AdminShell>
      <div className="space-y-6">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl text-white">City Analytics</h1>
            <p className="text-slate-400 text-sm font-body">Deep-dive intelligence across all 272 wards</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Days filter */}
            <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
              {[7, 14, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-all
                    ${days === d ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={exportCSV} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700
                         text-slate-300 hover:text-white rounded-xl text-sm font-body transition-colors">
              <Download size={14} /> {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-48 rounded-2xl bg-slate-800/60 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Trend chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-display font-semibold text-white text-sm mb-4">
                Daily Volume & Resolution Rate ({days} days)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'DM Sans' }} />
                  <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 9 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 9 }} unit="%" />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }} />
                  <Line yAxisId="left" type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
                  <Line yAxisId="left" type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} dot={false} name="Resolved" />
                  <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Rate %" strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Category breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="font-display font-semibold text-white text-sm mb-4">Category Breakdown</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={catData} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} />
                    <YAxis type="category" dataKey="label" width={100}
                      tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'DM Sans' }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total" />
                    <Bar dataKey="resolved" fill="#22c55e" radius={[0, 4, 4, 0]} name="Resolved" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Zone comparison */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="font-display font-semibold text-white text-sm mb-4">Zone Comparison</h2>
                <div className="space-y-2.5">
                  {zones.slice(0, 7).map((z: any, i: number) => {
                    const total = z.total_complaints || 0
                    const resolved = z.resolved || 0
                    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0
                    return (
                      <div key={z.zone}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-300 font-body">{z.zone}</span>
                          <span className="text-xs text-slate-400 font-body">{rate}% · Avg {Number(z.avg_health_score || 0).toFixed(0)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${rate}%`, background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Officer leaderboard */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="font-display font-semibold text-white text-sm mb-4">Top Officers</h2>
                <div className="space-y-2">
                  {officers.slice(0, 8).map((o: any, i: number) => (
                    <div key={o.officer_id} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold
                        ${i === 0 ? 'bg-yellow-500/20 text-yellow-300' :
                          i === 1 ? 'bg-slate-400/20 text-slate-300' :
                          i === 2 ? 'bg-amber-700/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 font-body font-semibold truncate">{o.full_name}</p>
                        <p className="text-[10px] text-slate-500 font-body">{o.ward_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-green-400">{o.total_resolved}</p>
                        <p className="text-[10px] text-slate-500 font-body">resolved</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worst wards */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="font-display font-semibold text-white text-sm mb-4">⚠️ Worst Performing Wards</h2>
                <div className="space-y-2">
                  {worstWards.map((w: any, i: number) => (
                    <div key={w.ward_id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold bg-red-500/20 text-red-400">
                        {w.health_grade}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 font-body font-semibold truncate">{w.ward_name}</p>
                        <p className="text-[10px] text-slate-500 font-body">{w.zone} · {w.open_count} open</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-400">{Number(w.health_score).toFixed(0)}</p>
                        <p className="text-[10px] text-slate-500 font-body">/100</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}