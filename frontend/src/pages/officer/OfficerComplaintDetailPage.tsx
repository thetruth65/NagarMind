import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, MapPin, Clock, User, Camera, ChevronDown,
  CheckCircle, AlertTriangle, Loader2, Image, Phone
} from 'lucide-react'
import { complaintsAPI, uploadAPI } from '@/lib/api'
import { CATEGORY_CONFIG, STATUS_CONFIG, URGENCY_CONFIG } from '@/types'
import { formatDate, formatSLACountdown } from '@/lib/utils'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  submitted:     ['acknowledged'],
  ai_classified: ['acknowledged'],
  assigned:      ['acknowledged'],
  acknowledged:  ['in_progress'],
  in_progress:   ['resolved'],
  disputed:      ['in_progress', 'resolved'],
}

const STATUS_BUTTONS: Record<string, { label: string; color: string; icon: string }> = {
  acknowledged: { label: 'Acknowledge',   color: 'bg-purple-600 hover:bg-purple-700', icon: '👀' },
  in_progress:  { label: 'Start Work',    color: 'bg-amber-500 hover:bg-amber-600',   icon: '🔧' },
  resolved:     { label: 'Mark Resolved', color: 'bg-green-600 hover:bg-green-700',   icon: '✅' },
}

export function OfficerComplaintDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint]         = useState<any>(null)
  const [loading, setLoading]             = useState(true)
  const [showUpdate, setShowUpdate]       = useState(false)
  // ✅ FIX: track which specific status button was clicked
  const [pendingStatus, setPendingStatus] = useState<string>('')
  const [notes, setNotes]                 = useState('')
  const [proofPhotos, setProofPhotos]     = useState<string[]>([])
  const [submitting, setSubmitting]       = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [expandHistory, setExpandHistory] = useState(false)
  const fileRef         = useRef<HTMLInputElement>(null)
  const mapRef          = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    complaintsAPI.officerDetail(id)
      .then(r => setComplaint(r.data))
      .catch(() => toast.error('Complaint not found'))
      .finally(() => setLoading(false))
  }, [id])

  // Init map when complaint loads
  useEffect(() => {
    if (!complaint?.location_lat || !mapContainerRef.current || mapRef.current) return
    setTimeout(() => {
      if (!mapContainerRef.current) return
      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView(
        [complaint.location_lat, complaint.location_lng], 16
      )
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      L.marker([complaint.location_lat, complaint.location_lng])
        .addTo(map)
        .bindPopup(complaint.location_address || 'Complaint location')
        .openPopup()
      mapRef.current = map
    }, 200)
    return () => { mapRef.current?.remove(); mapRef.current = null }
  }, [complaint])

  // ✅ FIX: uses uploadAPI.uploadPhoto (base64 data URI, no R2)
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - proofPhotos.length)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max 5MB.`)
        continue
      }
      try {
        const { data } = await uploadAPI.uploadPhoto(file)
        if (data.public_url) {
          setProofPhotos(p => [...p, data.public_url])
        }
      } catch (err: any) {
        console.error('Proof upload error:', err)
        // Fallback: local preview so officer isn't blocked
        setProofPhotos(p => [...p, URL.createObjectURL(file)])
        toast.error(`Server upload failed for ${file.name} — using local preview`)
      }
    }
    setUploading(false)
    if (e.target) e.target.value = ''
  }

  // ✅ FIX: open modal AND store which status we're targeting
  const openUpdateModal = (nextStatus: string) => {
    setPendingStatus(nextStatus)
    setNotes('')
    setProofPhotos([])
    setShowUpdate(true)
  }

  // ✅ FIX: uses pendingStatus from state, not a param (which was never passed before)
  const submitUpdate = async () => {
    if (!pendingStatus) return
    if (pendingStatus === 'resolved' && !notes.trim()) {
      toast.error('Please add resolution notes before marking resolved')
      return
    }
    setSubmitting(true)
    try {
      await complaintsAPI.updateStatus(id!, {
        status:       pendingStatus,
        notes:        notes.trim() || undefined,
        photos_added: proofPhotos,
      })
      setComplaint((c: any) => ({
        ...c,
        status:          pendingStatus,
        resolution_note: notes.trim() || c.resolution_note,
        resolved_at:     pendingStatus === 'resolved' ? new Date().toISOString() : c.resolved_at,
      }))
      toast.success(`Status updated to ${pendingStatus.replace('_', ' ')}!`)
      setShowUpdate(false)
      setNotes('')
      setProofPhotos([])
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-mesh-blue flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-primary-500" />
    </div>
  )

  if (!complaint) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="font-display font-bold text-xl">Complaint not found</p>
        <button onClick={() => navigate('/officer/inbox')} className="btn-primary mt-4">
          Back to Inbox
        </button>
      </div>
    </div>
  )

  const catCfg       = CATEGORY_CONFIG[complaint.category || 'other'] || CATEGORY_CONFIG.other
  const statusCfg    = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.submitted
  const urgCfg       = URGENCY_CONFIG[complaint.urgency || 'medium'] || URGENCY_CONFIG.medium
  const sla          = complaint.sla_remaining_seconds != null
    ? formatSLACountdown(complaint.sla_remaining_seconds) : null
  const isResolved   = ['resolved', 'closed'].includes(complaint.status)
  const nextStatuses = ALLOWED_TRANSITIONS[complaint.status] || []

  // The button config for the currently pending status (used inside modal)
  const pendingBtn   = STATUS_BUTTONS[pendingStatus]

  return (
    <div className="min-h-screen bg-mesh-blue">

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/officer/inbox')}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200">
              <ArrowLeft size={16} className="text-slate-600" />
            </button>
            <div>
              <h1 className="font-display font-bold text-slate-900 text-sm">Complaint Detail</h1>
              <p className="text-xs text-slate-400 font-mono">{id?.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Main card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`card p-5 border-l-4 ${urgCfg.border}`}>
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-12 h-12 rounded-2xl ${catCfg.color} flex items-center justify-center text-2xl shrink-0`}>
              {catCfg.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-display font-bold text-slate-900 text-base leading-snug">{complaint.title}</h2>
              <p className="text-xs text-slate-400 font-body">
                {catCfg.label}{complaint.sub_category ? ` · ${complaint.sub_category}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`badge ${urgCfg.bg} ${urgCfg.color}`}>{urgCfg.label} Priority</span>
            {complaint.department && (
              <span className="badge bg-slate-100 text-slate-600">{complaint.department}</span>
            )}
          </div>

          {/* SLA */}
          {sla && !isResolved && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-body
              ${complaint.sla_remaining_seconds <= 0 ? 'bg-red-50 text-red-700'
              : complaint.sla_remaining_seconds < 7200 ? 'bg-amber-50 text-amber-700'
              : 'bg-green-50 text-green-700'}`}>
              <Clock size={14} />
              {complaint.sla_remaining_seconds <= 0
                ? '🚨 SLA Breached — Supervisor notified'
                : `SLA: ${sla.text} remaining`}
              {complaint.sla_deadline && (
                <span className="ml-auto text-xs opacity-70">
                  Due: {formatDate(complaint.sla_deadline, 'short')}
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Citizen info ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-lg">👤</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800 font-body text-sm">{complaint.citizen_name}</p>
            {complaint.citizen_phone && (
              <p className="text-xs text-slate-400 font-body flex items-center gap-1">
                <Phone size={10} /> {complaint.citizen_phone}
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400 font-body">{formatDate(complaint.created_at, 'short')}</p>
        </motion.div>

        {/* ── Description + AI ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="card p-5 space-y-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-body mb-1">Description</p>
            <p className="text-sm text-slate-700 font-body leading-relaxed">{complaint.description}</p>
          </div>
          {complaint.description_translated && complaint.original_language !== 'en' && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Original ({complaint.original_language})</p>
              <p className="text-sm text-slate-600 font-body">{complaint.description_translated}</p>
            </div>
          )}
          {complaint.ai_summary && (
            <div className="bg-indigo-50 rounded-2xl p-3">
              <p className="text-xs font-semibold text-indigo-600 mb-1">🤖 AI Analysis</p>
              <p className="text-sm text-indigo-800 font-body">{complaint.ai_summary}</p>
              {complaint.ai_category_confidence && (
                <p className="text-xs text-indigo-400 mt-1">
                  Confidence: {(complaint.ai_category_confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Evidence photos ── */}
        {complaint.photo_urls?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="card p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-body mb-3">
              Evidence Photos ({complaint.photo_urls.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {complaint.photo_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Evidence ${i + 1}`}
                    className="w-full aspect-square rounded-xl object-cover hover:opacity-90 transition-opacity" />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Map ── */}
        {complaint.location_lat && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="card p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-body mb-2 flex items-center gap-1">
              <MapPin size={12} /> Location
            </p>
            {complaint.location_address && (
              <p className="text-sm text-slate-600 font-body mb-2">{complaint.location_address}</p>
            )}
            <div ref={mapContainerRef} className="w-full h-40 rounded-xl overflow-hidden bg-slate-100" />
          </motion.div>
        )}

        {/* ── Status timeline ── */}
        {complaint.status_history?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="card p-4">
            <button onClick={() => setExpandHistory(!expandHistory)}
              className="w-full flex items-center justify-between">
              <p className="font-semibold text-slate-800 font-body text-sm">Status Timeline</p>
              <ChevronDown size={16}
                className={`text-slate-400 transition-transform ${expandHistory ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {expandHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="mt-3 space-y-2 overflow-hidden">
                  {complaint.status_history.map((h: any, i: number) => {
                    const cfg = STATUS_CONFIG[h.new_status] || STATUS_CONFIG.submitted
                    return (
                      <div key={i} className="flex gap-3 items-start">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${cfg.bg} ${cfg.color} shrink-0`}>
                          {cfg.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700 font-body">{cfg.label}</span>
                            <span className="text-xs text-slate-400">{formatDate(h.created_at, 'short')}</span>
                          </div>
                          {h.note && <p className="text-xs text-slate-500 font-body mt-0.5">{h.note}</p>}
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Resolution note (read-only) ── */}
        {complaint.resolution_note && (
          <div className="card p-4 bg-green-50 border border-green-200">
            <p className="text-xs text-green-600 font-semibold mb-1">✅ Resolution Note</p>
            <p className="text-sm text-green-800 font-body">{complaint.resolution_note}</p>
          </div>
        )}

        {/* ── Action buttons ── */}
        {nextStatuses.length > 0 && !isResolved && (
          <div className="space-y-3 pb-6">
            {nextStatuses.map(ns => {
              const btn = STATUS_BUTTONS[ns]
              if (!btn) return null
              return (
                <motion.button key={ns} whileTap={{ scale: 0.97 }}
                  // ✅ FIX: pass the specific status to the modal
                  onClick={() => openUpdateModal(ns)}
                  className={`w-full py-3.5 ${btn.color} text-white rounded-2xl font-semibold font-body
                    flex items-center justify-center gap-2 transition-colors`}>
                  {btn.icon} {btn.label}
                </motion.button>
              )
            })}
          </div>
        )}

        {isResolved && (
          <div className="card p-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 mb-6">
            <CheckCircle size={18} />
            <p className="font-semibold font-body text-sm">
              Resolved {complaint.resolved_at ? formatDate(complaint.resolved_at, 'short') : ''}
            </p>
          </div>
        )}
      </div>

      {/* ── Status Update Modal ── */}
      <AnimatePresence>
        {showUpdate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
            // ✅ click backdrop to close
            onClick={e => { if (e.target === e.currentTarget) setShowUpdate(false) }}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4">

              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Update Status</h3>
                {pendingBtn && (
                  <p className="text-sm text-slate-500 font-body mt-0.5">
                    Moving to:{' '}
                    <span className={`font-semibold ${STATUS_CONFIG[pendingStatus]?.color || 'text-slate-700'}`}>
                      {pendingBtn.icon} {pendingBtn.label}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="input-label">
                  Notes / Action Taken
                  {/* Required only for resolved */}
                  {pendingStatus === 'resolved' && <span className="text-red-500 ml-1">*</span>}
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder={
                    pendingStatus === 'resolved'
                      ? 'Describe what was done to resolve this issue...'
                      : 'Describe the action taken (optional)...'
                  }
                  className="input-field resize-none text-sm" />
                {pendingStatus === 'resolved' && !notes.trim() && (
                  <p className="text-xs text-red-400 font-body mt-1">Required for resolution</p>
                )}
              </div>

              {/* ✅ FIX: proof photos now use uploadAPI.uploadPhoto (base64, no R2) */}
              <div>
                <label className="input-label flex items-center gap-1.5">
                  <Camera size={14} /> Proof Photos ({proofPhotos.length}/3)
                  <span className="text-xs text-slate-400 font-normal ml-auto">Max 5MB each</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={handleProofUpload} />
                <button onClick={() => fileRef.current?.click()}
                  disabled={proofPhotos.length >= 3 || uploading}
                  className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl
                             flex items-center justify-center gap-2 text-slate-600 text-sm
                             hover:border-primary-300 transition-colors disabled:opacity-50 font-body">
                  {uploading
                    ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                    : <><Image size={14} /> Add Proof Photos</>}
                </button>
                {proofPhotos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {proofPhotos.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                        <button
                          onClick={() => setProofPhotos(p => p.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full
                                     flex items-center justify-center text-white text-xs leading-none">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowUpdate(false)}
                  className="btn-secondary flex-1 py-3 text-sm">
                  Cancel
                </button>
                {/* ✅ FIX: single confirm button that uses pendingStatus from state */}
                <button
                  onClick={submitUpdate}
                  disabled={submitting || (pendingStatus === 'resolved' && !notes.trim())}
                  className={`${pendingBtn?.color || 'bg-primary-600 hover:bg-primary-700'}
                    text-white font-semibold font-body flex-1 py-3 rounded-2xl
                    flex items-center justify-center gap-1.5 text-sm transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {submitting
                    ? <><Loader2 size={14} className="animate-spin" /> Updating...</>
                    : <>{pendingBtn?.icon} {pendingBtn?.label}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}