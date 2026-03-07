import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/common/AppShell'
import { ComplaintCard } from '@/components/citizen/ComplaintCard'
import { complaintsAPI } from '@/lib/api'
import type { Complaint } from '@/types'

const NAV_ITEMS = [
  { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
]

const STATUS_FILTERS = [
  { value: '',           label: 'All',         color: 'bg-slate-100 text-slate-700' },
  { value: 'submitted',  label: 'Submitted',   color: 'bg-slate-100 text-slate-600' },
  { value: 'assigned',   label: 'Assigned',    color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress',label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'resolved',   label: 'Resolved',    color: 'bg-green-100 text-green-700' },
  { value: 'disputed',   label: 'Disputed',    color: 'bg-red-100 text-red-700' },
]

export function CitizenComplaintsPage() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [status, setStatus]         = useState('')
  const [search, setSearch]         = useState('')
  const [offset, setOffset]         = useState(0)
  const LIMIT = 20

  const load = async (reset = false) => {
    setLoading(true)
    try {
      const off = reset ? 0 : offset
      const { data } = await complaintsAPI.mine({ status: status || undefined, limit: LIMIT, offset: off })
      setComplaints(reset ? data.complaints : [...complaints, ...data.complaints])
      setTotal(data.total)
      if (reset) setOffset(LIMIT)
      else setOffset(off + LIMIT)
    } finally { setLoading(false) }
  }

  useEffect(() => { load(true) }, [status])

  const filtered = search
    ? complaints.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.location_address?.toLowerCase().includes(search.toLowerCase()))
    : complaints

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="space-y-4">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">My Complaints</h1>
            <p className="text-sm text-slate-400 font-body">{total} total complaints filed</p>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/citizen/submit')}
            className="btn-primary flex items-center gap-2 py-2.5 text-sm">
            <Plus size={16} /> New Report
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search complaints..."
            className="input-field pl-9 py-3 text-sm" />
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatus(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-body whitespace-nowrap
                border-2 transition-all
                ${status === f.value ? 'border-primary-500 bg-primary-50 text-primary-700' : `border-slate-200 ${f.color}`}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading && complaints.length === 0 ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 card animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card p-10 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-display font-semibold text-slate-700 mb-1">No complaints found</p>
            <p className="text-sm text-slate-400 font-body">
              {search ? 'Try a different search term' : 'File your first complaint!'}
            </p>
          </motion.div>
        ) : (
          <>
            <div className="space-y-3">
              {filtered.map((c, i) => (
                <motion.div key={c.complaint_id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}>
                  <ComplaintCard complaint={c} />
                </motion.div>
              ))}
            </div>
            {complaints.length < total && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => load()}
                disabled={loading}
                className="w-full py-3 border-2 border-slate-200 rounded-2xl text-slate-600
                           font-body text-sm hover:border-slate-300 transition-colors">
                {loading ? 'Loading...' : 'Load More'}
              </motion.button>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}