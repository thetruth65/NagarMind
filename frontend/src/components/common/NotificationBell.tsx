import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useNotifStore } from '@/stores/notificationStore'
import { complaintsAPI } from '@/lib/api'
import { formatDistanceToNow } from '@/lib/utils'

const TYPE_ICONS: Record<string, string> = {
  complaint_assigned:  '👷',
  complaint_in_progress: '🔧',
  complaint_resolved:  '✅',
  sla_breach:          '🚨',
  sla_warning:         '⏰',
  dispute_opened:      '⚠️',
  dispute_resolved:    '🔄',
  new_assignment:      '📋',
}

const TYPE_COLORS: Record<string, string> = {
  complaint_assigned:  'bg-blue-100 text-blue-700',
  complaint_in_progress: 'bg-amber-100 text-amber-700',
  complaint_resolved:  'bg-green-100 text-green-700',
  sla_breach:          'bg-red-100 text-red-700',
  sla_warning:         'bg-orange-100 text-orange-700',
  dispute_opened:      'bg-orange-100 text-orange-700',
  dispute_resolved:    'bg-purple-100 text-purple-700',
  new_assignment:      'bg-blue-100 text-blue-700',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markAllRead } = useNotifStore()

  const handleMarkRead = async () => {
    try { await complaintsAPI.markAllRead() } catch {}
    markAllRead()
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25
                   flex items-center justify-center transition-colors">
        <Bell size={17} className="text-white" />
        {unreadCount > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full
                       text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 bg-white rounded-3xl shadow-2xl
                         border border-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-slate-800 text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="badge bg-primary-100 text-primary-700">{unreadCount} new</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkRead}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-body">
                      <CheckCheck size={12} /> All read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)}>
                    <X size={14} className="text-slate-400 hover:text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 font-body">No notifications yet</p>
                  </div>
                ) : notifications.map((n, i) => (
                  <motion.div key={n.notification_id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
                      ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base mt-0.5 shrink-0">
                        {TYPE_ICONS[n.type] || '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 font-body leading-snug">{n.title}</p>
                        <p className="text-xs text-slate-500 font-body mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatDistanceToNow(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 bg-primary-500 rounded-full mt-1 shrink-0" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}