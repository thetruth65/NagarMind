// import { useState } from 'react'
// import { motion, AnimatePresence } from 'framer-motion'
// import { Bell, X, CheckCheck } from 'lucide-react'
// import { useNotifStore } from '@/stores/notificationStore'
// import { complaintsAPI } from '@/lib/api'
// import { formatDistanceToNow } from '@/lib/utils'

// const TYPE_ICONS: Record<string, string> = {
//   complaint_assigned:  '👷',
//   complaint_in_progress: '🔧',
//   complaint_resolved:  '✅',
//   sla_breach:          '🚨',
//   sla_warning:         '⏰',
//   dispute_opened:      '⚠️',
//   dispute_resolved:    '🔄',
//   new_assignment:      '📋',
// }

// const TYPE_COLORS: Record<string, string> = {
//   complaint_assigned:  'bg-blue-100 text-blue-700',
//   complaint_in_progress: 'bg-amber-100 text-amber-700',
//   complaint_resolved:  'bg-green-100 text-green-700',
//   sla_breach:          'bg-red-100 text-red-700',
//   sla_warning:         'bg-orange-100 text-orange-700',
//   dispute_opened:      'bg-orange-100 text-orange-700',
//   dispute_resolved:    'bg-purple-100 text-purple-700',
//   new_assignment:      'bg-blue-100 text-blue-700',
// }

// export function NotificationBell() {
//   const [open, setOpen] = useState(false)
//   const { notifications, unreadCount, markAllRead } = useNotifStore()

//   const handleMarkRead = async () => {
//     try { await complaintsAPI.markAllRead() } catch {}
//     markAllRead()
//   }

//   return (
//     <div className="relative">
//       <button onClick={() => setOpen(!open)}
//         className="relative w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25
//                    flex items-center justify-center transition-colors">
//         <Bell size={17} className="text-white" />
//         {unreadCount > 0 && (
//           <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
//             className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full
//                        text-white text-[10px] font-bold flex items-center justify-center px-1">
//             {unreadCount > 9 ? '9+' : unreadCount}
//           </motion.span>
//         )}
//       </button>

//       <AnimatePresence>
//         {open && (
//           <>
//             <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
//             <motion.div
//               initial={{ opacity: 0, y: -8, scale: 0.96 }}
//               animate={{ opacity: 1, y: 0, scale: 1 }}
//               exit={{ opacity: 0, y: -8, scale: 0.96 }}
//               transition={{ duration: 0.15 }}
//               className="absolute right-0 top-full mt-2 z-50 w-80 bg-white rounded-3xl shadow-2xl
//                          border border-slate-100 overflow-hidden"
//             >
//               <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
//                 <div className="flex items-center gap-2">
//                   <span className="font-display font-semibold text-slate-800 text-sm">Notifications</span>
//                   {unreadCount > 0 && (
//                     <span className="badge bg-primary-100 text-primary-700">{unreadCount} new</span>
//                   )}
//                 </div>
//                 <div className="flex items-center gap-2">
//                   {unreadCount > 0 && (
//                     <button onClick={handleMarkRead}
//                       className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-body">
//                       <CheckCheck size={12} /> All read
//                     </button>
//                   )}
//                   <button onClick={() => setOpen(false)}>
//                     <X size={14} className="text-slate-400 hover:text-slate-600" />
//                   </button>
//                 </div>
//               </div>

//               <div className="max-h-72 overflow-y-auto">
//                 {notifications.length === 0 ? (
//                   <div className="py-10 text-center">
//                     <Bell size={24} className="text-slate-200 mx-auto mb-2" />
//                     <p className="text-sm text-slate-400 font-body">No notifications yet</p>
//                   </div>
//                 ) : notifications.map((n, i) => (
//                   <motion.div key={n.notification_id}
//                     initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
//                     transition={{ delay: i * 0.03 }}
//                     className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
//                       ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
//                     <div className="flex items-start gap-2.5">
//                       <span className="text-base mt-0.5 shrink-0">
//                         {TYPE_ICONS[n.type] || '🔔'}
//                       </span>
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-semibold text-slate-800 font-body leading-snug">{n.title}</p>
//                         <p className="text-xs text-slate-500 font-body mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
//                         <p className="text-[10px] text-slate-400 mt-1">{formatDistanceToNow(n.created_at)}</p>
//                       </div>
//                       {!n.is_read && (
//                         <div className="w-2 h-2 bg-primary-500 rounded-full mt-1 shrink-0" />
//                       )}
//                     </div>
//                   </motion.div>
//                 ))}
//               </div>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>
//     </div>
//   )
// }
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CheckCheck, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { complaintsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

interface Notification {
  notification_id: string
  type: string
  title: string
  message?: string
  body?: string
  complaint_id: string | null
  is_read: boolean
  created_at: string
  complaint_title?: string
  complaint_category?: string
  complaint_status?: string
}

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_ICONS: Record<string, string> = {
  complaint_submitted:  '📋',
  complaint_assigned:   '👷',
  complaint_acknowledged: '✅',
  complaint_in_progress: '🔧',
  complaint_resolved:   '🎉',
  complaint_closed:     '✔️',
  dispute_opened:       '⚠️',
  self_assigned:        '✅',
  complaint_rated:      '⭐',
  new_assignment:       '📬',
  sla_warning:          '⏱️',
  sla_breach:           '🚨',
  status_update:        '📌',
  assignment:           '📬',
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { role } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await complaintsAPI.myNotifications()
      setNotifs(data.notifications || [])
      setUnread(data.unread_count || 0)
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchNotifs()
    // Poll every 30s for new notifications
    pollRef.current = setInterval(fetchNotifs, 30000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchNotifs])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markAllRead = async () => {
    try {
      await complaintsAPI.markAllRead()
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnread(0)
    } catch {
      toast.error('Failed to mark as read')
    }
  }

  const handleNotifClick = async (notif: Notification) => {
    // Mark this one as read
    if (!notif.is_read) {
      try {
        await complaintsAPI.markNotificationRead(notif.notification_id)
        setNotifs(prev => prev.map(n =>
          n.notification_id === notif.notification_id ? { ...n, is_read: true } : n
        ))
        setUnread(prev => Math.max(0, prev - 1))
      } catch {}
    }

    setOpen(false)

    // Navigate to the complaint
    if (notif.complaint_id) {
      if (role === 'citizen') {
        navigate(`/citizen/track/${notif.complaint_id}`)
      } else if (role === 'officer') {
        navigate(`/officer/complaint/${notif.complaint_id}`)
      } else if (role === 'admin') {
        navigate(`/citizen/track/${notif.complaint_id}`)
      }
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs() }}
        className="relative w-10 h-10 rounded-xl bg-slate-800 border border-slate-700
                   flex items-center justify-center hover:bg-slate-700 transition-colors"
      >
        {unread > 0
          ? <BellRing size={18} className="text-primary-400 animate-pulse" />
          : <Bell size={18} className="text-slate-400" />
        }
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
                           text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-slate-900
                       border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-primary-400" />
                <h3 className="font-semibold text-white text-sm font-body">Notifications</h3>
                {unread > 0 && (
                  <span className="px-2 py-0.5 bg-primary-600/30 border border-primary-500/30
                                   rounded-full text-xs text-primary-300 font-mono">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400
                               hover:text-slate-200 transition-colors" title="Mark all read">
                    <CheckCheck size={14} />
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400
                             hover:text-slate-200 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-slate-500" />
                </div>
              ) : notifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={24} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-body">No notifications yet</p>
                </div>
              ) : (
                notifs.map(n => (
                  <button
                    key={n.notification_id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/60
                                hover:bg-slate-800/60 transition-colors group
                                ${!n.is_read ? 'bg-primary-950/30' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <span className="text-lg shrink-0 mt-0.5">
                        {TYPE_ICONS[n.type] || '📌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold font-body truncate
                            ${!n.is_read ? 'text-white' : 'text-slate-300'}`}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-body mt-0.5 line-clamp-2">
                          {n.message || n.body || ''}
                        </p>
                        {n.complaint_title && (
                          <p className="text-xs text-slate-500 font-body mt-1 truncate">
                            🗂 {n.complaint_title}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-600 font-body mt-1">
                          {timeAgo(n.created_at)}
                          {n.complaint_id && (
                            <span className="ml-2 text-primary-500 group-hover:text-primary-400">
                              → View complaint
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-600 font-body">
                  Showing last {notifs.length} notifications
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}