import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { authAPI } from '@/lib/api'
import { Shield, ShieldCheck, Edit3, X, Save } from 'lucide-react'
import { getAvatarColor, initials } from '@/lib/utils'
import { motion } from 'framer-motion'

const AVATAR_STYLES =[ { id: 'initial', label: 'Initials' }, { id: 'civic', label: 'Shield' } ]
const AVATAR_ICONS: Record<string, string> = { civic: '🛡️', initial: '👤' }
const COLORS = [['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'],['#fef3c7', '#b45309'], ['#f3e8ff', '#7e22ce'],['#ffe4e6', '#be123c'],['#e0f2fe', '#0369a1']]

export function AdminProfilePage() {
  const [admin, setAdmin] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const[avatarStyle, setAvatarStyle] = useState('initial')
  const [avatarColor, setAvatarColor] = useState(0)

  useEffect(() => { authAPI.getMe().then(r => setAdmin(r.data)) },[])

  if (!admin) return <AdminShell><div className="animate-pulse bg-slate-800 h-64 rounded-3xl" /></AdminShell>

  const [bg, fg] = COLORS[avatarColor] || COLORS[0]

  return (
    <AdminShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-display font-bold text-2xl text-white">Administrator Profile</h1>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
          className="bg-slate-900 border border-slate-800 rounded-3xl p-8 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-primary-900/40 to-cyan-900/40 border-b border-slate-800" />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6 mt-12">
            
            {/* Avatar block */}
            <div className="relative">
              <div style={{ background: bg, color: fg }} 
                className="w-32 h-32 rounded-3xl flex items-center justify-center text-4xl font-display font-bold shadow-2xl border-4 border-slate-900">
                {avatarStyle === 'initial' ? initials(admin.full_name) : AVATAR_ICONS[avatarStyle]}
              </div>
              <button onClick={() => setEditing(!editing)} className="absolute -bottom-2 -right-2 w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg hover:bg-primary-500 transition-colors">
                {editing ? <X size={16} className="text-white"/> : <Edit3 size={16} className="text-white" />}
              </button>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-display font-bold text-3xl text-white">{admin.full_name}</h2>
              <p className="text-primary-400 font-body text-lg flex items-center justify-center sm:justify-start gap-2 mt-1">
                <ShieldCheck size={18} /> {admin.designation || 'System Administrator'}
              </p>
            </div>
          </div>

          {editing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 pt-8 border-t border-slate-800 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-300 font-body mb-2">Avatar Style</p>
                <div className="flex gap-2">
                  {AVATAR_STYLES.map(s => (
                    <button key={s.id} onClick={() => setAvatarStyle(s.id)} className={`px-4 py-2 rounded-xl text-sm font-body border transition-all ${avatarStyle === s.id ? 'bg-primary-600/20 border-primary-500/50 text-primary-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300 font-body mb-2">Theme Color</p>
                <div className="flex gap-2">
                  {COLORS.map(([b, f], i) => (
                    <button key={i} onClick={() => setAvatarColor(i)} style={{ background: b, border: avatarColor === i ? `2px solid ${f}` : '2px solid transparent' }} className="w-10 h-10 rounded-xl transition-all flex items-center justify-center"><span style={{ color: f }} className="text-sm font-bold">A</span></button>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setEditing(false)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold font-body transition-colors">Save Preferences</button>
              </div>
            </motion.div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-800">
            <div className="bg-slate-800/50 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><Shield size={18}/></div>
              <div>
                <p className="text-xs text-slate-500 font-body">Employee ID</p>
                <p className="text-sm text-slate-200 font-mono">{admin.employee_id}</p>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><ShieldCheck size={18}/></div>
              <div>
                <p className="text-xs text-slate-500 font-body">Clearance Level</p>
                <p className="text-sm text-green-400 font-medium">Level 5 (Admin)</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminShell>
  )
}