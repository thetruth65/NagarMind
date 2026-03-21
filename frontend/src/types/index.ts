// ─────────────────────────────────────────────────────────────────────────────
// NagarMind — types/index.ts  (complete, no duplicates, fully backwards-compatible)
// ─────────────────────────────────────────────────────────────────────────────

// ── Role ──────────────────────────────────────────────────────────────────────
export type Role = 'citizen' | 'officer' | 'admin'

// ── Category ──────────────────────────────────────────────────────────────────
// 10 canonical keys — exactly what complaint_pipeline.py writes to DB
export type CategoryKey =
  | 'pothole'
  | 'garbage'
  | 'sewage'
  | 'water_supply'
  | 'streetlight'
  | 'tree'
  | 'stray_animals'
  | 'encroachment'
  | 'noise'
  | 'other'

export interface CategoryConfig {
  label: string
  icon: string
  color: string       // Tailwind text class
  bg: string          // Tailwind bg class — old pages (e.g. 'bg-orange-100')
  bgColor: string     // Tailwind bg class — new pages (e.g. 'bg-orange-500/10')
  borderColor: string
  description: string
  dept?: string
}

// Record<string, ...> so pages can index with dynamic/legacy string keys without cast errors
export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  pothole: {
    label: 'Pothole', icon: '🕳️',
    color: 'text-orange-400', bg: 'bg-orange-100',
    bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30',
    description: 'Road damage, craters, pits', dept: 'Roads & Drainage',
  },
  garbage: {
    label: 'Garbage', icon: '🗑️',
    color: 'text-yellow-400', bg: 'bg-yellow-100',
    bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30',
    description: 'Waste, litter, overflowing bins', dept: 'Public Health & Sanitation',
  },
  sewage: {
    label: 'Sewage', icon: '💧',
    color: 'text-blue-400', bg: 'bg-blue-100',
    bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30',
    description: 'Drain blockage, overflow, smell', dept: 'Public Health & Sanitation',
  },
  water_supply: {
    label: 'Water Supply', icon: '🚰',
    color: 'text-cyan-400', bg: 'bg-cyan-100',
    bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30',
    description: 'No water, low pressure, contamination', dept: 'Water Supply',
  },
  streetlight: {
    label: 'Streetlight', icon: '💡',
    color: 'text-yellow-300', bg: 'bg-yellow-100',
    bgColor: 'bg-yellow-400/10', borderColor: 'border-yellow-400/30',
    description: 'Broken, missing, or flickering lights', dept: 'Roads & Drainage',
  },
  tree: {
    label: 'Tree / Park', icon: '🌳',
    color: 'text-green-400', bg: 'bg-emerald-100',
    bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30',
    description: 'Fallen trees, overgrown branches, park issues', dept: 'Horticulture',
  },
  stray_animals: {
    label: 'Stray Animals', icon: '🐕',
    color: 'text-amber-400', bg: 'bg-amber-100',
    bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30',
    description: 'Dogs, cattle causing hazard on roads', dept: 'Health Services',
  },
  encroachment: {
    label: 'Encroachment', icon: '🚧',
    color: 'text-red-400', bg: 'bg-red-100',
    bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30',
    description: 'Illegal construction, blocked road or footpath', dept: 'Planning & Development',
  },
  noise: {
    label: 'Noise', icon: '🔊',
    color: 'text-purple-400', bg: 'bg-purple-100',
    bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30',
    description: 'Excessive noise, loudspeakers, construction sounds', dept: 'Public Health & Sanitation',
  },
  other: {
    label: 'Other', icon: '📋',
    color: 'text-slate-400', bg: 'bg-gray-100',
    bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/30',
    description: 'Any other civic issue not listed above', dept: 'Administration',
  },
}

// Ordered list of the 10 canonical keys — use this for rendering UI grids/lists
// (never use Object.keys(CATEGORY_CONFIG) in UI — legacy aliases are also stored there)
export const CATEGORY_KEYS: CategoryKey[] = [
  'pothole', 'garbage', 'sewage', 'water_supply', 'streetlight',
  'tree', 'stray_animals', 'encroachment', 'noise', 'other',
]

// Legacy DB / old setup-script keys → point to canonical entry (zero data duplication)
;(function registerLegacyAliases() {
  const C = CATEGORY_CONFIG
  C.water                  = C.water_supply
  C.road_damage            = C.pothole
  C.pollution              = C.noise
  C.building               = C.encroachment
  C.roads_and_footpaths    = C.pothole
  C.sanitation_and_garbage = C.garbage
  C.drainage_and_flooding  = C.sewage
  C.street_lighting        = C.streetlight
  C.parks_and_gardens      = C.tree
  C.illegal_construction   = C.encroachment
  C.noise_and_pollution    = C.noise
})()

// ── Priority / Urgency ────────────────────────────────────────────────────────
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low'
export type UrgencyLevel = PriorityLevel

export interface UrgencyConfig {
  label: string
  icon: string
  color: string       // Tailwind text class
  bg: string          // Tailwind bg class (required — used by ComplaintCard)
  bgColor: string     // alias for new pages
  borderColor: string
  border?: string     // old shape alias
  priority?: number
}

export const URGENCY_CONFIG: Record<string, UrgencyConfig> = {
  critical: {
    label: 'Critical', icon: '🔴',
    color: 'text-red-700', bg: 'bg-red-100',
    bgColor: 'bg-red-500/10', borderColor: 'border-red-500/40',
    border: 'border-red-500', priority: 1,
  },
  high: {
    label: 'High', icon: '🟠',
    color: 'text-orange-700', bg: 'bg-orange-100',
    bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/40',
    border: 'border-orange-500', priority: 2,
  },
  medium: {
    label: 'Medium', icon: '🟡',
    color: 'text-amber-700', bg: 'bg-amber-100',
    bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/40',
    border: 'border-amber-400', priority: 3,
  },
  low: {
    label: 'Low', icon: '🟢',
    color: 'text-green-700', bg: 'bg-green-100',
    bgColor: 'bg-green-500/10', borderColor: 'border-green-500/40',
    border: 'border-green-400', priority: 4,
  },
}

export const PRIORITY_CONFIG = URGENCY_CONFIG   // alias

// ── Complaint status ──────────────────────────────────────────────────────────
export type ComplaintStatus =
  | 'submitted'
  | 'pending'
  | 'ai_classified'
  | 'acknowledged'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'rejected'
  | 'disputed'
  | 'escalated'
  | 'reopened'

export interface StatusConfig {
  label: string
  icon: string
  color: string    // Tailwind text class
  bg: string       // Tailwind bg class (required — used by ComplaintCard & officer pages)
  bgColor?: string
  borderColor?: string
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  submitted:     { label: 'Submitted',    icon: '📝', color: 'text-slate-700',  bg: 'bg-slate-100',  bgColor: 'bg-blue-500/10',   borderColor: 'border-blue-500/30'   },
  pending:       { label: 'Pending',      icon: '⏳', color: 'text-amber-700',  bg: 'bg-amber-50',   bgColor: 'bg-amber-500/10',  borderColor: 'border-amber-500/30'  },
  ai_classified: { label: 'AI Processed', icon: '🤖', color: 'text-purple-700', bg: 'bg-purple-50',  bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  acknowledged:  { label: 'Acknowledged', icon: '👁️', color: 'text-indigo-700', bg: 'bg-indigo-50',  bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
  assigned:      { label: 'Assigned',     icon: '👷', color: 'text-blue-700',   bg: 'bg-blue-50',    bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/30' },
  in_progress:   { label: 'In Progress',  icon: '🔧', color: 'text-orange-700', bg: 'bg-orange-50',  bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  resolved:      { label: 'Resolved',     icon: '✅', color: 'text-green-700',  bg: 'bg-green-50',   bgColor: 'bg-green-500/10',  borderColor: 'border-green-500/30'  },
  closed:        { label: 'Closed',       icon: '🔒', color: 'text-slate-600',  bg: 'bg-slate-100',  bgColor: 'bg-slate-500/10',  borderColor: 'border-slate-500/30'  },
  rejected:      { label: 'Rejected',     icon: '❌', color: 'text-red-700',    bg: 'bg-red-50',     bgColor: 'bg-red-500/10',    borderColor: 'border-red-500/30'    },
  disputed:      { label: 'Disputed',     icon: '⚠️', color: 'text-red-700',    bg: 'bg-red-50',     bgColor: 'bg-red-500/10',    borderColor: 'border-red-500/30'    },
  escalated:     { label: 'Escalated',    icon: '🚨', color: 'text-rose-700',   bg: 'bg-rose-50',    bgColor: 'bg-rose-500/10',   borderColor: 'border-rose-500/30'   },
  reopened:      { label: 'Reopened',     icon: '🔄', color: 'text-orange-700', bg: 'bg-orange-50',  bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
}

// ── Status transition rules (officer) ────────────────────────────────────────
export const ALLOWED_TRANSITIONS: Record<string, ComplaintStatus[]> = {
  submitted:    ['acknowledged', 'rejected'],
  acknowledged: ['in_progress', 'assigned', 'rejected'],
  assigned:     ['in_progress', 'rejected'],
  in_progress:  ['resolved', 'rejected'],
  resolved:     ['closed'],
}

// ── Ward ──────────────────────────────────────────────────────────────────────
// ward_id and ward_name are required (old shape — OfficerAuthPage, CitizenAuthPage)
export interface Ward {
  ward_id: number
  ward_name: string
  id?: number          // new shape alias
  name?: string        // new shape alias
  zone?: string
  health_score?: number
  health_grade?: string
  lat_center?: number
  lng_center?: number
}

// ── MCD Officer constants ─────────────────────────────────────────────────────
export const MCD_DESIGNATIONS: string[] = [
  'Commissioner',
  'Additional Commissioner',
  'Joint Commissioner',
  'Deputy Commissioner',
  'Assistant Commissioner',
  'Executive Engineer',
  'Superintending Engineer',
  'Chief Engineer',
  'Assistant Engineer',
  'Junior Engineer',
  'Senior Engineer',
  'Health Officer',
  'Sanitary Inspector',
  'Health Inspector',
  'Ward Officer',
  'Zonal Officer',
  'Supervisor',
  'Beat Officer',
  'Sanitation Worker',
  'Driver',
  'Other',
]

export const MCD_DEPARTMENTS: string[] = [
  'Roads & Drainage',
  'Public Health & Sanitation',
  'Water Supply',
  'Horticulture',
  'Waste Management',
  'Planning & Development',
  'Building & Petrol',
  'Health Services',
  'Enforcement',
  'Animal Husbandry',
  'Electrical Engineering',
  'Finance & Accounts',
  'Administration',
  'Legal',
  'IT Department',
  'Other',
]

export const MCD_ZONES: string[] = [
  'Central', 'South', 'North', 'East', 'West', 'New Delhi', 'Shahdara',
]

// ── Supported Languages ───────────────────────────────────────────────────────
export interface SupportedLanguage {
  code: string
  name: string
  nativeName: string
  sarvam: string
  sttSupported: boolean
  script?: string
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    sarvam: 'en-IN', sttSupported: true,  script: 'latin'      },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',       sarvam: 'hi-IN', sttSupported: true,  script: 'devanagari' },
  { code: 'bn', name: 'Bengali',    nativeName: 'বাংলা',        sarvam: 'bn-IN', sttSupported: true,  script: 'bengali'    },
  { code: 'ta', name: 'Tamil',      nativeName: 'தமிழ்',        sarvam: 'ta-IN', sttSupported: true,  script: 'tamil'      },
  { code: 'te', name: 'Telugu',     nativeName: 'తెలుగు',       sarvam: 'te-IN', sttSupported: true,  script: 'telugu'     },
  { code: 'mr', name: 'Marathi',    nativeName: 'मराठी',        sarvam: 'mr-IN', sttSupported: true,  script: 'devanagari' },
  { code: 'gu', name: 'Gujarati',   nativeName: 'ગુજરાતી',     sarvam: 'gu-IN', sttSupported: true,  script: 'gujarati'   },
  { code: 'kn', name: 'Kannada',    nativeName: 'ಕನ್ನಡ',        sarvam: 'kn-IN', sttSupported: true,  script: 'kannada'    },
  { code: 'ml', name: 'Malayalam',  nativeName: 'മലയാളം',      sarvam: 'ml-IN', sttSupported: true,  script: 'malayalam'  },
  { code: 'pa', name: 'Punjabi',    nativeName: 'ਪੰਜਾਬੀ',       sarvam: 'pa-IN', sttSupported: true,  script: 'gurmukhi'   },
  { code: 'or', name: 'Odia',       nativeName: 'ଓଡ଼ିଆ',        sarvam: 'od-IN', sttSupported: false, script: 'odia'       },
  { code: 'as', name: 'Assamese',   nativeName: 'অসমীয়া',      sarvam: 'as-IN', sttSupported: false, script: 'bengali'    },
]

// ── Notification ──────────────────────────────────────────────────────────────
export interface Notification {
  id?: string
  notification_id?: string   // old shape
  user_id?: string
  user_role?: string
  type: 'status_update' | 'assignment' | 'sla_warning' | 'sla_breach' | 'system' | string
  title: string
  message?: string
  body?: string              // old shape alias
  is_read: boolean
  complaint_id?: string
  created_at: string
}

// ── Complaint interfaces ──────────────────────────────────────────────────────
export interface ComplaintTimeline {
  id?: string
  status?: string
  new_status?: string        // old shape
  previous_status?: string   // old shape
  note?: string
  changed_by?: string        // old shape
  created_at: string
  actor_role?: 'citizen' | 'officer' | 'system'
  actor_name?: string
  icon?: string
}

export interface Complaint {
  // complaint_id is required — used in .includes() and routing across pages
  id?: string
  complaint_id: string

  // People
  citizen_id?: string
  citizen_name?: string
  citizen_phone?: string
  officer_id?: string | null
  officer_name?: string | null
  officer_designation?: string

  // Content
  title: string
  description: string
  description_translated?: string
  category: string           // string — DB may have legacy values
  sub_category?: string
  department?: string

  // Status & priority — string for full flexibility (new + old statuses)
  status: string
  urgency?: string           // old shape
  priority?: string          // new shape alias
  ai_summary?: string
  ai_category_confidence?: number

  // Location
  location_address?: string
  location_lat?: number
  location_lng?: number
  ward_id?: number
  ward_name?: string

  // Media
  photos?: string[]
  photo_urls?: string[]      // old shape alias
  voice_audio_url?: string
  original_language?: string
  voice_transcript?: string | null

  // SLA
  sla_deadline?: string | null
  sla_remaining_seconds?: number | null

  // Resolution
  resolution_note?: string
  disputed?: boolean
  citizen_rating?: number

  // Timestamps
  created_at: string
  updated_at?: string
  resolved_at?: string

  // Timeline / history
  timeline?: ComplaintTimeline[]
  status_history?: ComplaintTimeline[]   // old shape alias
}

// ── SLA hours ─────────────────────────────────────────────────────────────────
export const SLA_HOURS: Record<string, [number, number, number, number]> = {
  pothole:       [24,  48,  96, 168],
  garbage:       [6,   12,  24,  48],
  sewage:        [6,   24,  48,  96],
  water_supply:  [6,   24,  72,  96],
  streetlight:   [24,  72, 120, 240],
  tree:          [24,  48, 120, 240],
  stray_animals: [12,  24,  72, 120],
  encroachment:  [48,  96, 168, 336],
  noise:         [12,  24,  72, 120],
  other:         [48,  96, 168, 336],
}

// ── Alert / Predictive types ──────────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertType =
  | 'surge' | 'sla_breach' | 'ward_neglect'
  | 'category_spike' | 'officer_overload' | 'inactivity'

export interface PredictiveAlert {
  alert_id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  ward_id?: number
  ward_name?: string
  metadata?: Record<string, unknown>
  is_resolved: boolean
  resolved_at?: string
  created_at: string
}

// ── Digest types ──────────────────────────────────────────────────────────────
export interface WeeklyDigest {
  digest_id: string
  digest_type: 'ward' | 'zone' | 'city'
  week_start: string
  week_end: string
  ward_id?: number
  ward_name?: string
  zone?: string
  total_complaints: number
  total_resolved: number
  resolved_complaints?: number
  total_breached: number
  resolution_rate?: number
  avg_resolution_hours?: number
  health_score_end?: number
  score_change?: number
  summary_en?: string
  top_categories: Array<{ category: string; count: number }>
  daily_breakdown?: Array<{ day: string; total: number; resolved: number }>
  worst_wards?: Array<{ ward_id: number; ward_name: string; zone: string; open_count: number; overdue_count: number; health_grade: string; health_score: number }>
  best_wards?: Array<{ ward_id: number; ward_name: string; zone: string; health_score: number; health_grade: string }>
  narrative_summary?: string
  generated_at: string
}

// ── Citizen / Officer entities ────────────────────────────────────────────────
export interface Citizen {
  citizen_id: string
  full_name: string
  phone_number: string
  email?: string
  ward_id: number
  ward_name?: string
  home_address?: string
  preferred_language: string
  profile_photo_url?: string
  total_complaints: number
  resolved_complaints: number
  created_at: string
}

export interface Officer {
  officer_id: string
  full_name: string
  employee_id: string
  phone_number: string
  designation: string
  department: string
  ward_id?: number
  ward_name?: string
  zone?: string
  preferred_language: string
  total_assigned: number
  total_resolved: number
  avg_resolution_hours?: number
  sla_compliance_rate?: number
  citizen_rating_avg?: number
  performance_score?: number
}

// ── API wrappers ──────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface SubmitComplaintRequest {
  title: string
  description: string
  category: string
  original_language?: string
  location_address: string
  location_lat: number
  location_lng: number
  photos?: string[]
  voice_transcript?: string | null
}

export interface SubmitComplaintResponse {
  complaint_id: string
  status: string
  message?: string
}