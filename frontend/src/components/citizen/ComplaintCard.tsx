import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Clock, Image } from 'lucide-react'
import { CATEGORY_CONFIG, STATUS_CONFIG, URGENCY_CONFIG, type Complaint } from '@/types'
import { formatDistanceToNow, formatSLACountdown } from '@/lib/utils'

interface Props { complaint: Complaint; officerView?: boolean }

export function ComplaintCard({ complaint: c, officerView = false }: Props) {
  const catCfg    = CATEGORY_CONFIG[c.category || 'other'] || CATEGORY_CONFIG.other
  const statusCfg = STATUS_CONFIG[c.status]    || STATUS_CONFIG.submitted
  const urgCfg    = URGENCY_CONFIG[c.urgency || 'medium'] || URGENCY_CONFIG.medium
  const sla       = c.sla_remaining_seconds != null ? formatSLACountdown(c.sla_remaining_seconds) : null
  const isActive  = !['resolved','closed'].includes(c.status)

  const href = officerView ? `/officer/complaint/${c.complaint_id}` : `/citizen/track/${c.complaint_id}`

  return (
    <Link to={href}>
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex hover:border-primary-500/50 transition-all">
        {/* Urgency stripe */}
        <div className={`w-1.5 shrink-0 ${urgCfg.bg.replace('100', '500').replace('bg-', 'bg-')}`} />

        <div className="p-3 bg-slate-800/50 shrink-0 self-center">
           <div className="text-3xl">{catCfg.icon}</div>
        </div>

        <div className="flex-1 py-3 pr-4 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="font-semibold text-white text-sm font-body leading-snug line-clamp-1 flex-1">
              {c.title}
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusCfg.color.replace('700', '400')} ${statusCfg.bg.replace('100', '900/40')} border ${statusCfg.bg.replace('100', '800')}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${urgCfg.color.replace('700', '400')} ${urgCfg.bg.replace('100', '900/40')} border ${urgCfg.bg.replace('100', '800')}`}>
              {urgCfg.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {c.location_address && (
              <p className="text-[10px] text-slate-400 font-body flex items-center gap-1 truncate max-w-[140px]">
                <MapPin size={10} /> {c.location_address}
              </p>
            )}
            {sla && isActive && (
              <p className={`text-[10px] font-body flex items-center gap-1 font-medium ${c.sla_remaining_seconds! <= 0 ? 'text-red-400' : 'text-amber-400'}`}>
                <Clock size={10} /> {c.sla_remaining_seconds! <= 0 ? '⚠️ Overdue' : sla.text}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}