import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, MapPin, Phone, Globe, Edit3, Save, X, Star, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/common/AppShell'
import { citizenAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { SUPPORTED_LANGUAGES } from '@/types'
import { initials, getAvatarColor } from '@/lib/utils'
import { RadialBarChart, RadialBar, Cell, PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/citizen/dashboard',  label: 'Home',      icon: <span>🏠</span> },
  { to: '/citizen/submit',     label: 'Report',    icon: <span>📝</span> },
  { to: '/citizen/complaints', label: 'My Issues', icon: <span>📋</span> },
  { to: '/citizen/digest',     label: 'Digest',    icon: <span>📊</span> },
  { to: '/citizen/profile',    label: 'Profile',   icon: <span>👤</span> },
]

const AVATAR_STYLES = [
  { id: 'initial', label: 'Initials' },
  { id: 'civic',   label: 'Civic Hero' },
  { id: 'nature',  label: 'Nature' },
]

const AVATAR_ICONS: Record<string, string> = {
  civic:  '🏛️', nature: '🌿', initial: '👤'
}

export function CitizenProfilePage() {
  const { fullName, setAuth, token, userId, role, wardId } = useAuthStore()
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats]     = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [name, setName]       = useState('')
  const [address, setAddress] = useState('')
  const [lang, setLang]       = useState('en')
  const [avatarStyle, setAvatarStyle] = useState('initial')
  const [avatarColor, setAvatarColor] = useState(0)

  const COLORS = [
    ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309'],
    ['#f3e8ff', '#7e22ce'], ['#ffe4e6', '#be123c'], ['#e0f2fe', '#0369a1'],
  ]

  useEffect(() => {
    Promise.all([citizenAPI.profile(), citizenAPI.stats()]).then(([p, s]) => {
      setProfile(p.data); setStats(s.data)
      setName(p.data.full_name || '')
      setAddress(p.data.home_address || '')
      setLang(p.data.preferred_language || 'en')
    }).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await citizenAPI.update({ full_name: name, home_address: address, preferred_language: lang })
      setProfile((p: any) => ({ ...p, full_name: name, home_address: address, preferred_language: lang }))
      setAuth({ token: token!, role: role!, userId: userId!, fullName: name, wardId: wardId ?? undefined, preferredLanguage: lang })
      setEditing(false)
      toast.success('Profile updated!')
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  const [bg, fg] = COLORS[avatarColor] || COLORS[0]
  const displayName = editing ? name : (profile?.full_name || fullName || '')

  const catData = stats?.category_breakdown?.slice(0, 5).map((c: any) => ({
    name: c.category?.replace(/_/g, ' ') || 'Other',
    value: c.count,
  })) || []

  const PIE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#f43f5e','#8b5cf6']

  if (loading) return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="card h-28 animate-pulse bg-slate-100" />)}
      </div>
    </AppShell>
  )

  return (
    <AppShell navItems={NAV_ITEMS} role="citizen">
      <div className="space-y-5 max-w-lg mx-auto">
        {/* ── Avatar + Name ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="card p-6 text-center">
          {/* Avatar selector */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div
                style={{ background: bg, color: fg }}
                className="w-20 h-20 rounded-3xl flex items-center justify-center
                           text-3xl font-display font-bold shadow-sm"
              >
                {avatarStyle === 'initial'
                  ? initials(displayName)
                  : AVATAR_ICONS[avatarStyle]}
              </div>
              <button onClick={() => setEditing(true)}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 rounded-xl
                           flex items-center justify-center shadow-sm hover:bg-primary-700">
                <Edit3 size={12} className="text-white" />
              </button>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4 text-left">
              {/* Avatar style */}
              <div>
                <p className="input-label text-center mb-2">Avatar Style</p>
                <div className="flex gap-2 justify-center">
                  {AVATAR_STYLES.map(s => (
                    <button key={s.id} onClick={() => setAvatarStyle(s.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs border-2 font-body transition-all
                        ${avatarStyle === s.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <p className="input-label text-center mb-2">Color Theme</p>
                <div className="flex gap-2 justify-center">
                  {COLORS.map(([b, f], i) => (
                    <button key={i} onClick={() => setAvatarColor(i)}
                      style={{ background: b, border: avatarColor === i ? `2px solid ${f}` : '2px solid transparent' }}
                      className="w-8 h-8 rounded-xl transition-all">
                      <span style={{ color: f }} className="text-xs font-bold">A</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="input-label">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="input-label">Home Address</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
                  className="input-field resize-none" />
              </div>
              <div>
                <label className="input-label">Language</label>
                <div className="grid grid-cols-4 gap-2">
                  {SUPPORTED_LANGUAGES.slice(0, 8).map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)}
                      className={`py-2 rounded-xl text-xs border-2 font-body transition-all
                        ${lang === l.code ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold' : 'border-slate-200 text-slate-600'}`}>
                      {l.nativeName}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                  <X size={14} className="inline mr-1" />Cancel
                </button>
                <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
                  <Save size={14} className="inline mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display font-bold text-xl text-slate-900">{displayName}</h2>
              <p className="text-slate-400 font-body text-sm">{profile?.phone_number}</p>
              <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
                {profile?.ward_name && (
                  <span className="badge bg-primary-50 text-primary-700 flex items-center gap-1">
                    <MapPin size={10} />{profile.ward_name}
                  </span>
                )}
                <span className="badge bg-slate-100 text-slate-600 flex items-center gap-1">
                  <Globe size={10} />{SUPPORTED_LANGUAGES.find(l => l.code === profile?.preferred_language)?.nativeName || 'English'}
                </span>
              </div>
              {profile?.home_address && (
                <p className="text-xs text-slate-400 font-body mt-2">{profile.home_address}</p>
              )}
            </>
          )}
        </motion.div>

        {/* ── Stats ── */}
        {!editing && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Filed',   value: profile?.total_complaints || 0,     icon: '📋', color: 'text-slate-700' },
                { label: 'Disputes',      value: profile?.disputes_raised || 0,       icon: '⚠️', color: 'text-red-700' },
                { label: 'Avg Rating',    value: profile?.avg_rating_given
                    ? Number(profile.avg_rating_given).toFixed(1) : '—',              icon: '⭐', color: 'text-amber-700' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className={`font-display font-bold text-lg ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 font-body">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Category chart */}
            {catData.length > 0 && (
              <div className="card p-5">
                <h3 className="font-display font-semibold text-slate-800 mb-4">Complaints by Category</h3>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={catData} cx="50%" cy="50%" innerRadius={30} outerRadius={55}
                          dataKey="value">
                          {catData.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any) => [v, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {catData.map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-slate-600 font-body flex-1 truncate capitalize">{d.name}</span>
                        <span className="text-xs font-bold text-slate-700">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Ward health */}
            {profile?.health_score && (
              <div className="card p-5">
                <h3 className="font-display font-semibold text-slate-800 mb-3">Ward Health</h3>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center
                    ${profile.health_grade === 'A' ? 'bg-green-100' :
                      profile.health_grade === 'B' ? 'bg-blue-100' :
                      profile.health_grade === 'C' ? 'bg-amber-100' : 'bg-red-100'}`}>
                    <span className={`font-display font-bold text-2xl
                      ${profile.health_grade === 'A' ? 'text-green-700' :
                        profile.health_grade === 'B' ? 'text-blue-700' :
                        profile.health_grade === 'C' ? 'text-amber-700' : 'text-red-700'}`}>
                      {profile.health_grade}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 font-body">{profile.ward_name}</p>
                    <p className="text-sm text-slate-500 font-body">Health Score: {Number(profile.health_score).toFixed(1)}/100</p>
                    <p className="text-xs text-slate-400 font-body">Zone: {profile.zone}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}