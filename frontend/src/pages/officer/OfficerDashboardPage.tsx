import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ClipboardList, CheckCircle, Clock, AlertTriangle,
  TrendingUp, MapPin, Bell, ChevronRight, Star, Zap
} from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { complaintsAPI, officerAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { CATEGORY_CONFIG, STATUS_CONFIG, URGENCY_CONFIG } from '@/types'
import { formatDistanceToNow, formatSLACountdown } from '@/lib/utils'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useNotifStore } from '@/stores/notificationStore'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: <span>🏠</span> },
  { to: '/officer/inbox',     label: 'Inbox',     icon: <span>📋</span> },
  { to: '/officer/digest',    label: 'Digest',    icon: <span>📊</span> },
  { to: '/officer/profile',   label: 'Profile',   icon: <span>👤</span> },
]

export function OfficerDashboardPage() {
  const navigate = useNavigate()
  const { fullName, userId } = useAuthStore()
  const { addNotification } = useNotifStore()
  const [perf, setPerf]       = useState<any>(null)
  const [recent, setRecent]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      officerAPI.performance(),
      complaintsAPI.inbox({ limit: 5 }),
    ]).then(([p, i]) => {
      setPerf(p.data)
      setRecent(i.data.complaints || [])
    }).catch(() => toast.error('Failed to load dashboard'))
    .finally(() => setLoading(false))
  }, [])

  const handleWS = useCallback((msg: any) => {
    if (msg.event === 'notification') {
      addNotification({ ...msg, notification_id: msg.notif_id, is_read: false, created_at: new Date().toISOString(), user_id: userId || '', user_role: 'officer' })
      toast(msg.title, { icon: '📋', duration: 5000 })
    }
  }, [addNotification, userId])
  useWebSocket(handleWS)

  const stats = [
    { label: 'Open',       value: perf?.open_count ?? 0,       icon: ClipboardList, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    { label: 'Resolved',   value: perf?.total_resolved ?? 0,    icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
    { label: 'This Week',  value: perf?.resolved_week ?? 0,     icon: TrendingUp,    color: 'text-primary-600', bg: 'bg-primary-50', border: 'border-primary-200' },
    { label: 'SLA Breach', value: perf?.breaches_total ?? 0,    icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  ]

  return (
    <AppShell navItems={NAV_ITEMS} role="officer">
      <div className="space-y-6">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4">
          <div>
            <p className="text-slate-500 text-sm font-body">Welcome back 👷</p>
            <h1 className="font-display font-bold text-2xl text-slate-900">
              {fullName?.split(' ')[0] || 'Officer'}
            </h1>
            {perf?.ward_name && (
              <p className="text-sm text-slate-500 font-body flex items-center gap-1 mt-0.5">
                <MapPin size={12} className="text-primary-500" />
                {perf.ward_name} · {perf.designation}
              </p>
            )}
          </div>

          {/* Performance score */}
          {perf?.performance_score && (
            <div className="text-center card p-3 min-w-[72px]">
              <div className="font-display font-bold text-2xl text-primary-700">
                {Math.round(perf.performance_score)}
              </div>
              <div className="text-[10px] text-slate-400 font-body">Score</div>
              <div className="flex justify-center gap-0.5 mt-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={10} className={s <= Math.round(perf.citizen_rating_avg || 0)
                    ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div key={s.label}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}
                className={`card p-4 border ${s.border} ${s.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className={s.color} />
                  <span className="text-xs text-slate-500 font-body">{s.label}</span>
                </div>
                <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
              </motion.div>
            )
          })}
        </div>

        {/* SLA compliance */}
        {perf?.sla_compliance_rate != null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-800 font-body flex items-center gap-2">
                <Zap size={16} className="text-amber-500" /> SLA Compliance
              </p>
              <span className={`font-display font-bold text-lg
                ${perf.sla_compliance_rate >= 80 ? 'text-green-600' :
                  perf.sla_compliance_rate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {Number(perf.sla_compliance_rate).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(perf.sla_compliance_rate, 100)}%` }}
                transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
                className={`h-2.5 rounded-full
                  ${perf.sla_compliance_rate >= 80 ? 'bg-green-500' :
                    perf.sla_compliance_rate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              />
            </div>
            <p className="text-xs text-slate-400 font-body mt-1.5">
              Avg rating: {Number(perf.avg_rating_live || perf.citizen_rating_avg || 0).toFixed(2)}/5
            </p>
          </motion.div>
        )}

        {/* Recent complaints */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-slate-800">Active Complaints</h2>
            <button onClick={() => navigate('/officer/inbox')}
              className="text-sm text-primary-600 font-body flex items-center gap-1">
              View all <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-slate-100" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-display font-semibold text-slate-700">All clear!</p>
              <p className="text-sm text-slate-400 font-body mt-1">No pending complaints right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((c, i) => {
                const catCfg = CATEGORY_CONFIG[c.category || 'other'] || CATEGORY_CONFIG.other
                const urgCfg = URGENCY_CONFIG[c.urgency || 'medium'] || URGENCY_CONFIG.medium
                const sla = c.sla_remaining_seconds != null ? formatSLACountdown(c.sla_remaining_seconds) : null
                return (
                  <motion.div key={c.complaint_id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => navigate(`/officer/complaint/${c.complaint_id}`)}
                    className="card p-4 flex gap-3 cursor-pointer hover:shadow-card-hover transition-all">
                    <div className={`w-12 h-12 rounded-2xl ${catCfg.color} flex items-center justify-center text-xl shrink-0`}>
                      {catCfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-800 text-sm font-body line-clamp-1 flex-1">
                          {c.title}
                        </p>
                        <span className={`badge text-[10px] shrink-0 ${urgCfg.bg} ${urgCfg.color}`}>
                          {urgCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-body mt-0.5 line-clamp-1">
                        {c.citizen_name} · {c.ward_name}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-body font-medium ${sla?.color || 'text-slate-400'}`}>
                          {c.sla_remaining_seconds != null
                            ? (c.sla_remaining_seconds <= 0 ? '🚨 Overdue' : `⏱ ${sla?.text}`)
                            : formatDistanceToNow(c.created_at)}
                        </span>
                        {c.photo_urls?.length > 0 && (
                          <span className="text-xs text-slate-400">📸 {c.photo_urls.length}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 self-center shrink-0" />
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🗺️', label: 'Ward Map', desc: 'All active issues', path: '/officer/inbox?view=map' },
            { icon: '📊', label: 'Weekly Digest', desc: 'Ward performance', path: '/officer/digest' },
          ].map(a => (
            <motion.button key={a.label} whileTap={{ scale: 0.97 }}
              onClick={() => navigate(a.path)}
              className="card p-4 text-left hover:shadow-card-hover transition-all">
              <div className="text-2xl mb-2">{a.icon}</div>
              <p className="font-semibold text-slate-800 text-sm font-body">{a.label}</p>
              <p className="text-xs text-slate-400 font-body">{a.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}