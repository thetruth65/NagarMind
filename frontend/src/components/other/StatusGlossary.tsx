import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface GlossaryItem {
  id: string
  emoji: string
  title: string
  definition: string
  details: {
    section1Title: string
    section1: string
    section2Title: string
    section2: string
  }
}

const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    id: 'submitted',
    emoji: '📤',
    title: 'SUBMITTED',
    definition: 'Your complaint has been received and is waiting to be processed',
    details: {
      section1Title: 'What happens now?',
      section1:
        'Your complaint has been queued for AI analysis. This typically takes 1-2 minutes. You will receive an SMS update once it is classified into a category.',
      section2Title: 'Next Step',
      section2:
        'AI will automatically categorize your complaint and assign it to the relevant officer based on location and expertise.',
    },
  },
  {
    id: 'classified',
    emoji: '🤖',
    title: 'AI CLASSIFIED',
    definition: 'The system has automatically categorized your complaint',
    details: {
      section1Title: 'What this means',
      section1:
        'Our AI analyzed your description, photos, location, and other data to determine the category. The confidence score shows how certain the AI is about this classification.',
      section2Title: 'Category Accuracy',
      section2:
        'If the category is incorrect, you can dispute it and request manual review. Officers can also adjust the category if needed.',
    },
  },
  {
    id: 'assigned',
    emoji: '👤',
    title: 'ASSIGNED',
    definition: 'An officer has been assigned to handle your complaint',
    details: {
      section1Title: 'Who is working on it?',
      section1:
        'A specific officer from your ward has been assigned. They will assess the issue and prioritize it along with other complaints. The SLA (Service Level Agreement) timer has started.',
      section2Title: 'SLA Timeline',
      section2:
        'Different complaint types have different SLAs. For potholes: 12 hours. For water issues: 6 hours. The officer must either resolve it or provide an update within this timeframe.',
    },
  },
  {
    id: 'in_progress',
    emoji: '🔧',
    title: 'IN PROGRESS',
    definition: 'The officer has started working on resolving your complaint',
    details: {
      section1Title: 'What are they doing?',
      section1:
        'The assigned officer is now actively working on the issue. They may be inspecting the site, gathering materials, or coordinating with contractors. Traffic updates and photos may be added.',
      section2Title: 'How long will it take?',
      section2:
        'Simple repairs might be done in hours. Complex issues may require planning, approvals, or multiple visits. Check back for updates or photos from the field.',
    },
  },
  {
    id: 'resolved',
    emoji: '✅',
    title: 'RESOLVED',
    definition: 'The issue has been fixed or addressed',
    details: {
      section1Title: 'What now?',
      section1:
        'The officer has completed the work and marked the complaint as resolved. Photos of the completed work are attached. You should see the fix in 1-2 days.',
      section2Title: 'Rate the response',
      section2:
        'You can now rate the officer\'s work and provide feedback. Your rating helps us improve service quality and recognize outstanding officers. This rating is visible to superiors.',
    },
  },
  {
    id: 'closed',
    emoji: '🔒',
    title: 'CLOSED',
    definition: 'The complaint process is complete',
    details: {
      section1Title: 'What this means',
      section1:
        'You have provided a rating or 7 days have passed since resolution. The complaint is now archived but visible in your history. You can still view photos and details anytime.',
      section2Title: 'Open a new complaint?',
      section2:
        'If the issue persists or recurs, you can file a new complaint. Reference the previous complaint ID for continuity. Officers will be notified about recurring issues.',
    },
  },
  {
    id: 'disputed',
    emoji: '⚠️',
    title: 'DISPUTED',
    definition: 'You have disputed the resolution or category',
    details: {
      section1Title: 'Why dispute?',
      section1:
        'You can dispute if you believe the category is wrong, the resolution is incomplete, or the work quality is poor. Provide evidence (photos, video, detailed notes) to support your dispute.',
      section2Title: 'Next steps',
      section2:
        'Your dispute is escalated to a senior officer for manual review. They will re-examine the case, inspect the site, and determine if the issue needs rework or reclassification.',
    },
  },
  {
    id: 'dispute_resolved',
    emoji: '🔄',
    title: 'DISPUTE RESOLVED',
    definition: 'The dispute has been reviewed and finalized',
    details: {
      section1Title: 'What happened?',
      section1:
        'A senior officer has reviewed your dispute and made a final decision. They may have ordered rework, provided a detailed explanation, or adjusted the category. Their decision is final (unless further evidence emerges).',
      section2Title: 'Next action',
      section2:
        'If rework was ordered, the original officer or a new team will complete it. Otherwise, the complaint proceeds to closure. You will receive SMS updates about any changes.',
    },
  },
]

interface StatusGlossaryProps {
  isOpen: boolean
  onClose: () => void
}

export function StatusGlossary({ isOpen, onClose }: StatusGlossaryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-20 bottom-4 bg-white rounded-2xl shadow-2xl z-50 flex flex-col
                       md:inset-x-auto md:w-full md:max-w-2xl md:left-1/2 md:-translate-x-1/2 md:max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-xl font-display font-bold text-gray-900">Complaint Status Guide</h2>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {GLOSSARY_ITEMS.map((item, index) => {
                const isExpanded = expandedId === item.id

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border border-gray-200 rounded-xl overflow-hidden"
                  >
                    <motion.button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-full p-4   bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50
                                transition-colors flex items-start gap-3"
                    >
                      {/* Icon */}
                      <span className="text-2xl mt-0.5 shrink-0">{item.emoji}</span>

                      {/* Content */}
                      <div className="text-left flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{item.title}</h3>
                        <p className="text-sm text-gray-600 mt-0.5">{item.definition}</p>
                      </div>

                      {/* Chevron */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        className="mt-1 shrink-0"
                      >
                        <ChevronDown size={18} className="text-gray-500" />
                      </motion.div>
                    </motion.button>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3"
                        >
                          {/* Section 1 */}
                          <div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              {item.details.section1Title}
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {item.details.section1}
                            </p>
                          </div>

                          {/* Divider */}
                          <div className="h-px bg-gray-300" />

                          {/* Section 2 */}
                          <div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              {item.details.section2Title}
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {item.details.section2}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl shrink-0">
              <p className="text-xs text-gray-600 text-center">
                💡 Not sure about a status? Click any status above to learn more.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
