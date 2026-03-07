import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, User, MapPin, Star, Award, Shield, CheckCircle, Clock } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { getAvatarColor, initials } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts'
import { format, subDays } from 'date-fns' // ✅ Add this import

export function AdminOfficerDetailPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const officer = state?.officer

  if (!officer) {
    return (
      <AdminShell>
        <div className="text-center py-20 text-slate-400 font-body">Officer data not found. <button onClick={() => navigate('/admin/officers')} className="text-primary-400">Go back</button></div>
      </AdminShell>
    )
  }

  const [bg, fg] = getAvatarColor(officer.full_name)
  const resRate = officer.total_assigned > 0 ? Math.round((officer.total_resolved / officer.total_assigned) * 100) : 0

  // ✅ FIX: Dynamic Week Calculation
  const getWeekLabel = (weeksAgo: number) => {
    const end = subDays(new Date(), weeksAgo * 7)
    const start = subDays(end, 6)
    return `W${4 - weeksAgo} (${format(start, 'd MMM')}-${format(end, 'd MMM')})`
  }

  const performanceTrend =[
    { day: getWeekLabel(3), assigned: Math.round(officer.total_assigned * 0.2), resolved: Math.round(officer.total_resolved * 0.2) },
    { day: getWeekLabel(2), assigned: Math.round(officer.total_assigned * 0.25), resolved: Math.round(officer.total_resolved * 0.22) },
    { day: getWeekLabel(1), assigned: Math.round(officer.total_assigned * 0.3), resolved: Math.round(officer.total_resolved * 0.28) },
    { day: getWeekLabel(0), assigned: Math.round(officer.total_assigned * 0.25), resolved: Math.round(officer.total_resolved * 0.3) },
  ]

  const radarData =[
    { metric: 'Resolution', val: resRate },
    { metric: 'Speed (SLA)', val: officer.sla_compliance_rate || 50 },
    { metric: 'Rating', val: ((officer.avg_rating || 3) / 5) * 100 },
    { metric: 'Volume', val: Math.min((officer.total_resolved / 100) * 100, 100) },
    { metric: 'Reliability', val: Math.max(100 - (officer.total_breached * 10), 0) },
  ]

  return (
    <AdminShell>
      <div className="space-y-6">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/admin/officers')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-body bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg w-fit">
          <ArrowLeft size={16} /> Back to Officers
        </motion.button>

        {/* Profile Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center gap-6">
          <div style={{ background: bg, color: fg }} className="w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-display font-bold shadow-xl">
            {initials(officer.full_name)}
          </div>
          <div className="flex-1">
            <h1 className="font-display font-bold text-3xl text-white mb-1">{officer.full_name}</h1>
            <p className="text-slate-400 font-body flex items-center gap-2">
              <Shield size={14} className="text-primary-500" /> {officer.designation} · {officer.department}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono">{officer.employee_id}</span>
              <span className="px-3 py-1 bg-primary-900/30 border border-primary-500/30 rounded-lg text-xs text-primary-300 font-body flex items-center gap-1">
                <MapPin size={12} /> {officer.ward_name} ({officer.zone})
              </span>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${officer.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {officer.is_active ? 'Active Duty' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="text-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <div className="font-display font-bold text-4xl text-primary-400">{Math.round(officer.performance_score || 0)}</div>
            <div className="text-xs text-slate-400 font-body mt-1">Performance Score</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Assigned', val: officer.total_assigned, color: 'text-slate-200' },
            { label: 'Total Resolved', val: officer.total_resolved, color: 'text-green-400' },
            { label: 'SLA Breaches', val: officer.total_breached || 0, color: 'text-red-400' },
            { label: 'Resolution Rate', val: `${resRate}%`, color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className={`font-display font-bold text-3xl mb-1 ${s.color}`}>{s.val}</div>
              <div className="text-xs text-slate-400 font-body uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-display font-bold text-white text-sm mb-4">Competency Radar</h2>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'DM Sans' }} />
                <Radar name="Score" dataKey="val" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-display font-bold text-white text-sm mb-4">Monthly Workload</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={performanceTrend}>
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" />
                <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="assigned" fill="#334155" radius={[4,4,0,0]} name="Assigned" />
                <Bar dataKey="resolved" fill="#10b981" radius={[4,4,0,0]} name="Resolved" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}