import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, Loader2, MapPin, ArrowLeft } from 'lucide-react'
import { authAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [empId, setEmpId] = useState('')
  const [pwd, setPwd]     = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const login = async () => {
    if (!empId || !pwd) { toast.error('Enter credentials'); return }
    setLoading(true)
    try {
      // We use the same backend endpoint, but strictly filter the response
      const { data } = await authAPI.officerLogin(empId.trim().toUpperCase(), pwd)
      
      // STRICT SEPARATION: If an Officer tries to login here, reject them.
      if (data.role !== 'admin') {
        toast.error('Access Denied. You do not have Administrator privileges.')
        navigate('/officer/auth')
        return
      }

      setAuth({ token: data.access_token, role: 'admin', userId: data.user_id, fullName: data.full_name })
      navigate('/admin/dashboard')
      toast.success(`Welcome, Commissioner ${data.full_name}!`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,_#1e3a8a25_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,_#1e40af15_0%,_transparent_60%)]" />
      </div>

      <header className="relative z-10 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/')}
          className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700
                     flex items-center justify-center hover:bg-slate-700 transition-colors">
          <ArrowLeft size={16} className="text-slate-300" />
        </button>
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-primary-400" />
          <span className="font-display font-bold text-white">NagarMind</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm">
          {/* Icon */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-primary-600/20 border border-primary-500/40
                            flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-primary-400" />
            </div>
            <h1 className="font-display font-bold text-2xl text-white mb-1">Admin Console</h1>
            <p className="text-slate-400 text-sm font-body">MCD Delhi — Civic Intelligence Platform</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Employee ID</label>
              <input
                type="text"
                value={empId}
                onChange={e => setEmpId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="MCD-ADMIN-001"
                className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                           outline-none focus:border-primary-500 font-body font-mono text-sm
                           placeholder:text-slate-600 transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && login()}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                             outline-none focus:border-primary-500 font-body text-sm
                             placeholder:text-slate-600 pr-12 transition-colors"
                />
                <button onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={login}
              disabled={loading}
              className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50
                         text-white font-semibold rounded-2xl font-body flex items-center
                         justify-center gap-2 transition-colors mt-2"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : 'Sign In'}
            </motion.button>
          </div>

          {/* Demo creds */}
          <div className="mt-6 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2 font-body uppercase tracking-wider">
              Demo Credentials
            </p>
            <div className="space-y-1.5">
              {[
                { id: 'MCD-ADMIN-001', pwd: 'Admin@123!', name: 'Mohit Sharma (Commissioner)' },
                { id: 'MCD-ADMIN-002', pwd: 'Admin@456!', name: 'Priya Kapoor (Joint Comm.)' },
              ].map(c => (
                <button key={c.id} onClick={() => { setEmpId(c.id); setPwd(c.pwd) }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-700 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono text-primary-400">{c.id}</p>
                      <p className="text-[10px] text-slate-500 font-body">{c.name}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 group-hover:text-slate-300">click to fill</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-4 font-body">
            Officer?{' '}
            <button onClick={() => navigate('/officer/auth')} className="text-primary-500 hover:text-primary-400">
              Use Officer Portal →
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}