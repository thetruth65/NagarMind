import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, MapPin, Star, TrendingUp, Award, Shield } from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { officerAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { initials, getAvatarColor, gradeColor, gradeBg } from '@/lib/utils'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'

const NAV_ITEMS = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: <span>🏠</span> },
  { to: '/officer/inbox',     label: 'Inbox',     icon: <span>📋</span> },
  { to: '/officer/digest',    label: 'Digest',    icon: <span>📊</span> },
  { to: '/officer/profile',   label: 'Profile',   icon: <span>👤</span> },
]

export function OfficerProfilePage() {
  const { fullName } = useAuthStore()
  const [perf, setPerf]             = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      officerAPI.performance(),
      officerAPI.leaderboard(),
    ]).then(([p, l]) => {
      setPerf(p.data)
      setLeaderboard(l.data.leaderboard || [])
    }).finally(() => setLoading(false))
  }, [])

  const name = perf?.full_name || fullName || ''
  const [bg, fg] = getAvatarColor(name)

  const radarData = perf ? [
    { subject: 'SLA', A: perf.sla_compliance_rate || 0 },
    { subject: 'Rating', A: ((perf.citizen_rating_avg || 0) / 5) * 100 },
    { subject: 'Resolved', A: Math.min((perf.total_resolved / Math.max(perf.total_assigned, 1)) * 100, 100) },
    { subject: 'Speed', A: Math.max(0, 100 - (perf.breaches_total || 0) * 5) },
    { subject: 'Active', A: perf.open_count > 0 ? Math.max(20, 100 - perf.open_count * 3) : 100 },
  ] : []

  const PERF_COLOR = (score: number) =>
    score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444'

  if (loading) return (
    <AppShell navItems={NAV_ITEMS} role="officer">
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="card h-28 animate-pulse bg-slate-100" />)}
      </div>
    </AppShell>
  )

  return (
    <AppShell navItems={NAV_ITEMS} role="officer">
      <div className="space-y-5 max-w-lg mx-auto">
        {/* Avatar + info */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="card p-6 text-center">
          <div className="flex justify-center mb-4">
            <div style={{ background: bg, color: fg }}
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-display font-bold shadow-sm">
              {initials(name)}
            </div>
          </div>
          <h2 className="font-display font-bold text-xl text-slate-900">{name}</h2>
          <p className="text-slate-400 font-body text-sm">{perf?.designation}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {perf?.ward_name && (
              <span className="badge bg-primary-50 text-primary-700 flex items-center gap-1">
                <MapPin size={10} /> {perf.ward_name}
              </span>
            )}
            {perf?.department && (
              <span className="badge bg-slate-100 text-slate-600">{perf.department}</span>
            )}
            {perf?.employee_id && (
              <span className="badge bg-slate-100 text-slate-500 font-mono text-[10px]">{perf.employee_id}</span>
            )}
          </div>
        </motion.div>

        {/* Performance score */}
        {perf?.performance_score && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2">
                <Award size={16} className="text-amber-500" /> Performance Score
              </h3>
              <span className="font-display font-bold text-2xl"
                style={{ color: PERF_COLOR(perf.performance_score) }}>
                {Math.round(perf.performance_score)}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(perf.performance_score, 100)}%` }}
                transition={{ delay: 0.4, duration: 1, ease: 'easeOut' }}
                className="h-3 rounded-full"
                style={{ background: PERF_COLOR(perf.performance_score) }}
              />
            </div>
            <div className="flex items-center gap-1 mt-2 justify-center">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={16}
                  className={s <= Math.round(perf.citizen_rating_avg || 0)
                    ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
              ))}
              <span className="text-sm text-slate-500 font-body ml-1">
                {Number(perf.citizen_rating_avg || 0).toFixed(2)} avg rating
              </span>
            </div>
          </motion.div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Assigned', value: perf?.total_assigned ?? 0,     icon: '📋', color: 'text-slate-700' },
            { label: 'Total Resolved', value: perf?.total_resolved ?? 0,     icon: '✅', color: 'text-green-700' },
            { label: 'Currently Open', value: perf?.open_count ?? 0,         icon: '⏳', color: 'text-amber-700' },
            { label: 'This Week',      value: perf?.resolved_week ?? 0,      icon: '🔥', color: 'text-primary-700' },
            { label: 'SLA Breaches',   value: perf?.breaches_total ?? 0,     icon: '🚨', color: 'text-red-700' },
            { label: 'SLA Compliance', value: `${Number(perf?.sla_compliance_rate || 0).toFixed(1)}%`, icon: '⚡', color: 'text-teal-700' },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i }}
              className="card p-4">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`font-display font-bold text-xl ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400 font-body">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Radar chart */}
        {radarData.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="card p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-600" /> Performance Radar
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                <Radar name="Score" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Ward leaderboard */}
        {leaderboard.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="card p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Shield size={16} className="text-primary-600" /> Ward Leaderboard
            </h3>
            <div className="space-y-2.5">
              {leaderboard.slice(0, 5).map((o, i) => {
                const isMe = o.full_name === name
                return (
                  <div key={o.officer_id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors
                      ${isMe ? 'bg-primary-50 border border-primary-200' : ''}`}>
                    <span className="w-6 text-center font-display font-bold text-sm text-slate-400">
                      {i + 1}
                    </span>
                    <div style={{ background: getAvatarColor(o.full_name)[0], color: getAvatarColor(o.full_name)[1] }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold font-display shrink-0">
                      {initials(o.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold font-body truncate ${isMe ? 'text-primary-700' : 'text-slate-700'}`}>
                        {o.full_name} {isMe && '(you)'}
                      </p>
                      <p className="text-xs text-slate-400 font-body">{o.designation}</p>
                    </div>
                    <span className="font-display font-bold text-sm text-slate-700">
                      {Math.round(o.performance_score || 0)}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}