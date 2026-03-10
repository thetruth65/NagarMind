// import { useState, useEffect } from 'react'
// import { useParams, useNavigate } from 'react-router-dom'
// import { motion, AnimatePresence } from 'framer-motion'
// import {
//   ArrowLeft, MapPin, Clock, User, Star, AlertTriangle,
//   CheckCircle, Share2, ExternalLink, ChevronDown
// } from 'lucide-react'
// import { complaintsAPI } from '@/lib/api'
// import { useAuthStore } from '@/stores/authStore'
// import { CATEGORY_CONFIG, STATUS_CONFIG, URGENCY_CONFIG } from '@/types'
// import { formatDate, formatSLACountdown, slugToLabel } from '@/lib/utils'
// import type { Complaint, StatusHistory } from '@/types'
// import toast from 'react-hot-toast'

// export function TrackComplaintPage() {
//   const { id, complaint_id } = useParams()
//   const navigate = useNavigate()
//   const { isAuthenticated, role } = useAuthStore()
//   const [complaint, setComplaint]   = useState<Complaint | null>(null)
//   const [loading, setLoading]       = useState(true)
//   const [showRating, setShowRating] = useState(false)
//   const [showDispute, setShowDispute] = useState(false)
//   const [rating, setRating]         = useState(0)
//   const [feedback, setFeedback]     = useState('')
//   const [disputeReason, setDisputeReason] = useState('')
//   const [submitting, setSubmitting] = useState(false)
//   const [expandedHistory, setExpandedHistory] = useState(false)

//   const cId = id || complaint_id || ''

//   useEffect(() => {
//     if (!cId) return
//     setLoading(true)
//     complaintsAPI.track(cId)
//       .then(r => setComplaint(r.data))
//       .catch(() => toast.error('Complaint not found'))
//       .finally(() => setLoading(false))
//   }, [cId])

//   const submitRating = async () => {
//     if (!rating) { toast.error('Select a rating'); return }
//     setSubmitting(true)
//     try {
//       await complaintsAPI.rate(cId, { rating, feedback })
//       toast.success('Rating submitted!')
//       setShowRating(false)
//       setComplaint(c => c ? { ...c, citizen_rating: rating, status: 'closed' } : c)
//     } catch (e: any) {
//       toast.error(e.response?.data?.detail || 'Failed')
//     } finally { setSubmitting(false) }
//   }

//   const submitDispute = async () => {
//     if (!disputeReason.trim()) { toast.error('Describe the issue'); return }
//     setSubmitting(true)
//     try {
//       await complaintsAPI.dispute(cId, { reason: disputeReason })
//       toast.success('Dispute registered!')
//       setShowDispute(false)
//       setComplaint(c => c ? { ...c, status: 'disputed', disputed: true } : c)
//     } catch (e: any) {
//       toast.error(e.response?.data?.detail || 'Failed')
//     } finally { setSubmitting(false) }
//   }

//   const share = () => {
//     navigator.clipboard.writeText(window.location.href)
//     toast.success('Link copied!')
//   }

//   if (loading) return (
//     <div className="min-h-screen bg-mesh-blue flex items-center justify-center">
//       <div className="space-y-3 w-full max-w-md px-4">
//         {[1,2,3].map(i => <div key={i} className="h-24 card animate-pulse bg-slate-100" />)}
//       </div>
//     </div>
//   )

//   if (!complaint) return (
//     <div className="min-h-screen bg-mesh-blue flex items-center justify-center px-4">
//       <div className="card p-8 text-center max-w-md w-full">
//         <div className="text-5xl mb-4">❌</div>
//         <h2 className="font-display font-bold text-xl text-slate-800 mb-2">Complaint Not Found</h2>
//         <p className="text-slate-500 font-body text-sm mb-4">The complaint ID may be incorrect</p>
//         <button onClick={() => navigate('/')} className="btn-primary">Go Home</button>
//       </div>
//     </div>
//   )

//   const catCfg    = CATEGORY_CONFIG[complaint.category || 'other'] || CATEGORY_CONFIG.other
//   const statusCfg = STATUS_CONFIG[complaint.status]     || STATUS_CONFIG.submitted
//   const urgCfg    = URGENCY_CONFIG[complaint.urgency || 'medium'] || URGENCY_CONFIG.medium
//   const sla       = complaint.sla_remaining_seconds != null ? formatSLACountdown(complaint.sla_remaining_seconds) : null
//   const isResolved= ['resolved','closed'].includes(complaint.status)

//   const TIMELINE_ORDER = ['submitted','ai_classified','assigned','acknowledged','in_progress','resolved','closed','disputed']

//   return (
//     <div className="min-h-screen bg-mesh-blue">
//       {/* Header */}
//       <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-20 px-4 py-3">
//         <div className="max-w-2xl mx-auto flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <button onClick={() => navigate(-1)}
//               className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200">
//               <ArrowLeft size={16} className="text-slate-600" />
//             </button>
//             <div>
//               <h1 className="font-display font-bold text-slate-900 text-sm">Track Complaint</h1>
//               <p className="text-xs text-slate-400 font-mono">{cId.slice(-8).toUpperCase()}</p>
//             </div>
//           </div>
//           <button onClick={share}
//             className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200">
//             <Share2 size={14} className="text-slate-600" />
//           </button>
//         </div>
//       </header>

//       <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
//         {/* ── Status Card ── */}
//         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
//           className={`card p-5 border-l-4 ${urgCfg.border}`}>
//           <div className="flex items-start justify-between gap-3 mb-3">
//             <div className="flex items-center gap-3">
//               <div className={`w-12 h-12 rounded-2xl ${catCfg.color} flex items-center justify-center text-2xl`}>
//                 {catCfg.icon}
//               </div>
//               <div>
//                 <h2 className="font-display font-bold text-slate-900 text-base leading-snug">{complaint.title}</h2>
//                 <p className="text-xs text-slate-400 font-body">{catCfg.label}</p>
//               </div>
//             </div>
//             <span className={`badge ${statusCfg.bg} ${statusCfg.color} shrink-0`}>
//               {statusCfg.icon} {statusCfg.label}
//             </span>
//           </div>

//           <div className="flex flex-wrap gap-2 mb-3">
//             <span className={`badge ${urgCfg.bg} ${urgCfg.color}`}>{urgCfg.label} Priority</span>
//             {complaint.ward_name && (
//               <span className="badge bg-slate-100 text-slate-600 flex items-center gap-1">
//                 <MapPin size={10} />{complaint.ward_name}
//               </span>
//             )}
//           </div>

//           {/* SLA */}
//           {sla && !isResolved && (
//             <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-body
//               ${complaint.sla_remaining_seconds! <= 0 ? 'bg-red-50 text-red-700' :
//                 complaint.sla_remaining_seconds! < 7200 ? 'bg-amber-50 text-amber-700' :
//                 'bg-green-50 text-green-700'}`}>
//               <Clock size={14} />
//               {complaint.sla_remaining_seconds! <= 0
//                 ? '⚠️ SLA Breached — Escalated to supervisor'
//                 : `SLA: ${sla.text} remaining`}
//             </div>
//           )}

//           {isResolved && complaint.resolved_at && (
//             <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl text-sm text-green-700 font-body">
//               <CheckCircle size={14} />
//               Resolved on {formatDate(complaint.resolved_at)}
//             </div>
//           )}
//         </motion.div>

//         {/* ── Description ── */}
//         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
//           className="card p-5 space-y-4">
//           <div>
//             <p className="text-xs text-slate-400 uppercase tracking-wide font-body mb-1">Description</p>
//             <p className="text-sm text-slate-700 font-body leading-relaxed">{complaint.description}</p>
//           </div>
//           {complaint.ai_summary && (
//             <div className="bg-indigo-50 rounded-2xl p-3">
//               <p className="text-xs font-semibold text-indigo-600 mb-1">🤖 AI Analysis</p>
//               <p className="text-sm text-indigo-800 font-body">{complaint.ai_summary}</p>
//               {complaint.ai_category_confidence && (
//                 <p className="text-xs text-indigo-500 mt-1 font-body">
//                   Confidence: {(complaint.ai_category_confidence * 100).toFixed(0)}%
//                 </p>
//               )}
//             </div>
//           )}
//           {complaint.location_address && (
//             <div className="flex items-start gap-2">
//               <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
//               <p className="text-sm text-slate-600 font-body">{complaint.location_address}</p>
//             </div>
//           )}
//           {complaint.officer_name && (
//             <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
//               <User size={14} className="text-slate-400" />
//               <div>
//                 <p className="text-xs text-slate-400 font-body">Assigned Officer</p>
//                 <p className="text-sm font-semibold text-slate-700 font-body">
//                   {complaint.officer_name}
//                   {complaint.officer_designation && <span className="font-normal text-slate-500 ml-1">· {complaint.officer_designation}</span>}
//                 </p>
//               </div>
//             </div>
//           )}
//         </motion.div>

//         {/* ── Photos ── */}
//         {complaint.photo_urls && complaint.photo_urls.length > 0 && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
//             className="card p-5">
//             <p className="text-xs text-slate-400 uppercase tracking-wide font-body mb-3">
//               Evidence Photos ({complaint.photo_urls.length})
//             </p>
//             <div className="grid grid-cols-3 gap-2">
//               {complaint.photo_urls.map((url, i) => (
//                 <a key={i} href={url} target="_blank" rel="noreferrer">
//                   <img src={url} alt="" className="w-full aspect-square rounded-xl object-cover hover:opacity-90 transition-opacity" />
//                 </a>
//               ))}
//             </div>
//           </motion.div>
//         )}

//         {/* ── Status Timeline ── */}
//         {complaint.status_history && complaint.status_history.length > 0 && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
//             className="card p-5">
//             <button onClick={() => setExpandedHistory(!expandedHistory)}
//               className="w-full flex items-center justify-between">
//               <p className="font-semibold text-slate-800 font-body">Status Timeline</p>
//               <ChevronDown size={16} className={`text-slate-400 transition-transform ${expandedHistory ? 'rotate-180' : ''}`} />
//             </button>

//             <AnimatePresence>
//               {expandedHistory && (
//                 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
//                   exit={{ height: 0, opacity: 0 }} className="mt-4 space-y-3 overflow-hidden">
//                   {complaint.status_history.map((h: StatusHistory, i: number) => {
//                     const cfg = STATUS_CONFIG[h.new_status] || STATUS_CONFIG.submitted
//                     const isLast = i === complaint.status_history!.length - 1
//                     return (
//                       <div key={i} className="flex gap-3">
//                         <div className="flex flex-col items-center">
//                           <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${cfg.bg} ${cfg.color}`}>
//                             {cfg.icon}
//                           </div>
//                           {!isLast && <div className="w-0.5 flex-1 bg-slate-100 mt-1 min-h-[12px]" />}
//                         </div>
//                         <div className="flex-1 pb-2">
//                           <div className="flex items-center gap-2">
//                             <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
//                               {cfg.label}
//                             </span>
//                             <span className="text-xs text-slate-400 font-body">
//                               {formatDate(h.created_at)}
//                             </span>
//                           </div>
//                           {h.note && (
//                             <p className="text-xs text-slate-600 font-body mt-1 leading-relaxed">{h.note}</p>
//                           )}
//                         </div>
//                       </div>
//                     )
//                   })}
//                 </motion.div>
//               )}
//             </AnimatePresence>

//             {!expandedHistory && (
//               <div className="mt-2 flex items-center gap-2">
//                 <span className={`text-xs px-2 py-1 rounded-lg ${statusCfg.bg} ${statusCfg.color} font-body font-semibold`}>
//                   Current: {statusCfg.icon} {statusCfg.label}
//                 </span>
//               </div>
//             )}
//           </motion.div>
//         )}

//         {/* ── Resolution note ── */}
//         {complaint.resolution_note && (
//           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
//             className="card p-5 bg-green-50 border border-green-200">
//             <p className="text-xs text-green-600 font-semibold mb-1">✅ Resolution Note</p>
//             <p className="text-sm text-green-800 font-body">{complaint.resolution_note}</p>
//           </motion.div>
//         )}

//         {/* ── Citizen actions ── */}
//         {isAuthenticated && role === 'citizen' && (
//           <div className="space-y-3">
//             {isResolved && !complaint.citizen_rating && (
//               <motion.button whileTap={{ scale: 0.97 }}
//                 onClick={() => setShowRating(true)}
//                 className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl
//                            font-semibold font-body flex items-center justify-center gap-2">
//                 <Star size={16} /> Rate this Resolution
//               </motion.button>
//             )}
//             {complaint.citizen_rating && (
//               <div className="card p-4 flex items-center gap-3">
//                 <div className="flex gap-1">
//                   {[1,2,3,4,5].map(s => (
//                     <Star key={s} size={18} className={s <= complaint.citizen_rating! ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
//                   ))}
//                 </div>
//                 <p className="text-sm text-slate-600 font-body">Your rating</p>
//               </div>
//             )}
//             {isResolved && !complaint.disputed && (
//               <motion.button whileTap={{ scale: 0.97 }}
//                 onClick={() => setShowDispute(true)}
//                 className="w-full py-3 border-2 border-red-200 text-red-600 hover:bg-red-50
//                            rounded-2xl font-semibold font-body flex items-center justify-center gap-2">
//                 <AlertTriangle size={16} /> Issue Not Resolved? Dispute
//               </motion.button>
//             )}
//             {complaint.disputed && (
//               <div className="card p-4 bg-orange-50 border border-orange-200">
//                 <p className="text-sm text-orange-700 font-body">
//                   ⚠️ Dispute registered — Under supervisor review (48h)
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* ── Rating Modal ── */}
//       <AnimatePresence>
//         {showRating && (
//           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
//             className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
//             <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
//               exit={{ y: 100, opacity: 0 }}
//               className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-5">
//               <h3 className="font-display font-bold text-lg text-slate-900">Rate the Resolution</h3>
//               <div className="flex gap-2 justify-center">
//                 {[1,2,3,4,5].map(s => (
//                   <button key={s} onClick={() => setRating(s)}>
//                     <Star size={36} className={`transition-all ${s <= rating ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-200'}`} />
//                   </button>
//                 ))}
//               </div>
//               <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
//                 placeholder="Tell us more (optional)..."
//                 className="input-field resize-none text-sm" />
//               <div className="flex gap-3">
//                 <button onClick={() => setShowRating(false)} className="btn-secondary flex-1 py-3">Cancel</button>
//                 <button onClick={submitRating} disabled={submitting || !rating}
//                   className="btn-primary flex-1 py-3">
//                   {submitting ? 'Submitting...' : 'Submit Rating'}
//                 </button>
//               </div>
//             </motion.div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* ── Dispute Modal ── */}
//       <AnimatePresence>
//         {showDispute && (
//           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
//             className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
//             <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
//               exit={{ y: 100, opacity: 0 }}
//               className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">
//               <h3 className="font-display font-bold text-lg text-slate-900">Raise a Dispute</h3>
//               <p className="text-sm text-slate-500 font-body">
//                 Describe why the issue is not actually resolved
//               </p>
//               <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={4}
//                 placeholder="The pothole is still there. The officer marked it resolved without actually fixing it..."
//                 className="input-field resize-none text-sm" />
//               <div className="flex gap-3">
//                 <button onClick={() => setShowDispute(false)} className="btn-secondary flex-1 py-3">Cancel</button>
//                 <button onClick={submitDispute} disabled={submitting}
//                   className="btn-danger flex-1 py-3">
//                   {submitting ? 'Submitting...' : 'Raise Dispute'}
//                 </button>
//               </div>
//             </motion.div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   )
// }













import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, MapPin, Clock, CheckCircle2, AlertTriangle, Star,
  Phone, Mail, User, Building2, Calendar, Image, MessageSquare,
  Loader2, Shield, XCircle, ThumbsUp, Navigation
} from 'lucide-react'
import { complaintsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

/* ─── Helpers ─────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  submitted:    { label: 'Submitted',     color: 'text-slate-400',  bg: 'bg-slate-700',   icon: <Clock size={14} /> },
  ai_classified:{ label: 'AI Analysed',  color: 'text-purple-400', bg: 'bg-purple-900/40',icon: <Shield size={14} /> },
  assigned:     { label: 'Assigned',      color: 'text-blue-400',   bg: 'bg-blue-900/40', icon: <User size={14} /> },
  acknowledged: { label: 'Acknowledged',  color: 'text-cyan-400',   bg: 'bg-cyan-900/40', icon: <CheckCircle2 size={14} /> },
  in_progress:  { label: 'In Progress',   color: 'text-amber-400',  bg: 'bg-amber-900/40',icon: <Building2 size={14} /> },
  resolved:     { label: 'Resolved',      color: 'text-emerald-400',bg: 'bg-emerald-900/40',icon: <CheckCircle2 size={14} /> },
  closed:       { label: 'Closed',        color: 'text-green-400',  bg: 'bg-green-900/40',icon: <CheckCircle2 size={14} /> },
  disputed:     { label: 'Disputed',      color: 'text-red-400',    bg: 'bg-red-900/40',  icon: <AlertTriangle size={14} /> },
}

const URGENCY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-900/30 border-red-700/50',
  high:     'text-orange-400 bg-orange-900/30 border-orange-700/50',
  medium:   'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',
  low:      'text-green-400 bg-green-900/30 border-green-700/50',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtSLA(secs: number | null | undefined) {
  if (!secs || secs <= 0) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h left`
  if (h > 0)  return `${h}h ${m}m left`
  return `${m}m left`
}

/* ─── Rating Component ────────────────────────────────── */
function RatingWidget({ complaintId, onRated }: { complaintId: string; onRated: () => void }) {
  const [rating, setRating]   = useState(0)
  const [hover, setHover]     = useState(0)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!rating) { toast.error('Select a star rating'); return }
    setLoading(true)
    try {
      await complaintsAPI.rate(complaintId, { rating, feedback: feedback.trim() || undefined })
      toast.success('Thank you for your feedback!')
      onRated()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Rating failed')
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-emerald-950/40 border border-emerald-700/40 rounded-2xl p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <ThumbsUp size={16} className="text-emerald-400" />
        <h3 className="font-semibold text-emerald-300 font-body text-sm">Rate this Resolution</h3>
      </div>
      <p className="text-slate-400 text-xs font-body mb-4">
        Your complaint has been resolved. Please rate the officer's response.
      </p>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s}
            onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
            onClick={() => setRating(s)}
            className="transition-transform hover:scale-110">
            <Star size={28}
              className={`transition-colors ${s <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="Optional: Share more details about your experience..."
        rows={2}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl
                   outline-none focus:border-emerald-500 font-body text-sm resize-none mb-3
                   placeholder:text-slate-600"
      />
      <button onClick={submit} disabled={loading || !rating}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white
                   font-semibold rounded-xl font-body text-sm flex items-center justify-center gap-2">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
        Submit Rating
      </button>
    </motion.div>
  )
}

/* ─── Main Component ──────────────────────────────────── */
export function TrackComplaintPage() {
  const { id, complaint_id } = useParams<{ id?: string; complaint_id?: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuthStore()

  const cid = id || complaint_id || ''

  const [complaint, setComplaint] = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [showRating, setShowRating] = useState(false)

  const fetchComplaint = async () => {
    if (!cid) return
    try {
      // complaintsAPI.track() tries authenticated first, falls back to public automatically
      const res = await complaintsAPI.track(cid)
      const data = res.data
      setComplaint(data)
      // Show rating widget if resolved and citizen hasn't rated yet
      if (data.status === 'resolved' && !data.citizen_rating && role === 'citizen') {
        setShowRating(true)
      }
    } catch {
      toast.error('Complaint not found')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchComplaint() }, [cid])

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary-500" />
    </div>
  )

  if (!complaint) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-slate-400 font-body">Complaint not found</p>
    </div>
  )

  const statusMeta = STATUS_META[complaint.status] || STATUS_META.submitted
  const slaLeft    = fmtSLA(complaint.sla_remaining_seconds)
  const history: any[] = complaint.status_history || []

  // Build a full timeline — merge status_history with current status if needed
  const timelineSteps = ['submitted', 'assigned', 'acknowledged', 'in_progress', 'resolved', 'closed']
  const completedStatuses = new Set(history.map((h: any) => h.new_status))
  completedStatuses.add(complaint.status)

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700">
            <ArrowLeft size={16} className="text-slate-300" />
          </button>
          <div>
            <h1 className="font-display font-bold text-white text-base">Complaint Tracking</h1>
            <p className="text-slate-500 text-xs font-mono">#{cid.slice(-8).toUpperCase()}</p>
          </div>
          <div className="ml-auto">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              ${statusMeta.bg} ${statusMeta.color} border border-current/20`}>
              {statusMeta.icon}
              {statusMeta.label}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ─── Complaint Overview ─────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h2 className="font-display font-bold text-white text-lg leading-tight">{complaint.title}</h2>
              <p className="text-slate-400 text-sm font-body mt-1">{complaint.description}</p>
            </div>
            {complaint.urgency && (
              <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border uppercase
                ${URGENCY_COLORS[complaint.urgency] || URGENCY_COLORS.medium}`}>
                {complaint.urgency}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {complaint.category && (
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-slate-500 text-xs font-body mb-0.5">Category</p>
                <p className="text-slate-200 text-sm font-semibold capitalize">
                  {complaint.category.replace(/_/g, ' ')}
                </p>
              </div>
            )}
            {/* Ward info — always show name + id + zone */}
            <div className="bg-slate-800/60 rounded-xl p-3">
              <p className="text-slate-500 text-xs font-body mb-0.5">Ward</p>
              <p className="text-slate-200 text-sm font-semibold">
                {complaint.ward_name || `Ward ${complaint.ward_id}`}
              </p>
              {complaint.ward_id && (
                <p className="text-slate-500 text-xs font-mono">ID: {complaint.ward_id}</p>
              )}
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3">
              <p className="text-slate-500 text-xs font-body mb-0.5">Submitted</p>
              <p className="text-slate-200 text-sm font-semibold">{fmtDate(complaint.created_at || complaint.submitted_at)}</p>
            </div>
            {complaint.sla_deadline && (
              <div className={`rounded-xl p-3 ${slaLeft
                ? 'bg-amber-900/30 border border-amber-700/40'
                : 'bg-slate-800/60'}`}>
                <p className="text-slate-500 text-xs font-body mb-0.5">SLA Deadline</p>
                <p className="text-slate-200 text-sm font-semibold">{fmtDate(complaint.sla_deadline)}</p>
                {slaLeft && <p className="text-amber-400 text-xs font-mono mt-0.5">⏱ {slaLeft}</p>}
                {complaint.sla_breached && (
                  <p className="text-red-400 text-xs font-semibold mt-0.5">⚠ SLA Breached</p>
                )}
              </div>
            )}
          </div>

          {/* Location */}
          {(complaint.address || complaint.location_address) && (
            <div className="flex items-start gap-2 mt-4 pt-4 border-t border-slate-800">
              <MapPin size={14} className="text-primary-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs font-body">Location</p>
                <p className="text-slate-200 text-sm font-body">
                  {complaint.address || complaint.location_address}
                </p>
                {complaint.latitude && complaint.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-400 text-xs mt-1 hover:text-primary-300">
                    <Navigation size={10} /> Open in Maps
                  </a>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* ─── Officer Details ────────────────────────────── */}
        {(complaint.officer_name || complaint.officer_id) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-300 font-body text-sm mb-4 flex items-center gap-2">
              <Shield size={14} className="text-primary-400" /> Assigned Officer
            </h3>
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-primary-600/20 border border-primary-500/30
                              flex items-center justify-center shrink-0">
                <User size={20} className="text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white font-body">
                  {complaint.officer_name || 'Officer'}
                </p>
                {complaint.officer_designation && (
                  <p className="text-slate-400 text-sm font-body">{complaint.officer_designation}</p>
                )}
                {/* Ward info */}
                {complaint.ward_name && (
                  <p className="text-slate-500 text-xs font-body mt-1">
                    <MapPin size={10} className="inline mr-1" />
                    {complaint.ward_name}
                    {complaint.ward_id ? ` (Ward ${complaint.ward_id})` : ''}
                  </p>
                )}
                {/* Contact details */}
                <div className="mt-3 space-y-1.5">
                  {complaint.officer_phone && (
                    <a href={`tel:${complaint.officer_phone}`}
                      className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors">
                      <Phone size={13} />
                      <span className="font-mono">{complaint.officer_phone}</span>
                    </a>
                  )}
                  {complaint.officer_email && (
                    <a href={`mailto:${complaint.officer_email}`}
                      className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors">
                      <Mail size={13} />
                      <span className="font-mono text-xs">{complaint.officer_email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Status Timeline ────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="font-semibold text-slate-300 font-body text-sm mb-5 flex items-center gap-2">
            <Clock size={14} className="text-primary-400" /> Status Timeline
          </h3>

          {history.length > 0 ? (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-700" />

              <div className="space-y-4">
                {/* Always show submitted first */}
                {!history.find((h: any) => h.new_status === 'submitted') && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600
                                    flex items-center justify-center shrink-0 z-10">
                      <Clock size={14} className="text-slate-400" />
                    </div>
                    <div className="pt-1.5">
                      <p className="text-slate-300 text-sm font-semibold font-body">Complaint Submitted</p>
                      <p className="text-slate-500 text-xs font-body">{fmtDate(complaint.created_at || complaint.submitted_at)}</p>
                    </div>
                  </div>
                )}

                {history.map((h: any, i: number) => {
                  const meta = STATUS_META[h.new_status] || STATUS_META.submitted
                  const isLatest = i === history.length - 1
                  return (
                    <div key={i} className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10
                        ${isLatest
                          ? 'bg-primary-600 border-primary-400'
                          : `${meta.bg} border-slate-600`}`}>
                        <span className={isLatest ? 'text-white' : meta.color}>{meta.icon}</span>
                      </div>
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-bold font-body ${isLatest ? 'text-white' : 'text-slate-300'}`}>
                            {meta.label}
                          </p>
                          {h.changed_by_role && (
                            <span className="text-xs text-slate-500 font-body">by {h.changed_by_role}</span>
                          )}
                        </div>
                        {h.note && (
                          <p className="text-slate-400 text-xs font-body mt-0.5 italic">"{h.note}"</p>
                        )}
                        <p className="text-slate-500 text-xs font-body mt-0.5">{fmtDate(h.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Fallback: show visual pipeline when no history yet */
            <div className="space-y-3">
              {[
                { s: 'submitted', label: 'Complaint Submitted', done: true, time: complaint.created_at },
                { s: 'assigned',  label: 'Officer Assigned',    done: ['assigned','acknowledged','in_progress','resolved','closed'].includes(complaint.status) },
                { s: 'in_progress', label: 'Work In Progress',  done: ['in_progress','resolved','closed'].includes(complaint.status) },
                { s: 'resolved',  label: 'Resolved',            done: ['resolved','closed'].includes(complaint.status) },
                { s: 'closed',    label: 'Closed',              done: complaint.status === 'closed' },
              ].map(({ s, label, done, time }, idx) => {
                const meta = STATUS_META[s]
                const isCurrent = complaint.status === s
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0
                      ${done ? 'bg-primary-600 border-primary-400' : 'bg-slate-800 border-slate-700'}`}>
                      {done
                        ? <CheckCircle2 size={14} className="text-white" />
                        : <span className="w-2 h-2 rounded-full bg-slate-600" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold font-body ${done ? 'text-white' : 'text-slate-500'}`}>
                        {label}
                        {isCurrent && (
                          <span className="ml-2 text-xs text-primary-400 font-normal">(current)</span>
                        )}
                      </p>
                      {time && done && (
                        <p className="text-slate-500 text-xs font-body">{fmtDate(time as string)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* ─── Resolution Note ────────────────────────────── */}
        {complaint.resolution_note && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-5">
            <h3 className="font-semibold text-emerald-300 font-body text-sm mb-2 flex items-center gap-2">
              <CheckCircle2 size={14} /> Resolution Note
            </h3>
            <p className="text-slate-300 text-sm font-body">{complaint.resolution_note}</p>
            {complaint.resolved_at && (
              <p className="text-emerald-500 text-xs font-body mt-2">Resolved: {fmtDate(complaint.resolved_at)}</p>
            )}
          </motion.div>
        )}

        {/* ─── AI Summary ─────────────────────────────────── */}
        {complaint.ai_summary && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-300 font-body text-sm mb-2 flex items-center gap-2">
              <MessageSquare size={14} className="text-purple-400" /> AI Analysis
            </h3>
            <p className="text-slate-400 text-sm font-body">{complaint.ai_summary}</p>
          </motion.div>
        )}

        {/* ─── Photos ─────────────────────────────────────── */}
        {complaint.photo_urls && complaint.photo_urls.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-300 font-body text-sm mb-3 flex items-center gap-2">
              <Image size={14} className="text-primary-400" /> Evidence Photos
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {complaint.photo_urls.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`}
                  className="w-full h-32 object-cover rounded-xl border border-slate-700"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Existing Rating ────────────────────────────── */}
        {complaint.citizen_rating && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-300 font-body text-sm mb-3 flex items-center gap-2">
              <Star size={14} className="text-amber-400" /> Citizen Rating
            </h3>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={22}
                  className={s <= complaint.citizen_rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'} />
              ))}
              <span className="text-white font-bold ml-1">{complaint.citizen_rating}/5</span>
            </div>
            {complaint.citizen_feedback && (
              <p className="text-slate-400 text-sm font-body mt-2 italic">"{complaint.citizen_feedback}"</p>
            )}
          </motion.div>
        )}

        {/* ─── Rating Widget (shown after resolve, before rating) ── */}
        {showRating && (
          <RatingWidget complaintId={cid} onRated={() => { setShowRating(false); fetchComplaint() }} />
        )}

        {/* ─── Complaint ID copy ──────────────────────────── */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 flex items-center justify-between">
          <span className="text-slate-500 text-xs font-body">Complaint ID</span>
          <button
            onClick={() => { navigator.clipboard.writeText(cid); toast.success('Copied!') }}
            className="text-slate-400 hover:text-primary-400 font-mono text-xs transition-colors">
            {cid} ✦
          </button>
        </div>
      </div>
    </div>
  )
}