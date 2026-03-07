import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '@/types'
import { useAuthStore } from '@/stores/authStore'

interface Props {
  onSelect?: (code: string) => void
  compact?: boolean
}

export function LanguageSelector({ onSelect, compact = false }: Props) {
  const [open, setOpen] = useState(false)
  const { preferredLanguage, setLanguage } = useAuthStore()
  const current = SUPPORTED_LANGUAGES.find(l => l.code === preferredLanguage) || SUPPORTED_LANGUAGES[0]

  const handle = (code: string) => {
    setLanguage(code)
    onSelect?.(code)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20
                   border border-white/20 text-white text-sm font-medium transition-all duration-200"
      >
        <Globe size={15} />
        <span>{current.nativeName}</span>
        <span className="text-white/50 text-xs">▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-48 bg-white rounded-2xl shadow-2xl
                         border border-gray-100 overflow-hidden"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handle(lang.code)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm
                              hover:bg-primary-50 transition-colors text-left
                              ${lang.code === preferredLanguage ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                >
                  <span>{lang.nativeName}</span>
                  <span className="text-gray-400 text-xs">{lang.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}