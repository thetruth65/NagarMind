import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, CheckCircle, Clock, Bell, RefreshCw,
  ChevronDown, ChevronUp, X, Loader2, Zap,
  ArrowLeft
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { adminAPI } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-400',   bg: 'bg-red-500/10  border-red-500/30',   dot: 'bg-red-500'    },
  high:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',  dot: 'bg-amber-500'  },
  low:      { label: 'Low',      color: 'text-blue-400',   bg: 'bg-blue-500/10  border-blue-500/30',   dot: 'bg-blue-500'   },
}

const ALERT_TYPE_ICON: Record<string, string> = {
  surge:          '📈',
  sla_breach:     '⏰',
  ward_neglect:   '🏚️',
  category_spike: '🔺',
  officer_overload:'👷',
  inactivity:     '😴',
}

export function AdminAlertsPage() {
  const [alerts, setAlerts]       = useState<any[]>([])
  const navigate = useNavigate()
  const [loading, setLoading]     = useState(true)
  const [scanning, setScanning]   = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'active' | 'resolved'>('active')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await adminAPI.alerts()
      setAlerts(data.alerts || [])
    } catch { toast.error('Failed to load alerts') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resolve = async (alertId: string) => {
    setResolving(alertId)
    try {
      await adminAPI.resolveAlert(alertId)
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, is_resolved: true, resolved_at: new Date().toISOString() } : a))
      toast.success('Alert resolved')
    } catch { toast.error('Failed to resolve') }
    finally { setResolving(null) }
  }

  const scan = async () => {
    setScanning(true)
    try {
      await adminAPI.scanAlerts()
      await load()
      toast.success('Alert scan complete')
    } catch { toast.error('Scan failed') }
    finally { setScanning(false) }
  }

  const filtered = alerts.filter(a => {
    if (filter === 'active')   return !a.is_resolved
    if (filter === 'resolved') return a.is_resolved
    return true
  })

  const activeCount   = alerts.filter(a => !a.is_resolved).length
  const criticalCount = alerts.filter(a => !a.is_resolved && a.severity === 'critical').length

  return (
    <AdminShell>
      <div className="space-y-5">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
              Predictive Alerts
              {activeCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400
                                 rounded-full text-sm font-body font-bold">
                  {activeCount}
                </span>
              )}
            </h1>
            <p className="text-slate-400 text-sm font-body mt-0.5">AI-powered early warning system</p>
          </div>
          <button onClick={scan} disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600/20 border border-primary-500/30
                       text-primary-300 hover:bg-primary-600/30 rounded-xl text-sm font-body transition-colors">
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Alerts',    value: activeCount,   color: 'text-red-400',    bg: 'border-red-500/30'    },
            { label: 'Critical',         value: criticalCount, color: 'text-orange-400', bg: 'border-orange-500/30' },
            { label: 'Resolved (all)',   value: alerts.filter(a => a.is_resolved).length, color: 'text-green-400', bg: 'border-green-500/30' },
            { label: 'Total Generated',  value: alerts.length, color: 'text-slate-300',  bg: 'border-slate-600'     },
          ].map(c => (
            <div key={c.label} className={`bg-slate-900 border ${c.bg} rounded-2xl p-4`}>
              <div className={`font-display font-bold text-3xl ${c.color}`}>{c.value}</div>
              <div className="text-xs text-slate-400 font-body mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['active','all','resolved'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-sm font-body font-semibold capitalize transition-all
                ${filter === f
                  ? 'bg-primary-600/20 border-2 border-primary-500/40 text-primary-300'
                  : 'bg-slate-800 border-2 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-800/60 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-slate-300 font-semibold font-body">
              {filter === 'active' ? 'No active alerts!' : 'No alerts found'}
            </p>
            <p className="text-slate-500 text-sm font-body mt-1">City is running smoothly</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert) => {
              const sev = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.low
              const isExpanded = expanded === alert.alert_id
              return (
                <motion.div key={alert.alert_id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all
                    ${alert.is_resolved ? 'border-slate-700 opacity-60' : `border ${sev.bg.split(' ')[1]}`}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl ${sev.bg} border flex items-center justify-center flex-shrink-0 text-sm`}>
                        {ALERT_TYPE_ICON[alert.alert_type] || '⚠️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-xs font-bold font-body uppercase tracking-wider ${sev.color}`}>
                            {sev.label}
                          </span>
                          <span className="text-xs text-slate-500 font-body">
                            {alert.alert_type?.replace(/_/g, ' ')}
                          </span>
                          {alert.is_resolved && (
                            <span className="text-xs text-green-400 font-body flex items-center gap-1">
                              <CheckCircle size={10} /> Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-200 font-body font-semibold leading-snug">
                          {alert.title}
                        </p>
                        <p className="text-xs text-slate-500 font-body mt-0.5">
                          {alert.ward_name || 'City-wide'} ·{' '}
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!alert.is_resolved && (
                          <button onClick={() => resolve(alert.alert_id)} disabled={!!resolving}
                            className="px-3 py-1.5 bg-green-600/20 border border-green-500/30 text-green-400
                                       hover:bg-green-600/30 rounded-xl text-xs font-body transition-colors
                                       flex items-center gap-1">
                            {resolving === alert.alert_id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <CheckCircle size={12} />}
                            Resolve
                          </button>
                        )}
                        <button onClick={() => setExpanded(isExpanded ? null : alert.alert_id)}
                          className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
                          {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden border-t border-slate-800">
                        <div className="p-4 space-y-3">
                          <p className="text-sm text-slate-300 font-body leading-relaxed">
                            {alert.description}
                          </p>
                          {alert.metadata && (
                            <div className="bg-slate-800/60 rounded-xl p-3 grid grid-cols-2 gap-2">
                              {Object.entries(alert.metadata).map(([k, v]) => (
                                <div key={k}>
                                  <p className="text-[10px] text-slate-500 font-body capitalize">{k.replace(/_/g, ' ')}</p>
                                  <p className="text-xs text-slate-200 font-body font-semibold">{String(v)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {alert.is_resolved && alert.resolved_at && (
                            <p className="text-xs text-green-400 font-body flex items-center gap-1">
                              <CheckCircle size={11} />
                              Resolved {formatDistanceToNow(new Date(alert.resolved_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </AdminShell>
  )
}