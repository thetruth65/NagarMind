import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, MapPin, Clock, User, Star, AlertTriangle,
  CheckCircle, Share2, ExternalLink, ChevronDown
} from 'lucide-react'
import { complaintsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { CATEGORY_CONFIG, STATUS_CONFIG, URGENCY_CONFIG } from '@/types'
import { formatDate, formatSLACountdown, slugToLabel } from '@/lib/utils'
import type { Complaint, StatusHistory } from '@/types'
import toast from 'react-hot-toast'

export function TrackComplaintPage() {
  const { id, complaint_id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuthStore()
  const [complaint, setComplaint]   = useState<Complaint | null>(null)
  const [loading, setLoading]       = useState(true)
  const [showRating, setShowRating] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [rating, setRating]         = useState(0)
  const [feedback, setFeedback]     = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState(false)

  const cId = id || complaint_id || ''

  useEffect(() => {
    if (!cId) return
    setLoading(true)
    complaintsAPI.track(cId)
      .then(r => setComplaint(r.data))
      .catch(() => toast.error('Complaint not found'))
      .finally(() => setLoading(false))
  }, [cId])

  const submitRating = async () => {
    if (!rating) { toast.error('Select a rating'); return }
    setSubmitting(true)
    try {
      await complaintsAPI.rate(cId, { rating, feedback })
      toast.success('Rating submitted!')
      setShowRating(false)
      setComplaint(c => c ? { ...c, citizen_rating: rating, status: 'closed' } : c)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  const submitDispute = async () => {
    if (!disputeReason.trim()) { toast.error('Describe the issue'); return }
    setSubmitting(true)
    try {
      await complaintsAPI.dispute(cId, { reason: disputeReason })
      toast.success('Dispute registered!')
      setShowDispute(false)
      setComplaint(c => c ? { ...c, status: 'disputed', disputed: true } : c)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  const share = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied!')
  }

  if (loading) return (
    <div className="min-h-screen bg-mesh-blue flex items-center justify-center">
      <div className="space-y-3 w-full max-w-md px-4">
        {[1,2,3].map(i => <div key={i} className="h-24 card animate-pulse bg-slate-100" />)}
      </div>
    </div>
  )

  if (!complaint) return (
    <div className="min-h-screen bg-mesh-blue flex items-center justify-center px-4">
      <div className="card p-8 text-center max-w-md w-full">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="font-display font-bold text-xl text-slate-800 mb-2">Complaint Not Found</h2>
        <p className="text-slate-500 font-body text-sm mb-4">The complaint ID may be incorrect</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go Home</button>
      </div>
    </div>
  )

  const catCfg    = CATEGORY_CONFIG[complaint.category || 'other'] || CATEGORY_CONFIG.other
  const statusCfg = STATUS_CONFIG[complaint.status]     || STATUS_CONFIG.submitted
  const urgCfg    = URGENCY_CONFIG[complaint.urgency || 'medium'] || URGENCY_CONFIG.medium
  const sla       = complaint.sla_remaining_seconds != null ? formatSLACountdown(complaint.sla_remaining_seconds) : null
  const isResolved= ['resolved','closed'].includes(complaint.status)

  const TIMELINE_ORDER = ['submitted','ai_classified','assigned','acknowledged','in_progress','resolved','closed','disputed']

  return (
    <div className="min-h-screen bg-mesh-blue">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200">
              <ArrowLeft size={16} className="text-slate-600" />
            </button>
            <div>
              <h1 className="font-display font-bold text-slate-900 text-sm">Track Complaint</h1>
              <p className="text-xs text-slate-400 font-mono">{cId.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={share}
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200">
            <Share2 size={14} className="text-slate-600" />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ── Status Card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`card p-5 border-l-4 ${urgCfg.border}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl ${catCfg.color} flex items-center justify-center text-2xl`}>
                {catCfg.icon}
              </div>
              <div>
                <h2 className="font-display font-bold text-slate-900 text-base leading-snug">{complaint.title}</h2>
                <p className="text-xs text-slate-400 font-body">{catCfg.label}</p>
              </div>
            </div>
            <span className={`badge ${statusCfg.bg} ${statusCfg.color} shrink-0`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`badge ${urgCfg.bg} ${urgCfg.color}`}>{urgCfg.label} Priority</span>
            {complaint.ward_name && (
              <span className="badge bg-slate-100 text-slate-600 flex items-center gap-1">
                <MapPin size={10} />{complaint.ward_name}
              </span>
            )}
          </div>

          {/* SLA */}
          {sla && !isResolved && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-body
              ${complaint.sla_remaining_seconds! <= 0 ? 'bg-red-50 text-red-700' :
                complaint.sla_remaining_seconds! < 7200 ? 'bg-amber-50 text-amber-700' :
                'bg-green-50 text-green-700'}`}>
              <Clock size={14} />
              {complaint.sla_remaining_seconds! <= 0
                ? '⚠️ SLA Breached — Escalated to supervisor'
                : `SLA: ${sla.text} remaining`}
            </div>
          )}

          {isResolved && complaint.resolved_at && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl text-sm text-green-700 font-body">
              <CheckCircle size={14} />
              Resolved on {formatDate(complaint.resolved_at)}
            </div>
          )}
        </motion.div>

        {/* ── Description ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card p-5 space-y-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-body mb-1">Description</p>
            <p className="text-sm text-slate-700 font-body leading-relaxed">{complaint.description}</p>
          </div>
          {complaint.ai_summary && (
            <div className="bg-indigo-50 rounded-2xl p-3">
              <p className="text-xs font-semibold text-indigo-600 mb-1">🤖 AI Analysis</p>
              <p className="text-sm text-indigo-800 font-body">{complaint.ai_summary}</p>
              {complaint.ai_category_confidence && (
                <p className="text-xs text-indigo-500 mt-1 font-body">
                  Confidence: {(complaint.ai_category_confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
          {complaint.location_address && (
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-600 font-body">{complaint.location_address}</p>
            </div>
          )}
          {complaint.officer_name && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <User size={14} className="text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 font-body">Assigned Officer</p>
                <p className="text-sm font-semibold text-slate-700 font-body">
                  {complaint.officer_name}
                  {complaint.officer_designation && <span className="font-normal text-slate-500 ml-1">· {complaint.officer_designation}</span>}
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Photos ── */}
        {complaint.photo_urls && complaint.photo_urls.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="card p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-body mb-3">
              Evidence Photos ({complaint.photo_urls.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {complaint.photo_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" className="w-full aspect-square rounded-xl object-cover hover:opacity-90 transition-opacity" />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Status Timeline ── */}
        {complaint.status_history && complaint.status_history.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="card p-5">
            <button onClick={() => setExpandedHistory(!expandedHistory)}
              className="w-full flex items-center justify-between">
              <p className="font-semibold text-slate-800 font-body">Status Timeline</p>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${expandedHistory ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {expandedHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="mt-4 space-y-3 overflow-hidden">
                  {complaint.status_history.map((h: StatusHistory, i: number) => {
                    const cfg = STATUS_CONFIG[h.new_status] || STATUS_CONFIG.submitted
                    const isLast = i === complaint.status_history!.length - 1
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon}
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-slate-100 mt-1 min-h-[12px]" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className="text-xs text-slate-400 font-body">
                              {formatDate(h.created_at)}
                            </span>
                          </div>
                          {h.note && (
                            <p className="text-xs text-slate-600 font-body mt-1 leading-relaxed">{h.note}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {!expandedHistory && (
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-lg ${statusCfg.bg} ${statusCfg.color} font-body font-semibold`}>
                  Current: {statusCfg.icon} {statusCfg.label}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Resolution note ── */}
        {complaint.resolution_note && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card p-5 bg-green-50 border border-green-200">
            <p className="text-xs text-green-600 font-semibold mb-1">✅ Resolution Note</p>
            <p className="text-sm text-green-800 font-body">{complaint.resolution_note}</p>
          </motion.div>
        )}

        {/* ── Citizen actions ── */}
        {isAuthenticated && role === 'citizen' && (
          <div className="space-y-3">
            {isResolved && !complaint.citizen_rating && (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => setShowRating(true)}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl
                           font-semibold font-body flex items-center justify-center gap-2">
                <Star size={16} /> Rate this Resolution
              </motion.button>
            )}
            {complaint.citizen_rating && (
              <div className="card p-4 flex items-center gap-3">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={18} className={s <= complaint.citizen_rating! ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                  ))}
                </div>
                <p className="text-sm text-slate-600 font-body">Your rating</p>
              </div>
            )}
            {isResolved && !complaint.disputed && (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => setShowDispute(true)}
                className="w-full py-3 border-2 border-red-200 text-red-600 hover:bg-red-50
                           rounded-2xl font-semibold font-body flex items-center justify-center gap-2">
                <AlertTriangle size={16} /> Issue Not Resolved? Dispute
              </motion.button>
            )}
            {complaint.disputed && (
              <div className="card p-4 bg-orange-50 border border-orange-200">
                <p className="text-sm text-orange-700 font-body">
                  ⚠️ Dispute registered — Under supervisor review (48h)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Rating Modal ── */}
      <AnimatePresence>
        {showRating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-5">
              <h3 className="font-display font-bold text-lg text-slate-900">Rate the Resolution</h3>
              <div className="flex gap-2 justify-center">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRating(s)}>
                    <Star size={36} className={`transition-all ${s <= rating ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
              <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
                placeholder="Tell us more (optional)..."
                className="input-field resize-none text-sm" />
              <div className="flex gap-3">
                <button onClick={() => setShowRating(false)} className="btn-secondary flex-1 py-3">Cancel</button>
                <button onClick={submitRating} disabled={submitting || !rating}
                  className="btn-primary flex-1 py-3">
                  {submitting ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dispute Modal ── */}
      <AnimatePresence>
        {showDispute && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">
              <h3 className="font-display font-bold text-lg text-slate-900">Raise a Dispute</h3>
              <p className="text-sm text-slate-500 font-body">
                Describe why the issue is not actually resolved
              </p>
              <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={4}
                placeholder="The pothole is still there. The officer marked it resolved without actually fixing it..."
                className="input-field resize-none text-sm" />
              <div className="flex gap-3">
                <button onClick={() => setShowDispute(false)} className="btn-secondary flex-1 py-3">Cancel</button>
                <button onClick={submitDispute} disabled={submitting}
                  className="btn-danger flex-1 py-3">
                  {submitting ? 'Submitting...' : 'Raise Dispute'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}