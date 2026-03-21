// ─────────────────────────────────────────────────────────────────────────────
// NagarMind — API Client
// src/lib/api.ts
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth token interceptor ────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const authData = localStorage.getItem('nagarmind-auth')
  if (authData) {
    try {
      const { state } = JSON.parse(authData)
      if (state.token) {
        config.headers.Authorization = `Bearer ${state.token}`
      }
    } catch (e) {
      console.error("Failed to parse auth token", e)
    }
  }
  return config
})

// ── 401 handler — redirect by role ───────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (err.config?.url?.includes('/login')) {
        return Promise.reject(err)
      }
      let role = 'citizen'
      const authData = localStorage.getItem('nagarmind-auth')
      if (authData) {
        try {
          const { state } = JSON.parse(authData)
          role = state.role || 'citizen'
        } catch (e) {}
      }
      localStorage.removeItem('nagarmind-auth')
      if (role === 'admin')        window.location.href = '/admin'
      else if (role === 'officer') window.location.href = '/officer/auth'
      else                         window.location.href = '/citizen/auth'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  loginCitizen:    (citizen_id: string, password: string) =>
    api.post('/api/auth/login/citizen', { citizen_id, password }),
  registerCitizen: (data: object) =>
    api.post('/api/auth/register/citizen', data),
  checkCitizen:    (phone: string) =>
    api.get('/api/auth/citizen/check', { params: { phone } }),
  getDemoCitizens: () =>
    api.get('/api/auth/citizen/demo'),

  // Legacy OTP stubs (kept for compatibility)
  sendOTP:   (phone: string, role: string, language = 'en') =>
    api.post('/api/auth/send-otp', { phone, role, language }),
  verifyOTP: (phone: string, otp: string, role: string) =>
    api.post('/api/auth/verify-otp', { phone, otp, role }),
  resendOTP: (phone: string, role: string, language: string) =>
    api.post('/api/auth/resend-otp', { phone, role, language }),

  registerOfficer: (data: object, tempToken?: string) =>
    api.post('/api/auth/register/officer', data,
      tempToken ? { headers: { Authorization: `Bearer ${tempToken}` } } : undefined
    ),
  officerLogin: (employee_id: string, password: string) =>
    api.post('/api/auth/officer/login', null, { params: { employee_id, password } }),
  adminLogin:   (employee_id: string, password: string) =>
    api.post('/api/auth/admin/login', { employee_id, password }),
  getMe:        () => api.get('/api/auth/me'),
}

// ── Wards ─────────────────────────────────────────────────────────────────────
export const wardsAPI = {
  list:      () => api.get('/api/wards/'),
  get:       (id: number) => api.get(`/api/wards/${id}`),
  healthAll: () => api.get('/api/wards/health/all'),
  getDigest: (id: string) => api.get(`/api/wards/digest/${id}`),
  getDigestHistory: (type: string, entityId?: string) =>
    api.get('/api/wards/digests/history', { params: { type, entity_id: entityId } }),
}

// ── Translation ───────────────────────────────────────────────────────────────
export const translateAPI = {
  batch:  (texts: string[], target_language: string, source_language = 'en-IN') =>
    api.post('/api/translate/batch', { texts, target_language, source_language }),
  single: (text: string, target_language: string, source_language = 'en-IN') =>
    api.post('/api/translate/single', { text, target_language, source_language }),
}

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadAPI = {
  /**
   * Upload a single photo. Returns { public_url } as a base64 data URI.
   */
  uploadPhoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/upload/photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /**
   * Upload audio blob AND get transcript back in one request.
   * Returns { transcript, public_url, language }
   */
  uploadAudioAndTranscribe: (blob: Blob, languageHint?: string) => {
    const form = new FormData()
    form.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
    if (languageHint) form.append('language_hint', languageHint)
    return api.post('/api/upload/audio', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Legacy — kept so old code doesn't break
  uploadAudio: (blob: Blob) => {
    console.warn('[uploadAPI] uploadAudio is deprecated. Use uploadAudioAndTranscribe instead.')
    const form = new FormData()
    form.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
    return api.post('/api/upload/audio', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  presign: (_filename: string, _content_type: string, _folder = 'complaints') => {
    console.warn('[uploadAPI] presign is disabled. Use uploadPhoto instead.')
    return Promise.reject(new Error('R2 presign disabled. Use uploadPhoto.'))
  },

  directUpload: (_url: string, _file: File) => {
    console.warn('[uploadAPI] directUpload is disabled. Use uploadPhoto instead.')
    return Promise.reject(new Error('R2 direct upload disabled. Use uploadPhoto.'))
  },
}

// ── Complaints ────────────────────────────────────────────────────────────────
export const complaintsAPI = {
  // ── Citizen ──────────────────────────────────────────────────────────────
  submit:  (data: object) => api.post('/api/complaints/', data),

  track: (id: string) =>
    api.get(`/api/complaints/${id}`).catch(() =>
      api.get(`/api/complaints/${id}/public`)
    ),

  getPublic: (id: string) => api.get(`/api/complaints/${id}/public`),

  mine:    (params?: object) => api.get('/api/complaints/my', { params }),
  rate:    (id: string, data: object) => api.post(`/api/complaints/${id}/rate`, data),
  dispute: (id: string, data: object) => api.post(`/api/complaints/${id}/dispute`, data),

  // ── Officer ───────────────────────────────────────────────────────────────
  updateStatus:  (id: string, data: object) => api.patch(`/api/complaints/${id}/status`, data),
  officerInbox:  (params?: object) => api.get('/api/complaints/officer/inbox', { params }),
  inbox:         (params?: object) => api.get('/api/complaints/officer/inbox', { params }),
  officerDetail: (id: string) => api.get(`/api/complaints/${id}`),

  assignComplaint: (id: string) => api.post(`/api/complaints/${id}/assign`),

  transcribeUrl: (_audio_url: string, _language_hint?: string) => {
    console.warn(
      '[complaintsAPI] transcribeUrl is deprecated. ' +
      'Use uploadAPI.uploadAudioAndTranscribe(blob, lang) instead.'
    )
    return Promise.resolve({ data: { transcript: '', language: _language_hint } })
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  myNotifications: () => api.get('/api/complaints/notifications/mine'),
  markAllRead:     () => api.post('/api/complaints/notifications/read-all'),
  markNotificationRead: (notificationId: string) =>
    api.patch(`/api/complaints/notifications/${notificationId}/read`),

  // ── Chat messages ─────────────────────────────────────────────────────────
  getMessages: (complaintId: string) =>
    api.get(`/api/complaints/${complaintId}/messages`),

  sendMessage: (complaintId: string, message: string) =>
    api.post(`/api/complaints/${complaintId}/messages`, { message }),

  unreadMessages: () =>
    api.get('/api/complaints/messages/unread-count'),
}

// ── Chatbot ───────────────────────────────────────────────────────────────────
export const chatbotAPI = {
  sendMessage: (data: {
    message: string
    thread_id: string
    language?: string
    latitude?: number
    longitude?: number
  }) => api.post('/api/chatbot/message', data),

  clearSession: (threadId: string) =>
    api.delete(`/api/chatbot/session/${threadId}`),
}

// ── Broadcast alerts (admin) ──────────────────────────────────────────────────
export const broadcastAPI = {
  send: (data: {
    title: string
    message: string
    severity: 'info' | 'warning' | 'critical'
    scope: 'ward' | 'zone' | 'city'
    ward_ids?: number[]
    zone_name?: string | null
  }) => api.post('/api/admin/broadcast/send', data),

  history:  () => api.get('/api/admin/broadcast/history'),
  wards:    () => api.get('/api/admin/broadcast/wards'),
  myAlerts: () => api.get('/api/admin/broadcast/mine'),
}

// ── Officer ───────────────────────────────────────────────────────────────────
export const officerAPI = {
  performance:    () => api.get('/api/officer/me/performance'),
  updateLocation: (lat: number, lng: number) =>
    api.patch('/api/officer/me/location', null, { params: { lat, lng } }),
  wardComplaints: () => api.get('/api/officer/ward/complaints'),
  leaderboard:    () => api.get('/api/officer/leaderboard'),
}

// ── Citizen ───────────────────────────────────────────────────────────────────
export const citizenAPI = {
  profile:    () => api.get('/api/citizen/profile'),
  update:     (data: object) => api.patch('/api/citizen/profile', data),
  stats:      () => api.get('/api/citizen/stats'),
  wardDigest: (wardId?: number) =>
    api.get('/api/citizen/ward-digest', wardId ? { params: { ward_id: wardId } } : undefined),
}

export const citizenProfileAPI = citizenAPI

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminAPI = {
  overview:          () => api.get('/api/admin/overview'),
  heatmap:           () => api.get('/api/admin/wards/heatmap'),
  wardDrilldown:     (id: number) => api.get(`/api/admin/wards/${id}`),

  alerts:            () => api.get('/api/admin/alerts'),
  resolveAlert:      (id: string) => api.post(`/api/admin/alerts/${id}/resolve`),
  scanAlerts:        () => api.post('/api/admin/alerts/scan'),

  officers:          () => api.get('/api/admin/officers'),

  digests:           () => api.get('/api/admin/digests'),
  digestById:        (id: string) => api.get(`/api/admin/digests/${id}`),
  getDigest:         (wardId: number, weekStart: string) =>
    api.get(`/api/admin/digests/${wardId}/${weekStart}`),
  triggerDigest:     () => api.post('/api/admin/digests/trigger'),

  recalculateHealth: () => api.post('/api/admin/health/recalculate'),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  trends:             (days: number) =>
    api.get('/api/analytics/city/trends', { params: { days } }),
  categoryBreakdown:  (days: number) =>
    api.get('/api/analytics/city/category-breakdown', { params: { days } }),
  zoneComparison:     () => api.get('/api/analytics/zones/comparison'),
  officerLeaderboard: (limit = 10) =>
    api.get('/api/analytics/officers/leaderboard-full', { params: { limit } }),
  worstWards:         (limit = 10) =>
    api.get('/api/analytics/wards/worst', { params: { limit } }),
  bestWards:          (limit = 10) =>
    api.get('/api/analytics/wards/best', { params: { limit } }),
  summaryCard:        () => api.get('/api/analytics/city/summary-card'),
  exportComplaints:   (days: number) =>
    api.get('/api/analytics/export/complaints-csv', {
      params: { days },
      responseType: 'blob',
    }),

  // Aliases
  cityTrends:   (days: number) =>
    api.get('/api/analytics/city/trends', { params: { days } }),
  officersFull: () =>
    api.get('/api/analytics/officers/leaderboard-full'),
}