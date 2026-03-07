import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Shield, Zap, Users, TrendingUp, ChevronRight, Star, ArrowRight } from 'lucide-react'
import { analyticsAPI } from '@/lib/api'

interface SummaryCard {
  total_wards: number
  total_complaints: number
  resolved: number
  city_health_score: number
  registered_citizens: number
  active_officers: number
  resolution_rate: number
}

const FEATURES = [
  { icon: '📍', title: 'Report Instantly', desc: 'Voice, photo or text — in your language' },
  { icon: '🤖', title: 'AI Classification', desc: 'Auto-routed to the right officer in seconds' },
  { icon: '⏱️', title: 'SLA Tracking', desc: 'Every complaint has a real deadline' },
  { icon: '📊', title: 'Ward Intelligence', desc: 'Live health scores for all 272 wards' },
]

const STATS_DISPLAY = [
  { key: 'registered_citizens', label: 'Citizens', icon: '👥', suffix: '+' },
  { key: 'active_officers',     label: 'Officers',  icon: '👷', suffix: '' },
  { key: 'total_complaints',    label: 'Complaints', icon: '📋', suffix: '+' },
  { key: 'resolution_rate',     label: 'Resolved',   icon: '✅', suffix: '%' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<SummaryCard | null>(null)
  const [activeRole, setActiveRole] = useState<'citizen' | 'officer' | null>(null)

  useEffect(() => {
    analyticsAPI.summaryCard().then(r => setSummary(r.data)).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* ── Background ── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,_#1e3a8a30_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,_#16534020_0%,_transparent_60%)]" />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, #ffffff08 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* ── Nav ── */}
      <header className="relative z-20 flex items-center justify-between px-6 md:px-12 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-600/20 border border-primary-500/40 flex items-center justify-center">
            <MapPin size={18} className="text-primary-400" />
          </div>
          <div>
            <span className="font-display font-bold text-lg text-white">NagarMind</span>
            <span className="block text-[10px] text-slate-500 leading-none font-body">Civic Intelligence</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/citizen/auth')}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors font-body">
            Citizen Login
          </button>
          <button onClick={() => navigate('/officer/auth')}
            className="px-4 py-2 text-sm bg-primary-600/20 border border-primary-500/40 text-primary-300
                       hover:bg-primary-600/30 rounded-xl transition-all font-body">
            Officer / Admin
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 px-6 md:px-12 pt-20 pb-16 text-center max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600/15 border border-primary-500/30
                          text-primary-300 rounded-full text-xs font-semibold font-body mb-6 uppercase tracking-wider">
            <Zap size={12} className="text-primary-400" />
            Delhi's Civic Intelligence Platform
          </div>

          <h1 className="font-display font-bold text-5xl md:text-7xl leading-tight mb-6">
            <span className="text-white">Your Voice,</span>
            <br />
            <span className="bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">
              Your Ward.
            </span>
          </h1>

          <p className="text-slate-400 text-lg md:text-xl font-body max-w-2xl mx-auto mb-10 leading-relaxed">
            Report civic issues in any Indian language. Track resolution in real time.
            AI routes complaints to the right officer — every complaint has a deadline.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/citizen/auth')}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-500
                         text-white font-semibold rounded-2xl text-base font-body shadow-glow-blue transition-all"
            >
              Report an Issue <ArrowRight size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/officer/auth')}
              className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-slate-700
                         hover:border-slate-500 text-slate-300 hover:text-white font-semibold
                         rounded-2xl text-base font-body transition-all"
            >
              <Shield size={18} /> Officer Portal
            </motion.button>
          </div>
        </motion.div>

        {/* ── Live stats ── */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {STATS_DISPLAY.map((s) => {
              const val = (summary as any)[s.key]
              return (
                <div key={s.key}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center
                             backdrop-blur-sm hover:border-slate-700 transition-colors">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="font-display font-bold text-xl text-white">
                    {typeof val === 'number' ? (val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val) : '—'}{s.suffix}
                  </div>
                  <div className="text-xs text-slate-500 font-body">{s.label}</div>
                </div>
              )
            })}
          </motion.div>
        )}
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i + 0.5 }}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5
                         hover:border-primary-500/40 hover:bg-slate-900 transition-all group"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-display font-semibold text-white text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-slate-500 font-body leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Role Cards ── */}
      <section className="relative z-10 px-6 md:px-12 pb-20 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display font-bold text-3xl text-white mb-2">Choose your role</h2>
          <p className="text-slate-500 font-body">Access the platform as Citizen, Officer, or Administrator</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              role: 'citizen' as const,
              title: 'Citizen',
              icon: '🏠',
              desc: 'Report issues, track resolution, rate officer performance',
              path: '/citizen/auth',
              color: 'from-blue-600/20 to-blue-900/20',
              border: 'border-blue-500/30',
            },
            {
              role: 'officer' as const,
              title: 'JE / Officer',
              icon: '👷',
              desc: 'Manage ward complaints, update statuses, meet SLAs',
              path: '/officer/auth',
              color: 'from-green-600/20 to-green-900/20',
              border: 'border-green-500/30',
            },
            {
              role: null as any,
              title: 'Administrator',
              icon: '🛡️',
              desc: 'City-wide analytics, officer management, AI alerts',
              path: '/admin',
              color: 'from-purple-600/20 to-purple-900/20',
              border: 'border-purple-500/30',
            },
          ].map((card) => (
            <motion.button
              key={card.title}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(card.path)}
              className={`text-left p-6 rounded-3xl bg-gradient-to-br ${card.color}
                          border ${card.border} hover:brightness-125 transition-all group`}
            >
              <div className="text-4xl mb-4">{card.icon}</div>
              <h3 className="font-display font-bold text-lg text-white mb-2">{card.title}</h3>
              <p className="text-sm text-slate-400 font-body leading-relaxed mb-4">{card.desc}</p>
              <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-white transition-colors font-body">
                Get started <ChevronRight size={14} />
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-slate-800/60 px-6 py-6 text-center">
        <p className="text-slate-600 text-xs font-body">
          NagarMind — Built for MCD Delhi • 272 Wards • Real-time Civic Intelligence
        </p>
      </footer>
    </div>
  )
}