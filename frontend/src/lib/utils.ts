// ─────────────────────────────────────────────────────────────────────────────
// NagarMind — Utility Functions
// src/lib/utils.ts
// ─────────────────────────────────────────────────────────────────────────────

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CATEGORY_CONFIG, STATUS_CONFIG, URGENCY_CONFIG } from '@/types'

// ── Tailwind class merge ──────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date utils ────────────────────────────────────────────────────────────────

export function formatDate(
  date: string | Date,
  format: 'short' | 'long' | 'relative' = 'short'
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'

  if (format === 'relative') return formatDistanceToNow(date)

  if (format === 'long') {
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDistanceToNow(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const secs = Math.floor(diff / 1000)

  if (secs <  60)           return 'just now'
  if (secs <  3600)         return `${Math.floor(secs / 60)}m ago`
  if (secs <  86400)        return `${Math.floor(secs / 3600)}h ago`
  if (secs <  86400 * 7)    return `${Math.floor(secs / 86400)}d ago`
  return formatDate(d, 'short')
}

export function formatSLACountdown(seconds: number): { text: string; color: string } {
  if (seconds <= 0) return { text: 'Overdue', color: 'text-red-600' }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const text = h > 0 ? `${h}h ${m}m` : `${m}m`
  const color =
    seconds < 3600  ? 'text-red-600'   :
    seconds < 7200  ? 'text-amber-600' :
                      'text-green-600'
  return { text, color }
}

// ── Category / status / urgency derived maps ──────────────────────────────────

export const URGENCY_COLORS = URGENCY_CONFIG

export const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, v.icon])
)

export const STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> =
  Object.fromEntries(
    Object.entries(STATUS_CONFIG).map(([k, v]) => [
      k,
      { label: v.label, icon: v.icon, color: `${v.bg} ${v.color}` },
    ])
  )

// ── String utils ──────────────────────────────────────────────────────────────

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

export function slugToLabel(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function truncate(str: string, maxLen = 100): string {
  return str.length <= maxLen ? str : str.slice(0, maxLen) + '…'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

// ── Number utils ──────────────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}

// ── Grade utils ───────────────────────────────────────────────────────────────

export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: 'text-green-600',
    B: 'text-blue-600',
    C: 'text-amber-600',
    D: 'text-orange-600',
    F: 'text-red-600',
  }
  return map[grade] ?? 'text-slate-600'
}

export function gradeBg(grade: string): string {
  const map: Record<string, string> = {
    A: 'bg-green-100',
    B: 'bg-blue-100',
    C: 'bg-amber-100',
    D: 'bg-orange-100',
    F: 'bg-red-100',
  }
  return map[grade] ?? 'bg-slate-100'
}

// Dark-theme grade background (for admin pages on slate-900/950 bg)
export function gradeBgDark(grade: string): string {
  const map: Record<string, string> = {
    A: 'bg-green-500/20  text-green-400',
    B: 'bg-blue-500/20   text-blue-400',
    C: 'bg-amber-500/20  text-amber-400',
    D: 'bg-orange-500/20 text-orange-400',
    F: 'bg-red-500/20    text-red-400',
  }
  return map[grade] ?? 'bg-slate-700 text-slate-300'
}

// ── Health score to hex color ─────────────────────────────────────────────────
// Used by admin heatmap, analytics

export const healthColor = (score: number): string => {
  if (score >= 80) return '#22c55e'  // green-500
  if (score >= 65) return '#3b82f6'  // blue-500
  if (score >= 50) return '#f59e0b'  // amber-500
  if (score >= 35) return '#f97316'  // orange-500
  return '#ef4444'                   // red-500
}

// ── Avatar generation ─────────────────────────────────────────────────────────
// Returns [bgHex, textHex]

const AVATAR_COLORS: [string, string][] = [
  ['#dbeafe', '#1d4ed8'],
  ['#dcfce7', '#15803d'],
  ['#fef3c7', '#b45309'],
  ['#f3e8ff', '#7e22ce'],
  ['#ffe4e6', '#be123c'],
  ['#e0f2fe', '#0369a1'],
]

export function getAvatarColor(name: string): [string, string] {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

// ── File download ─────────────────────────────────────────────────────────────

export const downloadBlob = (data: Blob, filename: string): void => {
  const url = URL.createObjectURL(new Blob([data]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Phone normalization ───────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2)
  if (digits.startsWith('0')  && digits.length === 11) return digits.slice(1)
  return digits
}

// ── Complaint helpers ─────────────────────────────────────────────────────────

export function getCategoryLabel(category: string): string {
  return CATEGORY_CONFIG[category]?.label ?? slugToLabel(category)
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_CONFIG[category]?.icon ?? '📋'
}

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? capitalize(status)
}

export function getUrgencyLabel(urgency: string): string {
  return URGENCY_CONFIG[urgency]?.label ?? capitalize(urgency)
}