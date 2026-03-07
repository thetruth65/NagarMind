import { forwardRef } from 'react'
import { motion } from 'framer-motion'

interface Props {
  value: string
  onChange: (val: string) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

export const PhoneInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, error, disabled, placeholder = 'Enter mobile number' }, ref) => {
    const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
      onChange(raw)
    }

    return (
      <div className="space-y-1">
        <div className={`flex items-center rounded-2xl border-2 bg-white overflow-hidden
                         transition-all duration-200 shadow-sm
                         ${error ? 'border-red-400' : 'border-gray-200 focus-within:border-primary-500'}`}>
          {/* Country code badge */}
          <div className="flex items-center gap-2 px-4 py-4 bg-gray-50 border-r border-gray-200 shrink-0">
            <span className="text-xl">🇮🇳</span>
            <span className="text-gray-600 font-medium text-sm">+91</span>
          </div>
          <input
            ref={ref}
            type="tel"
            inputMode="numeric"
            value={value}
            onChange={handle}
            disabled={disabled}
            placeholder={placeholder}
            className="flex-1 px-4 py-4 text-gray-800 text-base font-body outline-none bg-transparent
                       placeholder:text-gray-400 disabled:opacity-50"
          />
          {value.length === 10 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="pr-4 text-green-500"
            >
              ✓
            </motion.div>
          )}
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-sm px-1"
          >
            {error}
          </motion.p>
        )}
      </div>
    )
  }
)