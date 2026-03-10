// import { useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { motion, AnimatePresence } from 'framer-motion'
// import { ArrowLeft, Loader2, Eye, EyeOff, Shield } from 'lucide-react'
// import { authAPI, wardsAPI } from '@/lib/api'
// import { useAuthStore } from '@/stores/authStore'
// import { MCD_DEPARTMENTS, MCD_DESIGNATIONS, MCD_ZONES, type Ward } from '@/types'
// import toast from 'react-hot-toast'
// import { useEffect } from 'react'

// type Mode = 'login' | 'register'

// export function OfficerAuthPage() {
//   const navigate = useNavigate()
//   const { setAuth } = useAuthStore()
//   const [mode, setMode]           = useState<Mode>('login')
//   const [loading, setLoading]     = useState(false)
//   const [showPwd, setShowPwd]     = useState(false)

//   // Login
//   const [empId, setEmpId]         = useState('')
//   const [pwd, setPwd]             = useState('')

//   // Register
//   const [regData, setRegData] = useState({
//     employee_id: '', phone: '', full_name: '', password: '', confirm_pwd: '',
//     designation: '', department: '', ward_id: '', zone: '',
//   })
//   const [wards, setWards] = useState<Ward[]>([])
//   const [wardSearch, setWardSearch] = useState('')

//   useEffect(() => {
//     wardsAPI.list().then(r => setWards(r.data)).catch(() => {})
//   }, [])

//   const login = async () => {
//     if (!empId || !pwd) { toast.error('Enter credentials'); return }
//     setLoading(true)
//     try {
//       const { data } = await authAPI.officerLogin(empId.trim().toUpperCase(), pwd)
      
//       // STRICT SEPARATION: If an Admin tries to login here, reject them.
//       if (data.role === 'admin') {
//         toast.error('Administrators must use the Admin Console.')
//         navigate('/admin')
//         return
//       }

//       setAuth({ token: data.access_token, role: 'officer', userId: data.user_id, fullName: data.full_name })
//       navigate('/officer/dashboard')
//       toast.success(`Welcome, ${data.full_name}!`)
//     } catch (e: any) {
//       toast.error(e.response?.data?.detail || 'Invalid credentials')
//     } finally { setLoading(false) }
//   }

//   const register = async () => {
//     const r = regData
//     if (!r.employee_id || !r.phone || !r.full_name || !r.password) {
//       toast.error('Fill all required fields'); return
//     }
//     if (r.password !== r.confirm_pwd) { toast.error('Passwords do not match'); return }
//     setLoading(true)
//     try {
//       const digits = r.phone.replace(/\D/g, '')
//       const { data } = await authAPI.registerOfficer({
//         employee_id: r.employee_id.toUpperCase(),
//         phone: `+91${digits}`, full_name: r.full_name,
//         password: r.password, designation: r.designation,
//         department: r.department, ward_id: r.ward_id ? parseInt(r.ward_id) : undefined,
//         zone: r.zone,
//       })
//       setAuth({ token: data.access_token, role: 'officer', userId: data.user_id, fullName: data.full_name })
//       navigate('/officer/dashboard')
//       toast.success(`Welcome, ${data.full_name}!`)
//     } catch (e: any) {
//       toast.error(e.response?.data?.detail || 'Registration failed')
//     } finally { setLoading(false) }
//   }

//   const upd = (k: keyof typeof regData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
//     setRegData(d => ({ ...d, [k]: e.target.value }))

//   const filteredWards = wards.filter(w =>
//     w.ward_name.toLowerCase().includes(wardSearch.toLowerCase()))

//   return (
//     <div className="min-h-screen bg-slate-950 flex flex-col">
//       {/* Header */}
//       <header className="px-4 py-4 flex items-center gap-3 border-b border-slate-800">
//         <button onClick={() => navigate('/')}
//           className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700">
//           <ArrowLeft size={16} className="text-slate-300" />
//         </button>
//         <div className="flex items-center gap-2">
//           <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
//             <Shield size={14} className="text-primary-400" />
//           </div>
//           <span className="font-display font-bold text-white">NagarMind</span>
//           <span className="text-slate-500 text-xs font-body">Officer Portal</span>
//         </div>
//       </header>

//       <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
//         {/* Mode toggle */}
//         <div className="flex bg-slate-800 rounded-2xl p-1 mb-8">
//           {(['login', 'register'] as Mode[]).map(m => (
//             <button key={m} onClick={() => setMode(m)}
//               className={`px-5 py-2 rounded-xl text-sm font-semibold font-body transition-all
//                 ${mode === m ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
//               {m === 'login' ? 'Login' : 'Register'}
//             </button>
//           ))}
//         </div>

//         <AnimatePresence mode="wait">
//           {mode === 'login' ? (
//             <motion.div key="login"
//               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
//               className="w-full max-w-sm space-y-5">
//               <div className="text-center mb-2">
//                 <h1 className="font-display font-bold text-2xl text-white mb-1">Officer Login</h1>
//                 <p className="text-slate-400 text-sm font-body">Use your MCD employee credentials</p>
//               </div>

//               <div>
//                 <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Employee ID</label>
//                 <input type="text" value={empId} onChange={e => setEmpId(e.target.value.toUpperCase())}
//                   onKeyDown={e => e.key === 'Enter' && login()}
//                   placeholder="MCD20240001"
//                   className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
//                              outline-none focus:border-primary-500 font-body font-mono placeholder:text-slate-500 text-sm" />
//               </div>

//               <div>
//                 <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Password</label>
//                 <div className="relative">
//                   <input type={showPwd ? 'text' : 'password'} value={pwd}
//                     onChange={e => setPwd(e.target.value)}
//                     onKeyDown={e => e.key === 'Enter' && login()}
//                     placeholder="Enter password"
//                     className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
//                                outline-none focus:border-primary-500 font-body placeholder:text-slate-500 pr-12" />
//                   <button onClick={() => setShowPwd(!showPwd)}
//                     className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
//                     {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
//                   </button>
//                 </div>
//               </div>

//               <motion.button whileTap={{ scale: 0.97 }} onClick={login} disabled={loading}
//                 className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold
//                            rounded-2xl font-body flex items-center justify-center gap-2 transition-colors
//                            disabled:opacity-50">
//                 {loading ? <Loader2 size={18} className="animate-spin" /> : null}
//                 {loading ? 'Logging in...' : 'Login'}
//               </motion.button>

//               <div className="bg-slate-800/60 rounded-2xl p-4 text-xs text-slate-400 font-body space-y-1">
//                 <p className="text-slate-300 font-semibold mb-2">Demo Credentials:</p>
//                 <p>👷 Officer: <span className="font-mono text-primary-400">MCD20240001</span> / Officer@123!</p>
//                 <p className="mt-2 pt-2 border-t border-slate-700/50">
//                   Admin? <button onClick={() => navigate('/admin')} className="text-primary-400 hover:text-primary-300 transition-colors">Go to Admin Console →</button>
//                 </p>
//               </div>
//             </motion.div>
//           ) : (
//             <motion.div key="register"
//               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
//               className="w-full max-w-sm space-y-4">
//               <h1 className="font-display font-bold text-2xl text-white text-center mb-2">Register Officer</h1>

//               {[
//                 { k: 'employee_id', label: 'Employee ID *', placeholder: 'MCD2024XXXX' },
//                 { k: 'full_name',   label: 'Full Name *',   placeholder: 'Rajesh Kumar' },
//                 { k: 'phone',       label: 'Mobile *',      placeholder: '9876543210' },
//               ].map(({ k, label, placeholder }) => (
//                 <div key={k}>
//                   <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">{label}</label>
//                   <input type="text" value={(regData as any)[k]} onChange={upd(k as any)} placeholder={placeholder}
//                     className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
//                                outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm" />
//                 </div>
//               ))}

//               <div>
//                 <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Designation</label>
//                 <select value={regData.designation} onChange={upd('designation')}
//                   className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
//                              outline-none focus:border-primary-500 font-body text-sm">
//                   <option value="">Select designation</option>
//                   {MCD_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
//                 </select>
//               </div>

//               <div>
//                 <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Department</label>
//                 <select value={regData.department} onChange={upd('department')}
//                   className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
//                              outline-none focus:border-primary-500 font-body text-sm">
//                   <option value="">Select department</option>
//                   {MCD_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
//                 </select>
//               </div>

//               <div>
//                 <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Ward</label>
//                 <input type="text" placeholder="Search ward..."
//                   value={wardSearch} onChange={e => setWardSearch(e.target.value)}
//                   className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
//                              outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm mb-1" />
//                 {wardSearch && (
//                   <div className="max-h-36 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl">
//                     {filteredWards.slice(0, 15).map(w => (
//                       <button key={w.ward_id}
//                         onClick={() => {
//                           setRegData(d => ({ ...d, ward_id: String(w.ward_id), zone: w.zone || '' }))
//                           setWardSearch(w.ward_name)
//                         }}
//                         className={`w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors
//                           ${regData.ward_id === String(w.ward_id) ? 'bg-slate-700' : ''}`}>
//                         {w.ward_name} <span className="text-slate-500 text-xs">· {w.zone}</span>
//                       </button>
//                     ))}
//                   </div>
//                 )}
//               </div>

//               {[
//                 { k: 'password',    label: 'Password *',         type: 'password' },
//                 { k: 'confirm_pwd', label: 'Confirm Password *',  type: 'password' },
//               ].map(({ k, label, type }) => (
//                 <div key={k}>
//                   <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">{label}</label>
//                   <input type={type} value={(regData as any)[k]} onChange={upd(k as any)}
//                     className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
//                                outline-none focus:border-primary-500 font-body text-sm" />
//                 </div>
//               ))}

//               <motion.button whileTap={{ scale: 0.97 }} onClick={register} disabled={loading}
//                 className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold
//                            rounded-2xl font-body flex items-center justify-center gap-2 transition-colors
//                            disabled:opacity-50">
//                 {loading ? <Loader2 size={18} className="animate-spin" /> : null}
//                 {loading ? 'Registering...' : 'Create Account'}
//               </motion.button>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </div>
//     </div>
//   )
// }






import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, Eye, EyeOff, Shield, User } from 'lucide-react'
import { authAPI, wardsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { MCD_DEPARTMENTS, MCD_DESIGNATIONS, type Ward } from '@/types'
import toast from 'react-hot-toast'

type Mode = 'login' | 'register'

// Demo officers matching the seeded database:
// employee_id format is OFF-{ward_id}-{1|2}, email is officer{ward_id}_{i}@mcd.delhi.gov.in
// The backend accepts EITHER employee_id OR email. Password = Officer@123!
const DEMO_OFFICERS = [
  { label: 'Officer 1-1 (Ward 1, Central)', empId: 'OFF-001-1', email: 'officer1_1@mcd.delhi.gov.in', pwd: 'Officer@123!' },
  { label: 'Officer 1-2 (Ward 1, Central)', empId: 'OFF-001-2', email: 'officer1_2@mcd.delhi.gov.in', pwd: 'Officer@123!' },
  { label: 'Officer 5-1 (Ward 5, City SP)', empId: 'OFF-005-1', email: 'officer5_1@mcd.delhi.gov.in', pwd: 'Officer@123!' },
  { label: 'Officer 27-1 (Ward 27, Rohini)', empId: 'OFF-027-1', email: 'officer27_1@mcd.delhi.gov.in', pwd: 'Officer@123!' },
]

export function OfficerAuthPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [mode, setMode]       = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  // Login — accept either employee_id or email
  const [empId, setEmpId] = useState('')
  const [pwd, setPwd]     = useState('')

  // Register
  const [regData, setRegData] = useState({
    employee_id: '', phone: '', full_name: '', password: '', confirm_pwd: '',
    designation: '', department: '', ward_id: '', zone: '',
  })
  const [wards, setWards]           = useState<Ward[]>([])
  const [wardSearch, setWardSearch] = useState('')

  useEffect(() => {
    wardsAPI.list().then(r => setWards(r.data)).catch(() => {})
  }, [])

  const fillDemo = (officer: typeof DEMO_OFFICERS[0]) => {
    // Use email as login — backend auth.py accepts email in the officer/login endpoint
    setEmpId(officer.email)
    setPwd(officer.pwd)
    toast.success(`Filled: ${officer.label}`)
  }

  const login = async () => {
    if (!empId || !pwd) { toast.error('Enter credentials'); return }
    setLoading(true)
    try {
      // Backend accepts employee_id OR email — pass as-is
      const { data } = await authAPI.officerLogin(empId.trim(), pwd)

      if (data.role === 'admin') {
        toast.error('Administrators must use the Admin Console.')
        navigate('/admin')
        return
      }

      setAuth({
        token: data.access_token,
        role: 'officer',
        userId: data.user_id,
        fullName: data.full_name,
        wardId: data.ward_id,
      })
      navigate('/officer/dashboard')
      toast.success(`Welcome, ${data.full_name}!`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  const register = async () => {
    const r = regData
    if (!r.employee_id || !r.phone || !r.full_name || !r.password) {
      toast.error('Fill all required fields'); return
    }
    if (r.password !== r.confirm_pwd) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      const digits = r.phone.replace(/\D/g, '')
      const { data } = await authAPI.registerOfficer({
        employee_id: r.employee_id.toUpperCase(),
        phone: `+91${digits}`, full_name: r.full_name,
        password: r.password, designation: r.designation,
        department: r.department,
        ward_id: r.ward_id ? parseInt(r.ward_id) : undefined,
        zone: r.zone,
      })
      setAuth({ token: data.access_token, role: 'officer', userId: data.user_id, fullName: data.full_name })
      navigate('/officer/dashboard')
      toast.success(`Welcome, ${data.full_name}!`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  const upd = (k: keyof typeof regData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setRegData(d => ({ ...d, [k]: e.target.value }))

  const filteredWards = wards.filter(w =>
    w.ward_name.toLowerCase().includes(wardSearch.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 flex items-center gap-3 border-b border-slate-800">
        <button onClick={() => navigate('/')}
          className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center hover:bg-slate-700">
          <ArrowLeft size={16} className="text-slate-300" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
            <Shield size={14} className="text-primary-400" />
          </div>
          <span className="font-display font-bold text-white">NagarMind</span>
          <span className="text-slate-500 text-xs font-body">Officer Portal</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Mode toggle */}
        <div className="flex bg-slate-800 rounded-2xl p-1 mb-8">
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold font-body transition-all
                ${mode === m ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              {m === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            <motion.div key="login"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm space-y-5">

              <div className="text-center mb-2">
                <h1 className="font-display font-bold text-2xl text-white mb-1">Officer Login</h1>
                <p className="text-slate-400 text-sm font-body">Use your MCD employee ID or email</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">
                  Employee ID or Email
                </label>
                <input
                  type="text"
                  value={empId}
                  onChange={e => setEmpId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && login()}
                  placeholder="OFF-001-1 or officer1_1@mcd.delhi.gov.in"
                  className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                             outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm"
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
                    placeholder="Enter password"
                    className="w-full px-4 py-3.5 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                               outline-none focus:border-primary-500 font-body placeholder:text-slate-500 pr-12"
                  />
                  <button onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={login} disabled={loading}
                className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold
                           rounded-2xl font-body flex items-center justify-center gap-2 transition-colors
                           disabled:opacity-50 shadow-glow-blue disabled:shadow-none">
                {loading ? <><Loader2 size={18} className="animate-spin" /> Logging in...</> : 'Login'}
              </motion.button>

              {/* Demo credentials — same style as Citizen & Admin pages */}
              <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 text-xs text-slate-400 font-body space-y-2.5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-slate-300">👷 Demo Officers for Testing</span>
                  <span className="inline-block px-2 py-0.5 bg-primary-600/20 border border-primary-500/30 rounded text-primary-300 text-xs font-mono">Try these</span>
                </div>
                {DEMO_OFFICERS.map((o, idx) => (
                  <button key={idx} onClick={() => fillDemo(o)}
                    className="w-full text-left p-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50
                               hover:border-primary-500/50 rounded-lg transition-all duration-200 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 font-semibold text-xs mb-1 flex items-center gap-1.5">
                          <User size={10} className="text-primary-400" />
                          {o.label}
                        </p>
                        <p className="text-slate-400 text-xs font-mono truncate">
                          ID: <span className="text-primary-400">{o.empId}</span>
                        </p>
                        <p className="text-slate-500 text-xs font-mono truncate">{o.email}</p>
                      </div>
                      <span className="text-slate-400 group-hover:text-primary-400 transition-colors shrink-0">→</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1.5">
                      Pass: <span className="text-emerald-400 font-mono">{o.pwd}</span>
                    </p>
                  </button>
                ))}
                <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-700/50 mt-2">
                  💡 Click any officer to auto-fill credentials
                </p>
              </div>

              <p className="text-center text-slate-600 text-xs font-body">
                Admin?{' '}
                <button onClick={() => navigate('/admin')} className="text-primary-500 hover:text-primary-400">
                  Use Admin Console →
                </button>
              </p>
            </motion.div>
          ) : (
            <motion.div key="register"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm space-y-4">

              <h1 className="font-display font-bold text-2xl text-white text-center mb-2">Register Officer</h1>

              {[
                { k: 'employee_id', label: 'Employee ID *', placeholder: 'OFF-001-1' },
                { k: 'full_name',   label: 'Full Name *',   placeholder: 'Rajesh Kumar' },
                { k: 'phone',       label: 'Mobile *',      placeholder: '9876543210' },
              ].map(({ k, label, placeholder }) => (
                <div key={k}>
                  <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">{label}</label>
                  <input type="text" value={(regData as any)[k]} onChange={upd(k as any)} placeholder={placeholder}
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                               outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm" />
                </div>
              ))}

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Designation</label>
                <select value={regData.designation} onChange={upd('designation')}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                             outline-none focus:border-primary-500 font-body text-sm">
                  <option value="">Select designation</option>
                  {MCD_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Department</label>
                <select value={regData.department} onChange={upd('department')}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                             outline-none focus:border-primary-500 font-body text-sm">
                  <option value="">Select department</option>
                  {MCD_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">Ward</label>
                <input type="text" placeholder="Search ward..."
                  value={wardSearch} onChange={e => setWardSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                             outline-none focus:border-primary-500 font-body placeholder:text-slate-500 text-sm mb-1" />
                {wardSearch && (
                  <div className="max-h-36 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl">
                    {filteredWards.slice(0, 15).map(w => (
                      <button key={w.ward_id}
                        onClick={() => {
                          setRegData(d => ({ ...d, ward_id: String(w.ward_id), zone: w.zone || '' }))
                          setWardSearch(w.ward_name)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors
                          ${regData.ward_id === String(w.ward_id) ? 'bg-slate-700' : ''}`}>
                        {w.ward_name} <span className="text-slate-500 text-xs">· {w.zone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {[
                { k: 'password',    label: 'Password *' },
                { k: 'confirm_pwd', label: 'Confirm Password *' },
              ].map(({ k, label }) => (
                <div key={k}>
                  <label className="text-sm font-semibold text-slate-300 block mb-1.5 font-body">{label}</label>
                  <input type="password" value={(regData as any)[k]} onChange={upd(k as any)}
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-2xl
                               outline-none focus:border-primary-500 font-body text-sm" />
                </div>
              ))}

              <motion.button whileTap={{ scale: 0.97 }} onClick={register} disabled={loading}
                className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold
                           rounded-2xl font-body flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                {loading ? <><Loader2 size={18} className="animate-spin" /> Registering...</> : 'Create Account'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}