import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Calendar, MapPin } from 'lucide-react'
import { wardsAPI } from '@/lib/api'
import { CATEGORY_CONFIG } from '@/types'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import toast from 'react-hot-toast'

const CHART_COLORS =['#3b82f6','#22c55e','#f59e0b','#f43f5e','#8b5cf6']

export function WeeklyDigestPage() {
  const navigate = useNavigate()
  const[searchParams] = useSearchParams()
  const { digestId: paramId } = useParams() // Fallback if they hit the old /digest/:id route
  
  const type = searchParams.get('type') || 'ward'
  const id = searchParams.get('id') || paramId

  const [history, setHistory] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ✅ FIX: Allow null ID if type is city
    if (!id && type !== 'city') { 
      toast.error('Invalid parameters')
      navigate(-1)
      return
    }
    
    wardsAPI.getDigestHistory(type, id || undefined)
      .then(r => {
        const digests = r.data.digests || []
        setHistory(digests)
        if (digests.length > 0) setSelected(digests[0])
      })
      .catch(() => toast.error('Failed to load digest history'))
      .finally(() => setLoading(false))
  }, [type, id])

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  
  if (history.length === 0 || !selected) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <div className="text-4xl mb-4">📭</div>
      <p className="text-slate-300 font-body mb-4">No digests have been generated for this area yet.</p>
      <button onClick={() => navigate(-1)} className="text-primary-400 hover:text-primary-300">← Go back</button>
    </div>
  )

  // Chart Data preparation
  const trendData = [...history].reverse().map(d => ({
    week: format(new Date(d.week_start), 'MMM d'),
    resolved: d.resolved_complaints,
    total: d.total_complaints,
    score: Number(d.health_score_end || 0).toFixed(1)
  }))

  const resRate = selected.total_complaints > 0 ? Math.round((selected.resolved_complaints / selected.total_complaints) * 100) : 0
  let catPieData =[]
  if (selected.category_breakdown) {
    try {
      const parsed = typeof selected.category_breakdown === 'string' ? JSON.parse(selected.category_breakdown) : selected.category_breakdown
      catPieData = parsed.map((c: any) => ({ name: CATEGORY_CONFIG[c.category]?.label || c.category, value: c.count }))
    } catch(e) {}
  } else if (selected.top_category) { catPieData =[{ name: selected.top_category, value: selected.total_complaints }] }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"><ArrowLeft size={15} className="text-slate-300" /></button>
          <div className="flex items-center gap-2"><MapPin size={15} className="text-primary-400" /><span className="font-display font-bold text-white text-sm">NagarMind Analytical Digest</span></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-body font-semibold border bg-blue-500/10 border-blue-500/30 text-blue-400 uppercase tracking-widest">
            {type} LEVEL DIGEST
          </div>
          <h1 className="font-display font-bold text-3xl text-white">{selected.ward_name}</h1>
        </div>

        {/* Week Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {history.map(d => (
            <button key={d.digest_id} onClick={() => setSelected(d)}
              className={`px-4 py-2 rounded-xl text-sm font-body font-medium whitespace-nowrap border transition-all shrink-0
                ${selected.digest_id === d.digest_id ? 'bg-primary-600 border-primary-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
              {format(new Date(d.week_start), 'MMM d')} - {format(new Date(d.week_end), 'MMM d')}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={selected.digest_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Issues', value: selected.total_complaints, color: 'text-slate-100' },
                { label: 'Resolved', value: selected.resolved_complaints, color: 'text-green-400' },
                { label: 'Resolution Rate', value: `${resRate}%`, color: 'text-primary-400' },
                { label: 'Health Score', value: Number(selected.health_score_end || 0).toFixed(1), color: 'text-yellow-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <div className={`font-display font-bold text-3xl ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-400 font-body mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* AI Summary */}
            {selected.summary_en && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <p className="text-xs font-bold text-primary-400 font-body uppercase tracking-wider mb-3">✨ AI Generated Narrative</p>
                <p className="text-sm text-slate-300 font-body leading-relaxed whitespace-pre-line">{selected.summary_en}</p>
              </div>
            )}

            {/* Charts Section */}
            {trendData.length > 1 && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="font-display font-semibold text-white text-sm mb-4">Historical Resolution Trend</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={trendData}>
                      <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                      <Bar dataKey="resolved" fill="#22c55e" radius={[4,4,0,0]} name="Resolved" />
                      <Bar dataKey="total" fill="#3b82f6" radius={[4,4,0,0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="font-display font-semibold text-white text-sm mb-4">Health Score Progression</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendData}>
                      <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} />
                      <Line type="monotone" dataKey="score" stroke="#facc15" strokeWidth={3} dot={{ r: 5, fill: '#0f172a' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}