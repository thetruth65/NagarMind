// ─────────────────────────────────────────────────────────────────────────────
// NagarMind — Types & Constants
// src/types/index.ts
// ─────────────────────────────────────────────────────────────────────────────

// ── Core entity interfaces ────────────────────────────────────────────────────

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

export type Role = 'citizen' | 'officer' | 'admin'

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

export interface Ward {
  ward_id: number
  ward_name: string
  zone: string
  health_score: number
  health_grade: string
  lat_center?: number
  lng_center?: number
}

export interface StatusHistory {
  new_status: string
  previous_status?: string
  note?: string
  changed_by?: string
  created_at: string
}

// ── Complaint — all fields used across all pages ──────────────────────────────
export interface Complaint {
  complaint_id: string
  title: string
  description: string
  description_translated?: string
  category: string
  sub_category?: string
  status: string
  urgency: string
  department?: string

  // People
  citizen_id: string
  citizen_name?: string
  citizen_phone?: string
  ward_id: number
  ward_name?: string
  officer_id?: string
  officer_name?: string
  officer_designation?: string

  // Location
  location_address?: string
  location_lat?: number
  location_lng?: number

  // Media
  photo_urls?: string[]
  voice_audio_url?: string
  original_language?: string

  // AI
  ai_summary?: string
  ai_category_confidence?: number

  // SLA
  sla_deadline?: string
  sla_remaining_seconds?: number

  // Resolution
  resolution_note?: string
  disputed?: boolean
  status_history?: StatusHistory[]

  // Timestamps
  created_at: string
  resolved_at?: string
  citizen_rating?: number
}

// ── Notification ──────────────────────────────────────────────────────────────
export interface Notification {
  notification_id: string
  user_id: string
  user_role: string
  title: string
  body: string
  message?: string
  type: string
  is_read: boolean
  complaint_id?: string
  created_at: string
}

// ── Auth state ────────────────────────────────────────────────────────────────
export interface AuthState {
  token: string | null
  role: 'citizen' | 'officer' | 'admin' | null
  userId: string | null
  fullName: string | null
  wardId?: number | null
  preferredLanguage: string
  isLoading: boolean
  citizen: Citizen | null
  officer: Officer | null
}

export interface OTPState {
  phone: string
  role: 'citizen' | 'officer'
  step: 'phone' | 'otp' | 'register'
  countdown: number
  isLoading: boolean
  error: string | null
  tempToken?: string
}

// ── Languages ─────────────────────────────────────────────────────────────────
export type Language = {
  code: string
  name: string
  nativeName: string
  sarvam?: string
  script: 'latin' | 'devanagari' | 'bengali' | 'tamil' | 'telugu' | 'gujarati' | 'kannada' | 'malayalam' | 'gurmukhi' | 'odia',
  sttSupported?: boolean
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English',   nativeName: 'English',  sarvam: 'en-IN', script: 'latin'      },
  { code: 'hi', name: 'Hindi',     nativeName: 'हिन्दी',   sarvam: 'hi-IN', script: 'devanagari' },
  { code: 'bn', name: 'Bengali',   nativeName: 'বাংলা',    sarvam: 'bn-IN', script: 'bengali'    },
  { code: 'ta', name: 'Tamil',     nativeName: 'தமிழ்',    sarvam: 'ta-IN', script: 'tamil'      },
  { code: 'te', name: 'Telugu',    nativeName: 'తెలుగు',   sarvam: 'te-IN', script: 'telugu'     },
  { code: 'mr', name: 'Marathi',   nativeName: 'मराठी',    sarvam: 'mr-IN', script: 'devanagari' },
  { code: 'gu', name: 'Gujarati',  nativeName: 'ગુજરાતી',  sarvam: 'gu-IN', script: 'gujarati'   },
  { code: 'kn', name: 'Kannada',   nativeName: 'ಕನ್ನಡ',    sarvam: 'kn-IN', script: 'kannada'    },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം',   sarvam: 'ml-IN', script: 'malayalam'  },
  { code: 'pa', name: 'Punjabi',   nativeName: 'ਪੰਜਾਬੀ',   sarvam: 'pa-IN', script: 'gurmukhi'   },
  { code: 'or', name: 'Odia',      nativeName: 'ଓଡ଼ିଆ',    sarvam: 'od-IN', script: 'odia'       },
]

// ── Category config ───────────────────────────────────────────────────────────
export type CategoryConfig = {
  label: string
  icon: string
  color: string   // Tailwind bg class
  dept: string
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  // ── PRIMARY KEYS — exactly what complaint_pipeline.py writes to DB ──────────
  // These must match SLA_TABLE keys in complaint_pipeline.py:
  //   pothole, garbage, sewage, water_supply, streetlight,
  //   tree, stray_animals, encroachment, noise, other
  pothole:       { label: 'Pothole',           icon: '🕳️', color: 'bg-orange-100',  dept: 'Roads & Drainage'           },
  garbage:       { label: 'Garbage',           icon: '🗑️', color: 'bg-green-100',   dept: 'Public Health & Sanitation' },
  sewage:        { label: 'Sewage',            icon: '💧', color: 'bg-blue-100',    dept: 'Public Health & Sanitation' },
  water_supply:  { label: 'Water Supply',      icon: '🚰', color: 'bg-cyan-100',    dept: 'Water Supply'               }, // ← WAS MISSING (was 'water')
  streetlight:   { label: 'Street Light',      icon: '💡', color: 'bg-yellow-100',  dept: 'Roads & Drainage'           },
  tree:          { label: 'Tree / Vegetation', icon: '🌳', color: 'bg-emerald-100', dept: 'Horticulture'               },
  stray_animals: { label: 'Stray Animals',     icon: '🐕', color: 'bg-amber-100',   dept: 'Health Services'            },
  encroachment:  { label: 'Encroachment',      icon: '🚧', color: 'bg-red-100',     dept: 'Planning & Development'     },
  noise:         { label: 'Noise Pollution',   icon: '🔊', color: 'bg-purple-100',  dept: 'Public Health & Sanitation' },
  other:         { label: 'Other',             icon: '📋', color: 'bg-gray-100',    dept: 'Administration'             },

  // ── LEGACY / ALIAS KEYS — old category values still in DB or used elsewhere ─
  // Kept so complaints seeded with old categories still display correctly
  water:         { label: 'Water Supply',      icon: '🚰', color: 'bg-cyan-100',    dept: 'Water Supply'               },
  pollution:     { label: 'Pollution',         icon: '🌫️', color: 'bg-slate-100',   dept: 'Public Health & Sanitation' },
  road_damage:   { label: 'Road Damage',       icon: '🛣️', color: 'bg-stone-100',   dept: 'Roads & Drainage'           },
  building:      { label: 'Building / Safety', icon: '🏗️', color: 'bg-rose-100',    dept: 'Building & Petrol'          },
  // Old setup script categories — map to nearest equivalent
  roads_and_footpaths:    { label: 'Roads',         icon: '🛣️', color: 'bg-stone-100',   dept: 'Roads & Drainage'           },
  sanitation_and_garbage: { label: 'Sanitation',    icon: '🗑️', color: 'bg-green-100',   dept: 'Public Health & Sanitation' },
  drainage_and_flooding:  { label: 'Drainage',      icon: '💧', color: 'bg-blue-100',    dept: 'Public Health & Sanitation' },
  street_lighting:        { label: 'Street Light',  icon: '💡', color: 'bg-yellow-100',  dept: 'Roads & Drainage'           },
  parks_and_gardens:      { label: 'Parks',         icon: '🌳', color: 'bg-emerald-100', dept: 'Horticulture'               },
  illegal_construction:   { label: 'Encroachment',  icon: '🚧', color: 'bg-red-100',     dept: 'Planning & Development'     },
  noise_and_pollution:    { label: 'Noise',         icon: '🔊', color: 'bg-purple-100',  dept: 'Public Health & Sanitation' },
}

// ── Status config ─────────────────────────────────────────────────────────────
export type StatusConfig = {
  label: string
  icon: string
  color: string   // Tailwind text class
  bg: string      // Tailwind bg class
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  submitted:     { label: 'Submitted',    icon: '📝', color: 'text-slate-700',  bg: 'bg-slate-100'  },
  pending:       { label: 'Pending',      icon: '⏳', color: 'text-amber-700',  bg: 'bg-amber-50'   },
  ai_classified: { label: 'AI Processed', icon: '🤖', color: 'text-purple-700', bg: 'bg-purple-50'  },
  assigned:      { label: 'Assigned',     icon: '👷', color: 'text-blue-700',   bg: 'bg-blue-50'    },
  acknowledged:  { label: 'Acknowledged', icon: '👀', color: 'text-indigo-700', bg: 'bg-indigo-50'  },
  in_progress:   { label: 'In Progress',  icon: '🔧', color: 'text-orange-700', bg: 'bg-orange-50'  },
  resolved:      { label: 'Resolved',     icon: '✅', color: 'text-green-700',  bg: 'bg-green-50'   },
  closed:        { label: 'Closed',       icon: '🔒', color: 'text-slate-600',  bg: 'bg-slate-100'  },
  disputed:      { label: 'Disputed',     icon: '⚠️', color: 'text-red-700',    bg: 'bg-red-50'     },
  escalated:     { label: 'Escalated',    icon: '🚨', color: 'text-rose-700',   bg: 'bg-rose-50'    },
  reopened:      { label: 'Reopened',     icon: '🔄', color: 'text-orange-700', bg: 'bg-orange-50'  },
}

// ── Urgency config ────────────────────────────────────────────────────────────
export type UrgencyConfig = {
  label: string
  icon: string
  color: string    // Tailwind text class
  bg: string       // Tailwind bg class
  border: string   // Tailwind border-color class
  priority: number // 1 = highest
}

export const URGENCY_CONFIG: Record<string, UrgencyConfig> = {
  critical: { label: 'Critical', icon: '🚨', color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-500',    priority: 1 },
  high:     { label: 'High',     icon: '🔴', color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-500', priority: 2 },
  medium:   { label: 'Medium',   icon: '🟡', color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-400',  priority: 3 },
  low:      { label: 'Low',      icon: '🟢', color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-400',  priority: 4 },
}

// ── MCD org structure ─────────────────────────────────────────────────────────

export const MCD_DESIGNATIONS = [
  'Commissioner',
  'Additional Commissioner',
  'Joint Commissioner',
  'Deputy Commissioner',
  'Assistant Commissioner',
  'Executive Engineer',
  'Assistant Engineer',
  'Junior Engineer',
  'Sanitary Inspector',
  'Health Inspector',
  'Senior Engineer',
  'Supervisor',
  'Sanitation Worker',
  'Beat Officer',
  'Driver',
  'Other',
] as const

export type MCDDesignation = typeof MCD_DESIGNATIONS[number]

export const MCD_DEPARTMENTS = [
  'Public Health & Sanitation',
  'Water Supply',
  'Roads & Drainage',
  'Planning & Development',
  'Finance & Accounts',
  'Administration',
  'Personnel',
  'Legal',
  'Vigilance',
  'Horticulture',
  'Parks & Gardens',
  'Building & Petrol',
  'Waste Management',
  'Health Services',
  'Other',
] as const

export type MCDDepartment = typeof MCD_DEPARTMENTS[number]

export const MCD_ZONES = [
  'Central',
  'South',
  'North',
  'East',
  'West',
  'New Delhi',
  'Shahdara',
] as const

export type MCDZone = typeof MCD_ZONES[number]

// ── SLA hours ─────────────────────────────────────────────────────────────────
// Keys match CATEGORY_CONFIG primary keys
export const SLA_HOURS: Record<string, [number, number, number, number]> = {
  pothole:       [24,  48,  96, 168],
  garbage:       [6,   12,  24,  48],
  sewage:        [6,   24,  48,  96],
  water_supply:  [6,   24,  72,  96], // ← was 'water'
  water:         [6,   24,  72,  96], // legacy alias
  streetlight:   [24,  72, 120, 240],
  tree:          [24,  48, 120, 240],
  stray_animals: [12,  24,  72, 120],
  encroachment:  [48,  96, 168, 336],
  noise:         [12,  24,  72, 120],
  pollution:     [24,  48,  96, 168],
  road_damage:   [24,  72, 120, 240],
  building:      [12,  24,  72, 120],
  other:         [48,  96, 168, 336],
}

// ── Alert types ───────────────────────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertType =
  | 'surge'
  | 'sla_breach'
  | 'ward_neglect'
  | 'category_spike'
  | 'officer_overload'
  | 'inactivity'

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