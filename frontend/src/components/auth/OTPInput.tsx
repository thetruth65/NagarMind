import { useRef, useEffect, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'

interface Props {
  value: string
  onChange: (val: string) => void
  length?: number
  error?: string
  disabled?: boolean
}

export function OTPInput({ value, onChange, length = 6, error, disabled }: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length)

  const focusNext = (idx: number) => {
    if (idx < length - 1) inputs.current[idx + 1]?.focus()
  }
  const focusPrev = (idx: number) => {
    if (idx > 0) inputs.current[idx - 1]?.focus()
  }

  const handleChange = (idx: number, val: string) => {
    if (!val.match(/^[0-9]?$/)) return
    const newDigits = [...digits]
    newDigits[idx] = val
    onChange(newDigits.join(''))
    if (val) focusNext(idx)
  }

  const handleKeyDown = (idx: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!digits[idx]) focusPrev(idx)
      else {
        const newDigits = [...digits]
        newDigits[idx] = ''
        onChange(newDigits.join(''))
      }
    }
    if (e.key === 'ArrowLeft') focusPrev(idx)
    if (e.key === 'ArrowRight') focusNext(idx)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(paste.padEnd(length, '').slice(0, length))
    // Focus last filled input
    const lastIdx = Math.min(paste.length, length - 1)
    inputs.current[lastIdx]?.focus()
  }

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex gap-3 justify-center">
        {Array.from({ length }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <input
              ref={(el) => (inputs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[i] || ''}
              disabled={disabled}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`
                w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none
                transition-all duration-200 font-body
                ${error
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : digits[i]
                    ? 'border-primary-500 bg-primary-50 text-primary-800'
                    : 'border-gray-200 bg-white text-gray-800 focus:border-primary-400 focus:bg-primary-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                shadow-sm
              `}
            />
          </motion.div>
        ))}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-sm text-center"
        >
          {error}
        </motion.p>
      )}
    </div>
  )
}