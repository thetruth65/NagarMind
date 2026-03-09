import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, MapPin, ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { wardsAPI } from '@/lib/api'

const ZONES = [
  'North', 'North-West', 'North-East', 'Shahdara',
  'East', 'New Delhi', 'Central', 'West', 'South-West', 'South',
]

const CITIZEN_NAV = [
  { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
]

const OFFICER_NAV = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: <span>🏠</span> },
  { to: '/officer/inbox',     label: 'Inbox',     icon: <span>📋</span> },
  { to: '/officer/digest',    label: 'Digest',    icon: <span>📊</span> },
  { to: '/officer/profile',   label: 'Profile',   icon: <span>👤</span> },
]

export function DigestSelectionPage() {
  const navigate = useNavigate()
  const { role, wardId } = useAuthStore()

  const [wards, setWards]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [tab, setTab]             = useState<'ward' | 'zone' | 'city'>('ward')
  const [myWard, setMyWard]       = useState<any>(null)

  const navItems = role === 'citizen' ? CITIZEN_NAV : OFFICER_NAV
  const backPath = role === 'citizen' ? '/citizen/dashboard' : '/officer/dashboard'

  useEffect(() => {
    wardsAPI.list()
      .then(r => {
        const allWards = r.data
        setWards(allWards)
        if (wardId) {
          const mine = allWards.find((w: any) => w.ward_id === wardId)
          if (mine) setMyWard(mine)
        }
      })
      .finally(() => setLoading(false))
  }, [wardId])

  const filteredWards = wards.filter(w =>
    w.ward_name.toLowerCase().includes(search.toLowerCase()) ||
    (w.zone || '').toLowerCase().includes(search.toLowerCase())
  )

  // Group by zone for display
  const wardsByZone = filteredWards.reduce<Record<string, any[]>>((acc, w) => {
    const z = w.zone || 'Other'
    if (!acc[z]) acc[z] = []
    acc[z].push(w)
    return acc
  }, {})

  return (
    <AppShell navItems={navItems} role={role as any}>
      <div className="space-y-6">
        {/* Back */}
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => navigate(backPath)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>

        <div>
          <h1 className="font-display font-bold text-2xl text-white">Digest Analysis Center</h1>
          <p className="text-slate-400 text-sm font-body mt-1">
            Select an entity to view its weekly AI-generated civic reports.
          </p>
        </div>

        {/* My Ward Quick-Access (if assigned) */}
        {myWard && (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/digest?type=ward&id=${wardId}`)}
            className="w-full text-left bg-primary-600/10 border border-primary-500/40 p-4 rounded-2xl
              hover:bg-primary-600/20 hover:border-primary-500/70 transition-all group flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 text-primary-400 flex items-center justify-center text-xl shrink-0">🏘️</div>
            <div className="flex-1">
              <p className="text-xs text-primary-400 font-semibold font-body uppercase tracking-wider mb-0.5">Your Ward</p>
              <p className="font-display font-bold text-white text-lg">{myWard.ward_name}</p>
              <p className="text-xs text-slate-400 font-body flex items-center gap-1">
                <MapPin size={10} /> {myWard.zone} Zone
              </p>
            </div>
            <span className="text-primary-400 text-xs font-semibold font-body uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              View →
            </span>
          </motion.button>
        )}

        {/* Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
          {[
            { id: 'ward', label: '🏘️ Wards' },
            { id: 'zone', label: '🗺️ Zones' },
            { id: 'city', label: '🏙️ Full City' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold font-body transition-colors
                ${tab === t.id ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Ward Tab ── */}
        {tab === 'ward' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search ward or zone..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 text-white rounded-xl outline-none focus:border-primary-500 text-sm font-body" />
            </div>

            {loading ? (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : search ? (
              /* Search results: flat grid */
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredWards.map(w => (
                  <motion.button key={w.ward_id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/digest?type=ward&id=${w.ward_id}`)}
                    className={`text-left bg-slate-900 border p-4 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all
                      ${w.ward_id === wardId ? 'border-primary-500/40 bg-primary-600/5' : 'border-slate-800'}`}>
                    <p className="font-display font-bold text-white text-base">{w.ward_name}</p>
                    <p className="text-xs text-slate-500 font-body flex items-center gap-1 mt-1">
                      <MapPin size={10} /> {w.zone} Zone
                    </p>
                    {w.ward_id === wardId && (
                      <span className="text-[10px] text-primary-400 font-semibold font-body mt-1 block">Your ward</span>
                    )}
                  </motion.button>
                ))}
              </div>
            ) : (
              /* Grouped by zone */
              <div className="space-y-6">
                {Object.entries(wardsByZone).sort().map(([zone, zoneWards]) => (
                  <div key={zone}>
                    <h3 className="text-xs font-bold text-slate-500 font-body uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="h-px bg-slate-800 flex-1" />
                      {zone} Zone ({zoneWards.length} wards)
                      <span className="h-px bg-slate-800 flex-1" />
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {zoneWards.map(w => (
                        <motion.button key={w.ward_id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => navigate(`/digest?type=ward&id=${w.ward_id}`)}
                          className={`text-left bg-slate-900 border p-3 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all
                            ${w.ward_id === wardId ? 'border-primary-500/40 bg-primary-600/5' : 'border-slate-800'}`}>
                          <p className="font-semibold text-white text-sm font-body truncate">{w.ward_name}</p>
                          {w.ward_id === wardId && (
                            <span className="text-[10px] text-primary-400 font-semibold font-body">Your ward</span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Zone Tab ── */}
        {tab === 'zone' && (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ZONES.map(z => {
              const wardCount = wards.filter(w => w.zone === z).length
              const isMyZone = myWard?.zone === z
              return (
                <motion.button key={z}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/digest?type=zone&id=${z}`)}
                  className={`text-left bg-slate-900 border p-5 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all group
                    ${isMyZone ? 'border-primary-500/40 bg-primary-600/5' : 'border-slate-800'}`}>
                  <div className="text-3xl mb-2">🗺️</div>
                  <p className="font-display font-bold text-white text-lg group-hover:text-primary-400 transition-colors">
                    {z} Zone
                  </p>
                  <p className="text-xs text-slate-500 font-body mt-1">
                    {wardCount > 0 ? `${wardCount} wards` : 'View zone digest'}
                  </p>
                  {isMyZone && (
                    <span className="text-[10px] text-primary-400 font-semibold font-body mt-1 block">Your zone</span>
                  )}
                </motion.button>
              )
            })}
          </div>
        )}

        {/* ── City Tab ── */}
        {tab === 'city' && (
          <div className="max-w-md">
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/digest?type=city')}
              className="w-full text-left bg-gradient-to-br from-slate-900 to-primary-950/20 border border-primary-500/30 p-6 rounded-2xl hover:border-primary-500/60 transition-all group">
              <div className="text-5xl mb-3">🏙️</div>
              <h2 className="font-display font-bold text-2xl text-white group-hover:text-primary-400 transition-colors">
                MCD Delhi — Full City
              </h2>
              <p className="text-sm text-slate-400 font-body mt-2 leading-relaxed">
                Complete city-wide analytics, health scores, and AI summaries across all 272 wards and all 10 zones.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary-500 font-body uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                View City Report →
              </div>
            </motion.button>
          </div>
        )}
      </div>
    </AppShell>
  )
}