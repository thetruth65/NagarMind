import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, CheckCircle, Clock, AlertCircle, User, Camera, Flag } from 'lucide-react'

export interface TimelineStatus {
  id: string
  label: string
  emoji: string
  timestamp: string
  description: string
  details?: {
    officer?: string
    confidence?: number
    category?: string
    notes?: string
    photos?: string[]
  }
  expanded?: boolean
}

interface StatusTimelineProps {
  statuses: TimelineStatus[]
  slaHours: number
  isResolved: boolean
  resolutionTime?: number
}

const STATUS_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  submitted: { bg: 'bg-blue-50', border: 'border-blue-200', icon: '📤' },
  classified: { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: '🤖' },
  assigned: { bg: 'bg-blue-50', border: 'border-blue-200', icon: '👤' },
  in_progress: { bg: 'bg-orange-50', border: 'border-orange-200', icon: '🔧' },
  resolved: { bg: 'bg-green-50', border: 'border-green-200', icon: '✅' },
  closed: { bg: 'bg-green-50', border: 'border-green-200', icon: '🔒' },
  disputed: { bg: 'bg-red-50', border: 'border-red-200', icon: '⚠️' },
  dispute_resolved: { bg: 'bg-green-50', border: 'border-green-200', icon: '🔄' },
}

export function StatusTimeline({
  statuses,
  slaHours,
  isResolved,
  resolutionTime,
}: StatusTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(statuses[statuses.length - 1]?.id || null)

  const toggleExpand = (id: string) => {
    setExpanded(expanded === id ? null : id)
  }

  const formatTime = (minutes: number | undefined) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    return `${hours}h ${mins}m`
  }

  return (
    <div className="space-y-4">
      {/* Header with SLA info */}
      {!isResolved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <Clock size={18} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              ⏱️ SLA Time Remaining
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Expected resolution within {slaHours} hours
            </p>
          </div>
        </motion.div>
      )}

      {isResolved && resolutionTime && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <CheckCircle size={18} className="text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">
              ✅ Resolved in {formatTime(resolutionTime)}
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              SLA: {resolutionTime <= slaHours * 60 ? '✓ Met' : '✗ Breached'} ({slaHours}h SLA)
            </p>
          </div>
        </motion.div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {statuses.map((status, index) => {
          const isLast = index === statuses.length - 1
          const colors = STATUS_COLORS[status.id] || STATUS_COLORS.submitted
          const isExpanded = expanded === status.id

          return (
            <motion.div
              key={status.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Timeline connector */}
              {!isLast && (
                <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-primary-300 to-gray-200" />
              )}

              {/* Timeline item */}
              <motion.button
                onClick={() => toggleExpand(status.id)}
                className={`w-full text-left ${colors.bg} border-2 ${colors.border} rounded-xl p-4
                  transition-all hover:shadow-md relative z-10`}
              >
                <div className="flex items-start gap-3">
                  {/* Timeline dot */}
                  <motion.div
                    animate={{ scale: isExpanded ? 1.2 : 1 }}
                    className="w-12 h-12 rounded-full bg-white border-2 border-primary-500 flex items-center
                               justify-center text-lg font-bold shrink-0 mt-0.5"
                  >
                    {status.emoji}
                  </motion.div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{status.label}</h3>
                      {isExpanded && <ChevronDown size={16} className="text-gray-500" />}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{status.timestamp}</p>
                    <p className="text-sm text-gray-700">{status.description}</p>
                  </div>
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && status.details && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4 pt-4 border-t border-gray-300 space-y-3"
                    >
                      {/* Officer info */}
                      {status.details.officer && (
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-500" />
                          <span className="text-sm text-gray-700">
                            <strong>Officer:</strong> {status.details.officer}
                          </span>
                        </div>
                      )}

                      {/* Category & Confidence */}
                      {status.details.category && (
                        <div className="flex items-start gap-2">
                          <Flag size={16} className="text-gray-500 mt-0.5" />
                          <div className="text-sm text-gray-700">
                            <strong>Category:</strong> {status.details.category}
                            {status.details.confidence && (
                              <span className="text-xs text-gray-600 ml-2">
                                (Confidence: {(status.details.confidence * 100).toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {status.details.notes && (
                        <div className="bg-white rounded-lg p-2 text-sm text-gray-700">
                          <strong>Notes:</strong> {status.details.notes}
                        </div>
                      )}

                      {/* Photos */}
                      {status.details.photos && status.details.photos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">
                            📸 Photos ({status.details.photos.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {status.details.photos.map((photo, i) => (
                              <motion.div
                                key={i}
                                whileHover={{ scale: 1.05 }}
                                className="aspect-square rounded-lg overflow-hidden cursor-pointer"
                              >
                                <img
                                  src={photo}
                                  alt="Status"
                                  className="w-full h-full object-cover hover:brightness-110 transition"
                                />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
