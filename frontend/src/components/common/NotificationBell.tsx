/**
 * NotificationBell.tsx — Portal-based dropdown
 *
 * Fixes applied vs previous version:
 *  - uses `role` (not `user`) from useAuthStore
 *  - uses `complaintsAPI.myNotifications()` (not notificationsAPI)
 *  - uses `complaintsAPI.markAllRead()` / `complaintsAPI.markNotificationRead()`
 *  - notification shape uses `notification_id` (not `id`)
 *  - navigate path depends on role
 *  - portal approach retained: mounts in document.body, z-index 9999
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bell, BellRing, X, CheckCheck, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { complaintsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

interface Notification {
  notification_id: string
  type: string
  title: string
  message?: string
  body?: string
  complaint_title?: string
  complaint_id: string | null
  is_read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  complaint_submitted:    '📋',
  complaint_assigned:     '📬',
  complaint_acknowledged: '✅',
  complaint_in_progress:  '🔧',
  work_started:           '🔧',
  status_update:          '📊',
  complaint_resolved:     '🎉',
  complaint_closed:       '✔️',
  resolution_disputed:    '⚠️',
  dispute_opened:         '⚠️',
  officer_comment:        '💬',
  new_message:            '💬',
  rating_request:         '⭐',
  complaint_rated:        '⭐',
  complaint_escalated:    '🚨',
  sla_warning:            '⏱️',
  sla_breach:             '🚨',
  deadline_approaching:   '⏰',
  complaint_overdue:      '🔴',
  self_assigned:          '✅',
  new_assignment:         '📬',
  digest_ready:           '📰',
  ward_alert:             '📢',
  admin_alert:            '📢',
  assignment:             '📬',
  system:                 '🔔',
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

interface PanelPos { top: number; right: number }

export function NotificationBell() {
  const navigate = useNavigate()
  const { role } = useAuthStore()   // ← correct field from your authStore
  const btnRef   = useRef<HTMLButtonElement>(null)

  const [open, setOpen]     = useState(false)
  const [pos, setPos]       = useState<PanelPos>({ top: 64, right: 16 })
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  // ── Compute position ──────────────────────────────────────────────────────
  const computePos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
  }, [])

  const handleOpen = () => { computePos(); setOpen(v => !v) }

  // ── Reposition on scroll / resize ────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', computePos, true)
    window.addEventListener('resize', computePos)
    return () => {
      window.removeEventListener('scroll', computePos, true)
      window.removeEventListener('resize', computePos)
    }
  }, [open, computePos])

  // ── Close on outside click / Escape ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-notif-panel]') && !t.closest('[data-notif-btn]')) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', esc) }
  }, [open])

  // ── Fetch + 30s poll ─────────────────────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    if (!role) return
    setLoading(true)
    try {
      const { data } = await complaintsAPI.myNotifications()
      const list: Notification[] = data.notifications || []
      setNotifs(list)
      setUnread(data.unread_count ?? list.filter(n => !n.is_read).length)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [role])

  useEffect(() => {
    fetchNotifs()
    const t = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(t)
  }, [fetchNotifs])

  // ── Mark all read ─────────────────────────────────────────────────────────
  const markAllRead = async () => {
    try {
      await complaintsAPI.markAllRead()
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnread(0)
    } catch { toast.error('Failed to mark as read') }
  }

  // ── Click a notification ──────────────────────────────────────────────────
  const handleNotifClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await complaintsAPI.markNotificationRead(notif.notification_id)
        setNotifs(prev => prev.map(n =>
          n.notification_id === notif.notification_id ? { ...n, is_read: true } : n
        ))
        setUnread(prev => Math.max(0, prev - 1))
      } catch { /* silent */ }
    }
    setOpen(false)
    if (!notif.complaint_id) return
    if (role === 'citizen') navigate(`/citizen/track/${notif.complaint_id}`)
    else if (role === 'officer') navigate(`/officer/complaint/${notif.complaint_id}`)
    else navigate(`/citizen/track/${notif.complaint_id}`)
  }

  // ── Portal panel ──────────────────────────────────────────────────────────
  const panel = open ? createPortal(
    <>
      {/* Backdrop */}
      <div onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }} aria-hidden />

      {/* Panel — mounted directly in document.body, beats all stacking contexts */}
      <div data-notif-panel style={{
        position: 'fixed', top: pos.top, right: pos.right,
        width: 'min(400px, calc(100vw - 1rem))',
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        borderRadius: '1rem',
        border: '1px solid rgb(51 65 85)',
        background: 'rgb(15 23 42)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid rgb(30 41 59)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={16} style={{ color: 'rgb(148 163 184)' }} />
            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>Notifications</span>
            {unread > 0 && (
              <span style={{
                background: 'rgb(37 99 235)', color: 'white',
                fontSize: '0.7rem', fontWeight: 700,
                padding: '1px 8px', borderRadius: '999px',
              }}>{unread} new</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {unread > 0 && (
              <button onClick={markAllRead} title="Mark all read" style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '4px 10px', borderRadius: '8px', border: 'none',
                background: 'rgb(30 41 59)', color: 'rgb(148 163 184)',
                fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              }}>
                <CheckCheck size={12} /> All read
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: 'rgb(30 41 59)', color: 'rgb(148 163 184)', cursor: 'pointer',
            }}><X size={14} /></button>
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flexGrow: 1 }}>
          {loading && notifs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'rgb(100 116 139)' }}>Loading…</div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <Bell size={24} style={{ color: 'rgb(51 65 85)', margin: '0 auto 0.5rem' }} />
              <p style={{ color: 'rgb(100 116 139)', fontSize: '0.875rem' }}>No notifications yet</p>
            </div>
          ) : (
            notifs.map(n => (
              <div key={n.notification_id}
                onClick={() => handleNotifClick(n)}
                style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: '1px solid rgb(30 41 59)',
                  background: n.is_read ? 'transparent' : 'rgba(37,99,235,0.06)',
                  cursor: n.complaint_id ? 'pointer' : 'default',
                  display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                }}
                onMouseEnter={e => { if (n.complaint_id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.is_read ? 'transparent' : 'rgba(37,99,235,0.06)' }}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>
                  {TYPE_ICONS[n.type] ?? '📌'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <p style={{
                      color: n.is_read ? 'rgb(148 163 184)' : 'white',
                      fontSize: '0.85rem', fontWeight: n.is_read ? 400 : 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>{n.title}</p>
                    {!n.is_read && <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'rgb(37 99 235)', flexShrink: 0,
                    }} />}
                  </div>
                  <p style={{
                    color: 'rgb(100 116 139)', fontSize: '0.75rem', lineHeight: 1.4, marginBottom: '0.3rem',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                  }}>{n.message || n.body || ''}</p>
                  {n.complaint_title && (
                    <p style={{ color: 'rgb(71 85 105)', fontSize: '0.7rem', fontStyle: 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.25rem' }}>
                      🗂 {n.complaint_title}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'rgb(71 85 105)', fontSize: '0.7rem' }}>{timeAgo(n.created_at)}</span>
                    {n.complaint_id && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem',
                        color: 'rgb(59 130 246)', fontSize: '0.7rem' }}>
                        <ExternalLink size={10} /> View complaint
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifs.length > 0 && (
          <div style={{ padding: '0.6rem', borderTop: '1px solid rgb(30 41 59)',
            textAlign: 'center', color: 'rgb(71 85 105)', fontSize: '0.72rem', flexShrink: 0 }}>
            Showing last {notifs.length} notifications
          </div>
        )}
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
      <button ref={btnRef} data-notif-btn onClick={handleOpen} aria-label="Notifications"
        className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors hover:bg-slate-700/60"
        style={{ border: 'none', cursor: 'pointer', background: open ? 'rgb(30 41 59)' : 'transparent', color: 'rgb(148 163 184)' }}>
        {unread > 0
          ? <BellRing size={19} style={{ color: 'rgb(96 165 250)' }} className="animate-pulse" />
          : <Bell size={19} />
        }
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 5, right: 5,
            minWidth: 16, height: 16, borderRadius: '999px',
            background: 'rgb(239 68 68)', border: '2px solid rgb(15 23 42)',
            fontSize: '0.6rem', fontWeight: 700, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {panel}
    </>
  )
}