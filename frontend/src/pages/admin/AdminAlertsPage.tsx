/**
 * NagarMind v2 — AdminAlertsPage.tsx (FULL REPLACEMENT)
 * Manual broadcast alerts — admin picks ward/zone/city and sends message.
 * Replaces the auto-predictive alerts UI entirely.
 *
 * Place at: frontend/src/pages/admin/AdminAlertsPage.tsx (replace existing)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Bell, Send, Loader2, CheckCircle,
  ChevronDown, ChevronUp, Users, Building, Globe,
  AlertTriangle, Info, X
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { api, adminAPI } from '@/lib/api'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Ward { ward_id: number; ward_name: string; zone: string }
interface ZoneMap { [zone: string]: Ward[] }

interface BroadcastHistory {
  alert_id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  scope: string
  sent_at: string
  recipient_count: number
  zone_name?: string
  sent_by?: string
}

const SEVERITY_CONFIG = {
  info:     { label: 'Info',     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',     icon: <Info size={14} /> },
  warning:  { label: 'Warning',  color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',   icon: <AlertTriangle size={14} /> },
  critical: { label: 'Critical', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',       icon: <Bell size={14} /> },
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AdminAlertsPage() {
  const navigate = useNavigate()

  // Form state
  const [title, setTitle]           = useState('')
  const [message, setMessage]       = useState('')
  const [severity, setSeverity]     = useState<'info' | 'warning' | 'critical'>('info')
  const [scope, setScope]           = useState<'ward' | 'zone' | 'city'>('ward')
  const [selectedWards, setSelectedWards] = useState<number[]>([])
  const [selectedZone, setSelectedZone]   = useState('')

  // Data
  const [wards, setWards]           = useState<Ward[]>([])
  const [zones, setZones]           = useState<ZoneMap>({})
  const [history, setHistory]       = useState<BroadcastHistory[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [sending, setSending]       = useState(false)
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  // Ward search
  const [wardSearch, setWardSearch] = useState('')
  const [expandedZone, setExpandedZone] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/broadcast/wards'),
      api.get('/api/admin/broadcast/history'),
    ]).then(([wRes, hRes]) => {
      setWards(wRes.data.wards || [])
      setZones(wRes.data.zones || {})
      setHistory(hRes.data.alerts || [])
    }).catch(() => toast.error('Failed to load data'))
    .finally(() => setLoadingData(false))
  }, [])

  const filteredWards = wardSearch
    ? wards.filter(w =>
        w.ward_name.toLowerCase().includes(wardSearch.toLowerCase()) ||
        w.zone.toLowerCase().includes(wardSearch.toLowerCase()))
    : wards

  const toggleWard = (wardId: number) => {
    setSelectedWards(prev =>
      prev.includes(wardId) ? prev.filter(id => id !== wardId) : [...prev, wardId]
    )
  }

  const selectAllZone = (zone: string) => {
    const zoneWardIds = (zones[zone] || []).map(w => w.ward_id)
    const allSelected = zoneWardIds.every(id => selectedWards.includes(id))
    if (allSelected) {
      setSelectedWards(prev => prev.filter(id => !zoneWardIds.includes(id)))
    } else {
      setSelectedWards(prev => [...new Set([...prev, ...zoneWardIds])])
    }
  }

  const estimatedRecipients = () => {
    if (scope === 'city') return wards.length * 10 // rough estimate
    if (scope === 'zone') {
      const zoneWards = (zones[selectedZone] || []).length
      return zoneWards * 10
    }
    return selectedWards.length * 10
  }

  const canSend = () => {
    if (!title.trim() || !message.trim()) return false
    if (scope === 'ward') return selectedWards.length > 0
    if (scope === 'zone') return !!selectedZone
    return true // city
  }

  const send = async () => {
    if (!canSend() || sending) return
    setSending(true)
    try {
      const { data } = await api.post('/api/admin/broadcast/send', {
        title: title.trim(),
        message: message.trim(),
        severity,
        scope,
        ward_ids: scope === 'ward' ? selectedWards : [],
        zone_name: scope === 'zone' ? selectedZone : null,
      })

      toast.success(`Alert sent to ${data.recipient_count} users!`)

      // Reset form
      setTitle('')
      setMessage('')
      setSelectedWards([])
      setSelectedZone('')
      setSeverity('info')
      setScope('ward')

      // Refresh history
      const hRes = await api.get('/api/admin/broadcast/history')
      setHistory(hRes.data.alerts || [])

    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to send alert')
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6 max-w-4xl">

        {/* Back */}
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors
                     text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>

        {/* Page header */}
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
            <Bell className="text-primary-400" size={22} />
            Send Alert Broadcast
          </h1>
          <p className="text-slate-400 text-sm font-body mt-1">
            Manually send targeted alerts to citizens and officers in selected wards, zones, or city-wide.
          </p>
        </div>

        {/* ── COMPOSE FORM ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">

          {/* Title */}
          <div>
            <label className="text-sm font-semibold text-slate-300 font-body block mb-1.5">
              Alert Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Water supply disruption in Rohini Zone"
              maxLength={100}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl
                         outline-none focus:border-primary-500 font-body text-sm placeholder:text-slate-600"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-semibold text-slate-300 font-body block mb-1.5">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write the full alert message for citizens and officers..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl
                         outline-none focus:border-primary-500 font-body text-sm placeholder:text-slate-600 resize-none"
            />
            <p className="text-xs text-slate-600 font-body mt-1">{message.length}/500</p>
          </div>

          {/* Severity */}
          <div>
            <label className="text-sm font-semibold text-slate-300 font-body block mb-2">Severity</label>
            <div className="flex gap-2">
              {(['info', 'warning', 'critical'] as const).map(s => {
                const cfg = SEVERITY_CONFIG[s]
                return (
                  <button key={s}
                    onClick={() => setSeverity(s)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold
                                font-body transition-all ${cfg.bg}
                                ${severity === s ? `${cfg.color} border-current/60` : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                    {cfg.icon}
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scope selector */}
          <div>
            <label className="text-sm font-semibold text-slate-300 font-body block mb-2">Target Scope</label>
            <div className="flex gap-2">
              {[
                { id: 'ward', label: 'Specific Wards', icon: <Building size={14} /> },
                { id: 'zone', label: 'Entire Zone',    icon: <Users size={14} /> },
                { id: 'city', label: 'Entire City',    icon: <Globe size={14} /> },
              ].map(({ id, label, icon }) => (
                <button key={id}
                  onClick={() => { setScope(id as any); setSelectedWards([]); setSelectedZone('') }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold font-body transition-all
                    ${scope === id
                      ? 'bg-primary-600/20 border-primary-500/60 text-primary-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Ward picker */}
          {scope === 'ward' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-300 font-body">
                  Select Wards {selectedWards.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-primary-600/20 border border-primary-500/30
                                     text-primary-400 rounded-full text-xs font-mono">
                      {selectedWards.length} selected
                    </span>
                  )}
                </label>
                {selectedWards.length > 0 && (
                  <button onClick={() => setSelectedWards([])}
                    className="text-xs text-slate-500 hover:text-slate-300 font-body flex items-center gap-1">
                    <X size={12} /> Clear all
                  </button>
                )}
              </div>

              {/* Ward search */}
              <input
                type="text"
                value={wardSearch}
                onChange={e => setWardSearch(e.target.value)}
                placeholder="Search ward or zone..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl
                           outline-none focus:border-primary-500 font-body text-sm placeholder:text-slate-600"
              />

              {/* Ward list — grouped by zone */}
              <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-2">
                {wardSearch ? (
                  /* Flat search results */
                  filteredWards.slice(0, 30).map(w => (
                    <button key={w.ward_id}
                      onClick={() => toggleWard(w.ward_id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-body transition-all flex items-center gap-2
                        ${selectedWards.includes(w.ward_id)
                          ? 'bg-primary-600/20 border border-primary-500/40 text-primary-300'
                          : 'text-slate-400 hover:bg-slate-800 border border-transparent'}`}>
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0
                        ${selectedWards.includes(w.ward_id) ? 'bg-primary-600' : 'bg-slate-700 border border-slate-600'}`}>
                        {selectedWards.includes(w.ward_id) && <CheckCircle size={10} className="text-white" />}
                      </div>
                      <span className="flex-1 truncate">{w.ward_name}</span>
                      <span className="text-slate-600 text-xs">{w.zone}</span>
                    </button>
                  ))
                ) : (
                  /* Grouped by zone */
                  Object.entries(zones).sort().map(([zone, zoneWards]) => {
                    const allSelected = zoneWards.every(w => selectedWards.includes(w.ward_id))
                    const someSelected = zoneWards.some(w => selectedWards.includes(w.ward_id))
                    const isExpanded = expandedZone === zone

                    return (
                      <div key={zone} className="border border-slate-800 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60">
                          <button
                            onClick={() => selectAllZone(zone)}
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors
                              ${allSelected ? 'bg-primary-600' : someSelected ? 'bg-primary-600/50' : 'bg-slate-700 border border-slate-600'}`}>
                            {(allSelected || someSelected) && <CheckCircle size={10} className="text-white" />}
                          </button>
                          <span className="flex-1 text-slate-200 text-sm font-semibold font-body">{zone} Zone</span>
                          <span className="text-slate-500 text-xs font-body">{zoneWards.length} wards</span>
                          {someSelected && (
                            <span className="text-primary-400 text-xs font-mono">
                              {zoneWards.filter(w => selectedWards.includes(w.ward_id)).length} selected
                            </span>
                          )}
                          <button onClick={() => setExpandedZone(isExpanded ? null : zone)}
                            className="text-slate-500 hover:text-slate-300 ml-1">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                              className="overflow-hidden">
                              <div className="p-2 grid grid-cols-2 gap-1">
                                {zoneWards.map(w => (
                                  <button key={w.ward_id}
                                    onClick={() => toggleWard(w.ward_id)}
                                    className={`text-left px-2 py-1.5 rounded-lg text-xs font-body transition-all flex items-center gap-1.5
                                      ${selectedWards.includes(w.ward_id)
                                        ? 'bg-primary-600/20 text-primary-300'
                                        : 'text-slate-400 hover:bg-slate-800'}`}>
                                    <div className={`w-3 h-3 rounded shrink-0
                                      ${selectedWards.includes(w.ward_id) ? 'bg-primary-600' : 'bg-slate-700'}`} />
                                    <span className="truncate">{w.ward_name}</span>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Zone picker */}
          {scope === 'zone' && (
            <div>
              <label className="text-sm font-semibold text-slate-300 font-body block mb-2">Select Zone</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.keys(zones).sort().map(zone => (
                  <button key={zone}
                    onClick={() => setSelectedZone(zone)}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold font-body transition-all text-left
                      ${selectedZone === zone
                        ? 'bg-primary-600/20 border-primary-500/60 text-primary-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                    <p>{zone} Zone</p>
                    <p className="text-xs text-slate-500 mt-0.5">{(zones[zone] || []).length} wards</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* City scope info */}
          {scope === 'city' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <p className="text-amber-300 text-sm font-semibold font-body flex items-center gap-2">
                <Globe size={14} /> City-wide broadcast
              </p>
              <p className="text-amber-400/70 text-xs font-body mt-0.5">
                This will notify all ~{wards.length * 10}+ registered users across all 272 wards.
              </p>
            </div>
          )}

          {/* Preview + Send */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              {canSend() && (
                <p className="text-xs text-slate-400 font-body">
                  Estimated recipients: ~<span className="text-primary-400 font-semibold">{estimatedRecipients().toLocaleString()}</span> users
                </p>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={send}
              disabled={!canSend() || sending}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500
                         disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold
                         rounded-xl font-body text-sm transition-all shadow-glow-blue disabled:shadow-none">
              {sending
                ? <><Loader2 size={16} className="animate-spin" /> Sending...</>
                : <><Send size={16} /> Send Alert</>}
            </motion.button>
          </div>
        </div>

        {/* ── HISTORY ── */}
        <div>
          <h2 className="font-display font-semibold text-lg text-white mb-4 flex items-center gap-2">
            <Bell size={16} className="text-slate-400" /> Sent Alerts
          </h2>

          {loadingData ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-800/60 animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
              <Bell size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-body">No alerts sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(alert => {
                const sevCfg = SEVERITY_CONFIG[alert.severity]
                const isExp = expandedAlert === alert.alert_id
                return (
                  <div key={alert.alert_id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedAlert(isExp ? null : alert.alert_id)}
                      className="w-full text-left p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl ${sevCfg.bg} flex items-center justify-center shrink-0 ${sevCfg.color}`}>
                          {sevCfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-xs font-bold font-body uppercase tracking-wider ${sevCfg.color}`}>
                              {sevCfg.label}
                            </span>
                            <span className="text-xs text-slate-500 font-body capitalize">{alert.scope}</span>
                            {alert.zone_name && (
                              <span className="text-xs text-slate-500 font-body">· {alert.zone_name} Zone</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white font-body">{alert.title}</p>
                          <p className="text-xs text-slate-500 font-body mt-0.5">
                            {new Date(alert.sent_at).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                            {' · '}
                            <span className="text-primary-400">{alert.recipient_count} recipients</span>
                            {alert.sent_by && ` · ${alert.sent_by}`}
                          </p>
                        </div>
                        {isExp ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExp && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                          className="overflow-hidden border-t border-slate-800">
                          <div className="p-4">
                            <p className="text-sm text-slate-300 font-body leading-relaxed">{alert.message}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}