import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, ArrowLeft, MapPin } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { wardsAPI } from '@/lib/api'
import toast from 'react-hot-toast'

const ZONES =["North", "North-West", "North-East", "Shahdara", "East", "New Delhi", "Central", "West", "South-West", "South"]

export function AdminDigestsPage() {
  const navigate = useNavigate()
  const [wards, setWards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'ward'|'zone'|'city'>('ward')

  useEffect(() => {
    wardsAPI.list().then(r => setWards(r.data)).finally(() => setLoading(false))
  },[])

  const filteredWards = wards.filter(w => w.ward_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <AdminShell>
      <div className="space-y-6">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>

        <div>
          <h1 className="font-display font-bold text-2xl text-white">Digest Analysis Center</h1>
          <p className="text-slate-400 text-sm font-body mt-1">Select an entity to view its historical AI digest reports.</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
          {[
            { id: 'ward', label: '🏘️ Wards' },
            { id: 'zone', label: '🗺️ Zones' },
            { id: 'city', label: '🏙️ Full City' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold font-body transition-colors ${tab === t.id ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Ward View */}
        {tab === 'ward' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search wards..." className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 text-white rounded-xl outline-none focus:border-primary-500 text-sm" />
            </div>
            {loading ? ( <div className="text-slate-400">Loading...</div> ) : (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredWards.map(w => (
                  <button key={w.ward_id} onClick={() => navigate(`/digest?type=ward&id=${w.ward_id}`)} className="text-left bg-slate-900 border border-slate-800 p-4 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all">
                    <p className="font-display font-bold text-white text-base">{w.ward_name}</p>
                    <p className="text-xs text-slate-500 font-body flex items-center gap-1 mt-1"><MapPin size={10}/> {w.zone} Zone</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Zone View */}
        {tab === 'zone' && (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ZONES.map(z => (
              <button key={z} onClick={() => navigate(`/digest?type=zone&id=${z}`)} className="text-left bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all group">
                <div className="text-3xl mb-2">🗺️</div>
                <p className="font-display font-bold text-white text-lg group-hover:text-primary-400 transition-colors">{z} Zone</p>
                <p className="text-xs text-slate-500 font-body mt-1">View combined zone digest</p>
              </button>
            ))}
          </div>
        )}

        {/* City View */}
        {tab === 'city' && (
          <div className="max-w-md">
            {/* ✅ FIX: City type doesn't need an ID */}
            <button onClick={() => navigate(`/digest?type=city`)} className="w-full text-left bg-gradient-to-br from-slate-900 to-primary-950/20 border border-primary-500/30 p-6 rounded-2xl hover:border-primary-500/60 transition-all group">
              <div className="text-5xl mb-3">🏙️</div>
              <h2 className="font-display font-bold text-2xl text-white group-hover:text-primary-400 transition-colors">MCD Delhi State</h2>
              <p className="text-sm text-slate-400 font-body mt-2">Complete city-wide analytics, health scores, and AI summaries across all 272 wards.</p>
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  )
}