import { ReactNode, useEffect, useCallback, useState } from 'react'
import { useNavigate, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, LogOut, User, Menu, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNotifStore } from '@/stores/notificationStore'
import { NotificationBell } from './NotificationBell'
import { useWebSocket } from '@/hooks/useWebSocket'
import { complaintsAPI } from '@/lib/api'
import toast from 'react-hot-toast'

interface NavItem { to: string; label: string; icon: ReactNode }
interface Props { children: ReactNode; navItems: NavItem[]; role: 'citizen' | 'officer' }

export function AppShell({ children, navItems, role }: Props) {
  const { fullName, logout } = useAuthStore()
  const { addNotification, setNotifications, unreadCount } = useNotifStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const[mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const[showLogout, setShowLogout] = useState(false)

  useEffect(() => {
    complaintsAPI.myNotifications().then(r => {
      setNotifications(r.data.notifications ||[], r.data.unread_count || 0)
    }).catch(() => {})
  },[])

  const handleWS = useCallback((msg: any) => {
    if (msg.event === 'notification') {
      addNotification({ ...msg, notification_id: msg.notif_id, is_read: false, created_at: new Date().toISOString(), user_id: '', user_role: role })
      toast(msg.title, { icon: '🔔', duration: 4000 })
    }
  }, [addNotification, role])
  useWebSocket(handleWS)

  const handleLogout = () => {
    logout()
    navigate(role === 'citizen' ? '/citizen/auth' : '/officer/auth')
  }

  const profilePath = role === 'citizen' ? '/citizen/profile' : '/officer/profile'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      
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
                <p className="text-[10px] text-slate-500 font-body tracking-wider uppercase">
                  {role === 'citizen' ? 'Citizen Portal' : 'Officer Console'}
                </p>
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
          {navItems.map(item => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`relative flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-body font-medium transition-colors group z-10 ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'} ${collapsed ? 'justify-center' : ''}`}>
                {isActive && (
                  <motion.div layoutId="sidebar-active" className="absolute inset-0 bg-primary-600/20 border border-primary-500/30 rounded-xl -z-10" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <div className="shrink-0">{item.icon}</div>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User Profile Area */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <div className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800 rounded-xl transition-colors ${collapsed ? 'justify-center px-0' : ''}`} onClick={() => navigate(profilePath)}>
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
              <User size={16} className="text-slate-300" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 font-body truncate">{fullName}</p>
                <p className="text-[10px] text-slate-500 font-body capitalize">{role}</p>
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
        <header className="shrink-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 h-14 flex items-center justify-between md:justify-end">
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center">
            <Menu size={18} className="text-slate-300" />
          </button>
          
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-5xl mx-auto">
            {children}
          </motion.div>
        </main>
      </div>

      {/* Logout Modal */}
      <AnimatePresence>
        {showLogout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowLogout(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4"><LogOut size={24} className="text-red-400" /></div>
              <h2 className="font-display font-bold text-white text-lg mb-1">Log Out?</h2>
              <p className="text-slate-400 text-sm font-body mb-6">You will need to verify your credentials to log back in.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowLogout(false)} className="flex-1 py-3 bg-slate-700 text-white hover:bg-slate-600 rounded-2xl font-body font-semibold text-sm transition-colors">Stay</button>
                <button onClick={handleLogout} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-body font-semibold text-sm transition-colors shadow-glow-blue">Log Out</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}