import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, MapPin, TrendingUp, Clock, Star, ChevronRight, Bell } from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { complaintsAPI, citizenAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { CATEGORY_CONFIG, STATUS_CONFIG, type Complaint } from '@/types'
import { formatDistanceToNow, formatSLACountdown, slugToLabel } from '@/lib/utils'
import { ComplaintCard } from '@/components/citizen/ComplaintCard'

const NAV_ITEMS = [
  { to: '/citizen/dashboard',   label: 'Home',        icon: '🏠' },
  { to: '/citizen/submit',      label: 'Report',      icon: '📝' },
  { to: '/citizen/complaints',  label: 'My Issues',   icon: '📋' },
  { to: '/citizen/digest',      label: 'Ward Digest', icon: '📊' },
  { to: '/citizen/profile',     label: 'Profile',     icon: '👤' },
]

export function CitizenDashboardPage() {
  const navigate = useNavigate()
  const { fullName, wardId } = useAuthStore()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      complaintsAPI.mine({ limit: 5 }),
      citizenAPI.profile(),
    ]).then(([cRes, pRes]) => {
      setComplaints(cRes.data.complaints || [])
      setProfile(pRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const pending  = complaints.filter(c => !['resolved','closed'].includes(c.status))
  const resolved = complaints.filter(c => ['resolved','closed'].includes(c.status))

   return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="space-y-6">
        {/* ── Greeting ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm font-body">Good day 👋</p>
            <h1 className="font-display font-bold text-2xl text-white">{fullName?.split(' ')[0] || 'Citizen'}</h1>
            {profile?.ward_name && (
              <p className="text-sm text-slate-400 font-body flex items-center gap-1 mt-0.5">
                <MapPin size={12} className="text-primary-500" /> {profile.ward_name}
              </p>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/citizen/submit')}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white
                       px-4 py-3 rounded-2xl font-semibold text-sm font-body shadow-glow-blue transition-all">
            <Plus size={16} /> Report Issue
          </motion.button>
        </motion.div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Filed', value: profile?.total_complaints ?? 0, icon: '📋', color: 'text-slate-100', bg: 'border-slate-700' },
            { label: 'Pending',     value: pending.length,                 icon: '⏳', color: 'text-amber-400', bg: 'border-amber-500/30' },
            { label: 'Resolved',    value: resolved.length,                icon: '✅', color: 'text-green-400', bg: 'border-green-500/30' },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className={`bg-slate-900 border ${s.bg} rounded-2xl p-4 text-center`}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400 font-body">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Recent complaints ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-white">Recent Issues</h2>
            <button onClick={() => navigate('/citizen/complaints')}
              className="text-sm text-primary-400 hover:text-primary-300 font-body flex items-center gap-1">
              View all <ChevronRight size={14} />
            </button>
          </div>
          {/* ... render ComplaintCard components here (update ComplaintCard.tsx to be dark too) ... */}
          {complaints.map(c => <div key={c.complaint_id} className="mb-2"><ComplaintCard complaint={c} /></div>)}
        </div>
      </div>
    </AppShell>
  )
}