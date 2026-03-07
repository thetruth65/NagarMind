import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronUp, ChevronDown, User, Star, CheckCircle, ArrowLeft } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { adminAPI } from '@/lib/api'
import toast from 'react-hot-toast'

type OfficerRow = {
  officer_id: string; full_name: string; employee_id: string
  role: string; ward_name: string; zone: string; department: string
  total_assigned: number; total_resolved: number; total_breached: number
  avg_resolution_hours: number | null; avg_rating: number | null
  is_active: boolean;
}

type SortKey = 'full_name' | 'total_assigned' | 'total_resolved' | 'avg_rating'
type SortDir = 'asc' | 'desc'

export function AdminOfficersPage() {
  const navigate = useNavigate()
  const [officers, setOfficers] = useState<OfficerRow[]>([])
  const[loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const[zone, setZone]         = useState('')
  const [ward, setWard]         = useState('')
  const [dept, setDept]         = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('total_resolved')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')

  useEffect(() => {
    adminAPI.officers().then(r => setOfficers(r.data.officers ||[]))
      .catch(() => toast.error('Failed to load officers'))
      .finally(() => setLoading(false))
  },[])

  const zones = [...new Set(officers.map(o => o.zone).filter(Boolean))]
  const depts =[...new Set(officers.map(o => o.department).filter(Boolean))]
  const availableWards = [...new Set(officers.map(o => o.ward_name).filter(Boolean))].sort()

  const sorted = [...officers]
    .filter(o => {
      const q = search.toLowerCase()
      const matchQ = !q || o.full_name.toLowerCase().includes(q) || o.employee_id.toLowerCase().includes(q) || o.ward_name?.toLowerCase().includes(q)
      const matchZ = !zone || o.zone === zone
      const matchW = !ward || o.ward_name === ward
      const matchD = !dept || o.department === dept
      return matchQ && matchZ && matchD && matchW
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? -1; const bv = b[sortKey] ?? -1
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : <ChevronDown size={12} className="opacity-30" />
  const resRate = (o: OfficerRow) => o.total_assigned > 0 ? Math.round((o.total_resolved / o.total_assigned) * 100) : 0

  return (
    <AdminShell>
      <div className="space-y-5">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>

        <div>
          <h1 className="font-display font-bold text-2xl text-white">Officers</h1>
          <p className="text-slate-400 text-sm font-body mt-0.5">All field officers across 272 wards</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-sm font-body outline-none focus:border-primary-500 placeholder:text-slate-600" />
          </div>
          <select value={zone} onChange={e => setZone(e.target.value)} className="px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-body outline-none focus:border-primary-500">
            <option value="">All Zones</option>{zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <select value={ward} onChange={e => setWard(e.target.value)} className="px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-body outline-none focus:border-primary-500 max-w-[200px] truncate">
            <option value="">All Wards</option>{availableWards.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={dept} onChange={e => setDept(e.target.value)} className="px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-body outline-none focus:border-primary-500">
            <option value="">All Depts</option>{depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="flex gap-3 text-xs font-body text-slate-400">
          <span>{sorted.length} officers shown</span><span>·</span>
          <span className="text-green-400">{officers.filter(o => o.is_active).length} active</span>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-slate-800/60 animate-pulse" />)}</div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-body font-bold uppercase tracking-wider text-slate-500">
              <div className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('full_name')}>Officer <SortIcon k="full_name" /></div>
              <div className="col-span-2">Ward / Zone</div>
              <div className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('total_assigned')}>Assigned <SortIcon k="total_assigned" /></div>
              <div className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('total_resolved')}>Resolved <SortIcon k="total_resolved" /></div>
              <div className="col-span-2">Resolution Rate</div>
              <div className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-slate-300" onClick={() => toggleSort('avg_rating')}>Rating <SortIcon k="avg_rating" /></div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Breach</div>
            </div>

            <div className="space-y-2">
              {sorted.map((o, i) => {
                const rate = resRate(o)
                return (
                  <motion.div key={o.officer_id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    onClick={() => navigate(`/admin/officers/${o.officer_id}`, { state: { officer: o } })}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 cursor-pointer transition-all hover:border-primary-500/50 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-primary-500/5">
                    
                    <div className="md:hidden">
                      <div className="flex justify-between mb-2">
                        <div><p className="font-semibold text-slate-200 text-sm">{o.full_name}</p><p className="text-[11px] text-slate-500">{o.employee_id} · {o.ward_name}</p></div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${o.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>{o.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>

                    <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-600/30 flex items-center justify-center"><User size={14} className="text-primary-400" /></div>
                        <div className="min-w-0"><p className="text-sm font-semibold text-slate-200 truncate">{o.full_name}</p><p className="text-[10px] text-slate-500">{o.employee_id}</p></div>
                      </div>
                      <div className="col-span-2"><p className="text-xs text-slate-300 truncate">{o.ward_name}</p><p className="text-[10px] text-slate-500">{o.zone}</p></div>
                      <div className="col-span-1 text-sm font-bold text-slate-300">{o.total_assigned}</div>
                      <div className="col-span-1 text-sm font-bold text-green-400">{o.total_resolved}</div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary-500" style={{ width: `${rate}%` }} /></div>
                          <span className="text-xs text-slate-300 w-8">{rate}%</span>
                        </div>
                      </div>
                      <div className="col-span-1 text-sm font-bold text-yellow-400 flex items-center gap-0.5">{o.avg_rating ? Number(o.avg_rating).toFixed(1) : '—'}{o.avg_rating && <Star size={10} className="fill-yellow-400 stroke-none" />}</div>
                      <div className="col-span-1"><span className={`text-[10px] px-2 py-1 rounded-full font-bold ${o.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>{o.is_active ? 'Active' : 'Off'}</span></div>
                      <div className="col-span-1">{o.total_breached > 0 ? <span className="text-xs text-red-400 font-bold">{o.total_breached}</span> : <CheckCircle size={14} className="text-green-500" />}</div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}