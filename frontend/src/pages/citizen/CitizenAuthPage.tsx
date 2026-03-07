import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, MapPin, Globe } from 'lucide-react'
import { authAPI, wardsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { SUPPORTED_LANGUAGES, type Ward } from '@/types'
import toast from 'react-hot-toast'

type Mode = 'login' | 'register'
type Step = 'form' | 'otp'

export function CitizenAuthPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [mode, setMode] = useState<Mode>('login')
  const[step, setStep] = useState<Step>('form')
  
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Registration states
  const[fullName, setFullName] = useState('')
  const [wardId, setWardId] = useState('')
  const [lang, setLang] = useState('en')
  const [wards, setWards] = useState<Ward[]>([])
  const[wardSearch, setWardSearch] = useState('')

  useEffect(() => { wardsAPI.list().then(r => setWards(r.data)).catch(() => {}) },[])

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) { toast.error('Enter a valid 10-digit mobile number'); return }
    
    if (mode === 'register') {
      if (!fullName.trim() || !wardId) { toast.error('Fill all fields to register'); return }
    }

    setLoading(true)
    try {
      // Check if user exists
      const checkRes = await authAPI.checkCitizen(`+91${digits}`)
      const exists = checkRes.data.exists

      if (mode === 'login' && !exists) {
        toast.error('Account not found. Please register first.')
        setMode('register')
        setLoading(false)
        return
      }
      if (mode === 'register' && exists) {
        toast.error('Account already exists. Please log in.')
        setMode('login')
        setLoading(false)
        return
      }

      await authAPI.sendOTP(`+91${digits}`, 'citizen', lang)
      setCountdown(60)
      setStep('otp')
      toast.success('OTP sent successfully!')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to send OTP')
    } finally { setLoading(false) }
  }

  const verifyOTP = async () => {
    if (otp.length !== 6) { toast.error('Enter 6-digit OTP'); return }
    setLoading(true)
    try {
      const digits = phone.replace(/\D/g, '')
      const { data } = await authAPI.verifyOTP(`+91${digits}`, otp, 'citizen')
      
      if (mode === 'login') {
        setAuth({ 
            token: data.access_token, role: 'citizen', userId: data.user_id, 
            fullName: data.full_name, preferredLanguage: data.preferred_language || lang 
        })
        navigate('/citizen/dashboard')
        toast.success(`Welcome back, ${data.full_name}!`)
      } else {
        // Complete registration automatically using the temp token
        const regRes = await authAPI.registerCitizen({
          phone: `+91${digits}`, full_name: fullName.trim(), ward_id: parseInt(wardId), preferred_language: lang
        }, data.temp_token)
        
        setAuth({ 
            token: regRes.data.access_token, role: 'citizen', userId: regRes.data.user_id, 
            fullName: regRes.data.full_name, wardId: parseInt(wardId), preferredLanguage: lang 
        })
        navigate('/citizen/dashboard')
        toast.success(`Welcome to NagarMind, ${regRes.data.full_name}!`)
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Invalid OTP')
    } finally { setLoading(false) }
  }

  const filteredWards = wards.filter(w => w.ward_name.toLowerCase().includes(wardSearch.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 flex items-center gap-3 border-b border-slate-800">
        <button onClick={() => navigate('/')}
          className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700">
          <ArrowLeft size={16} className="text-slate-300" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <MapPin size={14} className="text-blue-400" />
          </div>
          <span className="font-display font-bold text-white">NagarMind</span>
          <span className="text-slate-500 text-xs font-body">Citizen Portal</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        
        {/* Toggle Mode */}
        {step === 'form' && (
          <div className="flex bg-slate-800 rounded-2xl p-1 mb-8">
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold font-body transition-all
                  ${mode === m ? 'bg-primary-600 text-white shadow-glow-blue' : 'text-slate-400 hover:text-slate-200'}`}>
                {m === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-sm space-y-5">
              <div className="text-center mb-4">
                <h1 className="font-display font-bold text-2xl text-white mb-1">
                  {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h1>
                <p className="text-slate-400 text-sm font-body">
                  {mode === 'login' ? 'Enter your registered mobile number' : 'Join NagarMind to report civic issues'}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Mobile Number</label>
                <div className="flex rounded-2xl border-2 border-slate-700 bg-slate-800 overflow-hidden focus-within:border-primary-500 transition-colors">
                  <div className="flex items-center gap-2 px-4 bg-slate-900 border-r border-slate-700 shrink-0">
                    <span className="text-lg">🇮🇳</span>
                    <span className="text-slate-300 font-semibold text-sm font-body">+91</span>
                  </div>
                  <input type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={e => e.key === 'Enter' && sendOTP()}
                    placeholder="9876543210" className="flex-1 px-4 py-3.5 text-white font-body outline-none bg-transparent placeholder:text-slate-500 text-sm" />
                </div>
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Full Name</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Rajesh Kumar"
                      className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm" />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Your Ward</label>
                    <input type="text" placeholder="Search ward..." value={wardSearch} onChange={e => setWardSearch(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm mb-1" />
                    {wardSearch && (
                      <div className="max-h-40 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl mt-1 shadow-xl">
                        {filteredWards.slice(0, 15).map(w => (
                          <button key={w.ward_id} onClick={() => { setWardId(String(w.ward_id)); setWardSearch(w.ward_name) }}
                            className={`w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 transition-colors ${wardId === String(w.ward_id) ? 'bg-slate-800 text-primary-400 font-semibold' : ''}`}>
                            {w.ward_name} <span className="text-slate-500 text-xs">· {w.zone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body flex items-center gap-1.5">
                      <Globe size={14} className="text-primary-400"/> Preferred Language
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {SUPPORTED_LANGUAGES.slice(0, 8).map(l => (
                        <button key={l.code} onClick={() => setLang(l.code)}
                          className={`py-2.5 px-1 rounded-xl text-xs font-body font-medium border-2 transition-all ${lang === l.code ? 'border-primary-500 bg-primary-600/20 text-primary-400' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                          {l.nativeName}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <motion.button whileTap={{ scale: 0.97 }} onClick={sendOTP} disabled={loading || phone.length !== 10}
                className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-2xl font-body flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-glow-blue disabled:shadow-none mt-4">
                {loading ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : 'Send OTP'}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="otp" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full max-w-sm space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-3xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📱</span>
                </div>
                <h1 className="font-display font-bold text-2xl text-white mb-1">Verify Mobile</h1>
                <p className="text-slate-400 font-body text-sm">OTP sent to +91 {phone.slice(0,3)}••••{phone.slice(-3)}</p>
              </div>

              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1} value={otp[i] || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      const next = otp.split('')
                      next[i] = val
                      setOtp(next.join('').slice(0, 6))
                      if (val && i < 5) document.getElementById(`otp-${i+1}`)?.focus()
                    }}
                    onKeyDown={e => { if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-${i-1}`)?.focus() }}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all font-body bg-slate-900 ${otp[i] ? 'border-primary-500 text-primary-400' : 'border-slate-700 text-white focus:border-primary-500'}`} />
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={verifyOTP} disabled={loading || otp.length !== 6}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl font-body flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(22,163,74,0.4)] disabled:shadow-none">
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Verifying...' : (mode === 'login' ? 'Secure Login' : 'Complete Registration')}
              </motion.button>

              <div className="text-center pt-2">
                <button onClick={() => { setStep('form'); setOtp('') }} className="text-sm text-slate-500 hover:text-slate-300 font-body mr-4 transition-colors">
                  ← Change number
                </button>
                {countdown > 0 ? (
                  <span className="text-sm text-slate-500 font-body">Resend in {countdown}s</span>
                ) : (
                  <button onClick={sendOTP} className="text-sm text-primary-400 hover:text-primary-300 font-semibold font-body transition-colors">
                    Resend OTP
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}