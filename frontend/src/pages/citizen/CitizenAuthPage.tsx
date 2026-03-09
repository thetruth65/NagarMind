import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, MapPin, Globe, Eye, EyeOff } from 'lucide-react'
import { authAPI, wardsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { SUPPORTED_LANGUAGES, type Ward } from '@/types'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import toast from 'react-hot-toast'

type Mode = 'login' | 'register'

export function CitizenAuthPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)

  // Login states
  const [citizenId, setCitizenId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Registration states
  const [regPhone, setRegPhone] = useState('')
  const [regFullName, setRegFullName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [regLang, setRegLang] = useState('en')
  const [regWardId, setRegWardId] = useState('')
  const [regAddress, setRegAddress] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false)

  const [wards, setWards] = useState<Ward[]>([])
  const [demoCitizens, setDemoCitizens] = useState<Array<{ citizen_id: string; name: string; password: string }>>([])

  useEffect(() => {
    wardsAPI.list().then(r => setWards(r.data)).catch(() => {})
    authAPI.getDemoCitizens().then(r => setDemoCitizens(r.data.demo_citizens)).catch(() => {})
  }, [])

  const handleLogin = async () => {
    if (!citizenId.trim()) { toast.error('Enter your citizen ID'); return }
    if (!password) { toast.error('Enter your password'); return }

    setLoading(true)
    try {
      const { data } = await authAPI.loginCitizen(citizenId, password)

      setAuth({
        token: data.access_token,
        role: 'citizen',
        userId: data.user_id,
        fullName: data.full_name,
      })
      navigate('/citizen/dashboard')
      toast.success(`Welcome back, ${data.full_name}!`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const fillDemoCredentials = (citizen: { citizen_id: string; name: string; password: string }) => {
    setCitizenId(citizen.citizen_id)
    setPassword(citizen.password)
    toast.success(`Filled demo credentials for ${citizen.name}`)
  }

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode)
    // Reset form fields when switching modes
    if (newMode === 'login') {
      setRegPhone('')
      setRegFullName('')
      setRegPassword('')
      setRegPasswordConfirm('')
      setRegLang('en')
      setRegWardId('')
      setRegAddress('')
    } else {
      setCitizenId('')
      setPassword('')
    }
  }

  const handleRegister = async () => {
    // Validation
    const digits = regPhone.replace(/\D/g, '')
    if (digits.length !== 10) { toast.error('Enter a valid 10-digit mobile number'); return }
    if (!regFullName.trim()) { toast.error('Enter your full name'); return }
    if (!regPassword) { toast.error('Enter a password'); return }
    if (regPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (regPassword !== regPasswordConfirm) { toast.error('Passwords do not match'); return }
    if (!regWardId) { toast.error('Select your ward'); return }

    setLoading(true)
    try {
      const { data } = await authAPI.registerCitizen({
        phone: digits,
        full_name: regFullName.trim(),
        password: regPassword,
        password_confirm: regPasswordConfirm,
        ward_id: parseInt(regWardId),
        preferred_language: regLang,
        home_address: regAddress.trim() || null,
      })

      setAuth({
        token: data.access_token,
        role: 'citizen',
        userId: data.user_id,
        fullName: data.full_name,
        wardId: parseInt(regWardId),
        preferredLanguage: regLang,
      })
      navigate('/citizen/dashboard')
      toast.success(`Welcome to NagarMind, ${data.full_name}!`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Ward options for SearchableSelect
  const wardOptions = wards.map(w => ({
    value: String(w.ward_id),
    label: w.ward_name,
    sublabel: w.zone ? `${w.zone} Zone` : undefined,
  }))

  // Language options for SearchableSelect
  const langOptions = SUPPORTED_LANGUAGES.map(lang => ({
    value: lang.code,
    label: lang.nativeName,
    sublabel: lang.name,
  }))

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 flex items-center gap-3 border-b border-slate-800">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700"
        >
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
        <div className="flex bg-slate-800 rounded-2xl p-1 mb-8">
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => handleModeSwitch(m)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold font-body transition-all ${
                mode === m ? 'bg-primary-600 text-white shadow-glow-blue' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm space-y-5"
            >
              <div className="text-center mb-4">
                <h1 className="font-display font-bold text-2xl text-white mb-1">Welcome Back</h1>
                <p className="text-slate-400 text-sm font-body">Login to your NagarMind account</p>
              </div>

              {/* Citizen ID */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Citizen ID
                </label>
                <input
                  type="text"
                  value={citizenId}
                  onChange={e => setCitizenId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleLogin}
                disabled={loading || !citizenId.trim() || !password}
                className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-2xl font-body flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-glow-blue disabled:shadow-none mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Logging in...
                  </>
                ) : (
                  'Secure Login'
                )}
              </motion.button>

              {demoCitizens.length > 0 && (
                <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 text-xs text-slate-400 font-body space-y-2.5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-slate-300">👥 Demo Citizens for Testing</span>
                    <span className="inline-block px-2 py-0.5 bg-primary-600/20 border border-primary-500/30 rounded text-primary-300 text-xs font-mono">Try these</span>
                  </div>
                  {demoCitizens.map((citizen, idx) => (
                    <button
                      key={idx}
                      onClick={() => fillDemoCredentials(citizen)}
                      className="w-full text-left p-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-primary-500/50 rounded-lg transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 font-semibold text-xs mb-1 truncate">{idx + 1}. {citizen.name}</p>
                          <p className="text-slate-400 text-xs font-mono break-all text-slate-500">ID: {citizen.citizen_id}</p>
                        </div>
                        <span className="text-slate-400 group-hover:text-primary-400 transition-colors">→</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1.5">
                        Pass: <span className="text-emerald-400 font-mono">{citizen.password}</span>
                      </p>
                    </button>
                  ))}
                  <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-700/50 mt-2">
                    💡 Click any citizen to auto-fill their credentials
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm space-y-5"
            >
              <div className="text-center mb-4">
                <h1 className="font-display font-bold text-2xl text-white mb-1">Create Account</h1>
                <p className="text-slate-400 text-sm font-body">Join NagarMind to report civic issues</p>
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Mobile Number
                </label>
                <div className="flex rounded-2xl border-2 border-slate-700 bg-slate-800 overflow-hidden focus-within:border-primary-500 transition-colors">
                  <div className="flex items-center gap-2 px-4 bg-slate-900 border-r border-slate-700 shrink-0">
                    <span className="text-lg">🇮🇳</span>
                    <span className="text-slate-300 font-semibold text-sm font-body">+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 px-4 py-3.5 text-white font-body outline-none bg-transparent placeholder:text-slate-500 text-sm"
                  />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Full Name
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  placeholder="Rajesh Kumar"
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPasswordConfirm ? 'text' : 'password'}
                    value={regPasswordConfirm}
                    onChange={e => setRegPasswordConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPasswordConfirm(!showRegPasswordConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showRegPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {regPassword && regPasswordConfirm && regPassword !== regPasswordConfirm && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Language Selection */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body flex items-center gap-1.5">
                  <Globe size={14} className="text-primary-400" /> Preferred Language
                </label>
                <SearchableSelect
                  options={langOptions}
                  value={regLang}
                  onChange={setRegLang}
                  placeholder="Search language..."
                  className="w-full"
                />
              </div>

              {/* Ward Selection */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Your Ward
                </label>
                <SearchableSelect
                  options={wardOptions}
                  value={regWardId}
                  onChange={setRegWardId}
                  placeholder="Search ward by name or zone..."
                  className="w-full"
                />
              </div>

              {/* Address (Optional) */}
              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Home Address <span className="text-slate-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={regAddress}
                  onChange={e => setRegAddress(e.target.value)}
                  placeholder="Street address, apartment, building, etc."
                  rows={3}
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm resize-none"
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRegister}
                disabled={loading || !regPhone.trim() || !regFullName.trim() || !regPassword || !regWardId}
                className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-2xl font-body flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-glow-blue disabled:shadow-none mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
