import { ReactNode, useEffect, useCallback, useState } from 'react'
import { useNavigate, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Map as MapIcon, BarChart3, Bell, Users, BookOpen, LogOut, MapPin, Menu, Shield, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNotifStore } from '@/stores/notificationStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { complaintsAPI } from '@/lib/api'
import toast from 'react-hot-toast'

export const ADMIN_NAV =[
  { to: '/admin/dashboard', label: 'Overview',   icon: <LayoutDashboard size={18} /> },
  { to: '/admin/heatmap',   label: 'City Map',   icon: <MapIcon size={18} /> },
  { to: '/admin/analytics', label: 'Analytics',  icon: <BarChart3 size={18} /> },
  { to: '/admin/alerts',    label: 'Alerts',     icon: <Bell size={18} /> },
  { to: '/admin/officers',  label: 'Officers',   icon: <Users size={18} /> },
  { to: '/admin/digests',   label: 'Digests',    icon: <BookOpen size={18} /> },
  { to: '/admin/profile',   label: 'My Profile', icon: <User size={18} /> },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { fullName, logout } = useAuthStore()
  const { addNotification, setNotifications, unreadCount } = useNotifStore()
  const navigate = useNavigate()
  const location = useLocation()
  const[mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false) // ✅ NEW: Collapse State
  const [showLogout, setShowLogout] = useState(false)

  useEffect(() => {
    complaintsAPI.myNotifications().then(r => setNotifications(r.data.notifications ||[], r.data.unread_count || 0)).catch(() => {})
  },[])

  useWebSocket(useCallback((msg: any) => {
    if (msg.event === 'notification') {
      addNotification({ ...msg, is_read: false, created_at: new Date().toISOString(), user_role: 'admin' })
      toast(msg.title, { icon: '🔔' })
    }
  }, [addNotification]))

  const handleLogout = () => { logout(); navigate('/admin'); }

  return (
    // ✅ FIX: h-screen overflow-hidden ensures it acts like an app, not a scrolling document
    <div className="flex h-screen overflow-hidden bg-slate-950">
      
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 md:hidden" />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out h-full
                    ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${collapsed ? 'w-20' : 'w-64'}`}>
        
        {/* Logo & Toggle */}
        <div className={`flex items-center justify-between px-4 py-5 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600/20 border border-primary-500/40 flex items-center justify-center shrink-0">
              <MapPin size={16} className="text-primary-400" />
            </div>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-nowrap">
                <p className="font-display font-bold text-white text-[15px]">NagarMind</p>
                <p className="text-[10px] text-slate-500 font-body tracking-wider uppercase">Admin Console</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Toggle Button (Desktop Only) */}
        <button onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-6 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center text-slate-400 hover:text-white z-50 transition-colors">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {ADMIN_NAV.map(item => {
            const isActive = location.pathname === item.to || (item.to === '/admin/officers' && location.pathname.includes('/admin/officers/'))
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/admin/dashboard'} onClick={() => setMobileMenuOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`relative flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-body font-medium transition-colors group z-10 ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'} ${collapsed ? 'justify-center' : ''}`}>
                {isActive && (
                  <motion.div layoutId="sidebar-active" className="absolute inset-0 bg-primary-600/20 border border-primary-500/30 rounded-xl -z-10" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <div className="shrink-0">{item.icon}</div>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.label === 'Alerts' && unreadCount > 0 && (
                  <span className="ml-auto min-w-[20px] h-[20px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {/* Red dot for collapsed state */}
                {collapsed && item.label === 'Alerts' && unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User Profile Area */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <div className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800 rounded-xl transition-colors ${collapsed ? 'justify-center px-0' : ''}`} onClick={() => navigate('/admin/profile')}>
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
              <Shield size={16} className="text-slate-300" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 font-body truncate">{fullName}</p>
                <p className="text-[10px] text-slate-500 font-body">Administrator</p>
              </div>
            )}
          </div>
          <button onClick={() => setShowLogout(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all font-body ${collapsed ? 'justify-center' : ''}`}>
            <LogOut size={16} /> {!collapsed && "Log Out"}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        <header className="md:hidden shrink-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileMenuOpen(true)} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
            <Menu size={18} className="text-slate-300" />
          </button>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary-400" />
            <span className="font-display font-bold text-white text-sm">NagarMind Admin</span>
          </div>
          <div className="w-9" />
        </header>

        {/* ✅ FIX: Main container scrolls independently */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {children}
          </motion.div>
        </main>
      </div>

      {/* Logout Modal remains unchanged */}
      <AnimatePresence>
        {showLogout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setShowLogout(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4"><LogOut size={22} className="text-red-400" /></div>
              <h2 className="font-display font-bold text-white text-lg mb-1">Log Out?</h2>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowLogout(false)} className="flex-1 py-3 border border-slate-600 text-slate-300 rounded-2xl font-body font-semibold text-sm hover:bg-slate-700 transition-colors">Cancel</button>
                <button onClick={handleLogout} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-body font-semibold text-sm transition-colors">Log Out</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}