import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, TrendingUp, BarChart3, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { wardsAPI } from '@/lib/api'

export function DigestSelectionPage() {
  const navigate = useNavigate()
  const { role, wardId } = useAuthStore()
  const [myWard, setMyWard] = useState<any>(null)

  useEffect(() => {
    if (wardId) {
      wardsAPI.get(wardId).then(r => setMyWard(r.data)).catch(() => {})
    }
  }, [wardId])

  // Nav config based on role
  const NAV_ITEMS = role === 'citizen' ?[
    { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
    { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
    { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
    { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
    { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
  ] :[
    { to: '/officer/dashboard', label: 'Dashboard', icon: <span>🏠</span> },
    { to: '/officer/inbox',     label: 'Inbox',     icon: <span>📋</span> },
    { to: '/officer/digest',    label: 'Digest',    icon: <span>📊</span> },
    { to: '/officer/profile',   label: 'Profile',   icon: <span>👤</span> },
  ]

  return (
    <AppShell navItems={NAV_ITEMS} role={role as any}>
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Digest Analysis Center</h1>
          <p className="text-slate-400 text-sm font-body mt-1">View weekly AI-generated civic performance reports.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          
          {/* Ward Card */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => myWard ? navigate(`/digest?type=ward&id=${wardId}`) : null}
            disabled={!myWard}
            className="text-left bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-primary-500/50 transition-all group disabled:opacity-50">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl mb-4">🏘️</div>
            <h2 className="font-display font-bold text-xl text-white group-hover:text-primary-400 transition-colors">Your Ward</h2>
            <p className="text-sm text-slate-400 font-body mt-2 h-10">
              {myWard ? myWard.ward_name : 'No ward assigned'}
            </p>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary-500 font-body uppercase tracking-wider">
              View Report <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* Zone Card */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => myWard?.zone ? navigate(`/digest?type=zone&id=${myWard.zone}`) : null}
            disabled={!myWard?.zone}
            className="text-left bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-primary-500/50 transition-all group disabled:opacity-50">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl mb-4">🗺️</div>
            <h2 className="font-display font-bold text-xl text-white group-hover:text-primary-400 transition-colors">Your Zone</h2>
            <p className="text-sm text-slate-400 font-body mt-2 h-10">
              {myWard?.zone ? `${myWard.zone} Zone` : 'No zone assigned'}
            </p>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary-500 font-body uppercase tracking-wider">
              View Report <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* City Card */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/digest?type=city')}
            className="text-left bg-gradient-to-br from-slate-900 to-primary-950/30 border border-slate-800 p-6 rounded-2xl hover:border-primary-500/50 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-2xl mb-4">🏙️</div>
            <h2 className="font-display font-bold text-xl text-white group-hover:text-primary-400 transition-colors">MCD Delhi</h2>
            <p className="text-sm text-slate-400 font-body mt-2 h-10">Full state-level AI analysis across 272 wards</p>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary-500 font-body uppercase tracking-wider">
              View Report <ChevronRight size={14} />
            </div>
          </motion.button>

        </div>
      </div>
    </AppShell>
  )
}