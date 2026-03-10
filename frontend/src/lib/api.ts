// // ─────────────────────────────────────────────────────────────────────────────
// // NagarMind — API Client
// // src/lib/api.ts
// // ─────────────────────────────────────────────────────────────────────────────

// import axios from 'axios'

// const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// export const api = axios.create({
//   baseURL: BASE_URL,
//   headers: { 'Content-Type': 'application/json' },
// })

// // ── Auth token interceptor ────────────────────────────────────────────────────
// api.interceptors.request.use((config) => {
//   // Read token from Zustand's persisted storage
//   const authData = localStorage.getItem('nagarmind-auth')
//   if (authData) {
//     try {
//       const { state } = JSON.parse(authData)
//       if (state.token) {
//         config.headers.Authorization = `Bearer ${state.token}`
//       }
//     } catch (e) {
//       console.error("Failed to parse auth token", e)
//     }
//   }
//   return config
// })

// // ── 401 handler — redirect by role ───────────────────────────────────────────
// api.interceptors.response.use(
//   (res) => res,
//   (err) => {
//     if (err.response?.status === 401) {
//       // ✅ FIX: Do NOT redirect if the user is actively trying to log in!
//       if (err.config?.url?.includes('/login')) {
//         return Promise.reject(err)
//       }

//       let role = 'citizen'
//       const authData = localStorage.getItem('nagarmind-auth')
//       if (authData) {
//         try {
//           const { state } = JSON.parse(authData)
//           role = state.role || 'citizen'
//         } catch (e) {}
//       }
      
//       localStorage.removeItem('nagarmind-auth')
      
//       if (role === 'admin')        window.location.href = '/admin'
//       else if (role === 'officer') window.location.href = '/officer/auth'
//       else                         window.location.href = '/citizen/auth'
//     }
//     return Promise.reject(err)
//   }
// )

// // ── Auth ──────────────────────────────────────────────────────────────────────
// export const authAPI = {
//   // Citizen auth
//   loginCitizen:     (citizen_id: string, password: string) =>
//     api.post('/api/auth/login/citizen', { citizen_id, password }),
//   registerCitizen:  (data: object) =>
//     api.post('/api/auth/register/citizen', data),
//   checkCitizen:     (phone: string) =>
//     api.get('/api/auth/citizen/check', { params: { phone } }),
//   getDemoCitizens:  () =>
//     api.get('/api/auth/citizen/demo'),

//   // Legacy OTP methods (kept for officer/admin if needed)
//   sendOTP:         (phone: string, role: string, language = 'en') =>
//     api.post('/api/auth/send-otp', { phone, role, language }),
//   verifyOTP:       (phone: string, otp: string, role: string) =>
//     api.post('/api/auth/verify-otp', { phone, otp, role }),
//   resendOTP:       (phone: string, role: string, language: string) =>
//     api.post('/api/auth/resend-otp', { phone, role, language }),

//   // Officer/Admin
//   registerOfficer: (data: object, tempToken?: string) =>
//     api.post('/api/auth/register/officer', data,
//       tempToken ? { headers: { Authorization: `Bearer ${tempToken}` } } : undefined
//     ),
//   officerLogin:    (employee_id: string, password: string) =>
//     api.post('/api/auth/officer/login', null, { params: { employee_id, password } }),
//   adminLogin:      (employee_id: string, password: string) =>
//     api.post('/api/auth/admin/login', { employee_id, password }),
//   getMe:           () => api.get('/api/auth/me'),
// }

// // ── Wards ─────────────────────────────────────────────────────────────────────
// export const wardsAPI = {
//   list:      () => api.get('/api/wards/'),
//   get:       (id: number) => api.get(`/api/wards/${id}`),
//   healthAll: () => api.get('/api/wards/health/all'),
//   getDigest: (id: string) => api.get(`/api/wards/digest/${id}`),
//   getDigestHistory: (type: string, entityId?: string) => 
//     api.get('/api/wards/digests/history', { params: { type, entity_id: entityId } }),
// }

// // ── Translation ───────────────────────────────────────────────────────────────
// export const translateAPI = {
//   batch:  (texts: string[], target_language: string, source_language = 'en-IN') =>
//     api.post('/api/translate/batch', { texts, target_language, source_language }),
//   single: (text: string, target_language: string, source_language = 'en-IN') =>
//     api.post('/api/translate/single', { text, target_language, source_language }),
// }

// // ── Upload ────────────────────────────────────────────────────────────────────
// export const uploadAPI = {
//   presign: (filename: string, content_type: string, folder = 'complaints') =>
//     api.post('/api/upload/presign', { filename, content_type, folder }),

//   directUpload: (uploadUrl: string, file: File) =>
//     axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type } }),

//   // ✅ Routes audio through FastAPI backend to avoid R2 CORS issues on browser PUT
//   uploadAudio: (blob: Blob) => {
//     const form = new FormData()
//     form.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
//     return api.post('/api/upload/audio', form, {
//       headers: { 'Content-Type': 'multipart/form-data' },
//     })
//   },
// }

// // ── Complaints ────────────────────────────────────────────────────────────────
// export const complaintsAPI = {
//   // Citizen
//   submit:          (data: object)         => api.post('/api/complaints/', data),
//   track:           (id: string)           => api.get(`/api/complaints/track/${id}`),
//   mine:            (params?: object)      => api.get('/api/complaints/my', { params }),
//   rate:            (id: string, data: object) => api.post(`/api/complaints/${id}/rate`, data),
//   dispute:         (id: string, data: object) => api.post(`/api/complaints/${id}/dispute`, data),

//   // Officer
//   updateStatus:    (id: string, data: object) => api.patch(`/api/complaints/${id}/status`, data),
//   officerInbox:    (params?: object)      => api.get('/api/complaints/officer/inbox', { params }),
//   inbox:           (params?: object)      => api.get('/api/complaints/officer/inbox', { params }),
//   officerDetail:   (id: string)           => api.get(`/api/complaints/officer/${id}`),

//   // Voice
//   transcribeUrl:   (audio_url: string, language_hint?: string) =>
//     api.post('/api/complaints/transcribe-url', null, { params: { audio_url, language_hint } }),

//   // Notifications
//   myNotifications: () => api.get('/api/complaints/notifications/mine'),
//   markAllRead:     () => api.post('/api/complaints/notifications/read-all'),

//   // Convenience: presign + upload
//   customUpload: (filename: string, content_type: string, blob: Blob) =>
//     uploadAPI
//       .presign(filename, content_type, 'complaints')
//       .then(res =>
//         uploadAPI
//           .directUpload(res.data.upload_url, new File([blob], filename, { type: content_type }))
//           .then(() => res)
//       ),
// }

// // ── Officer ───────────────────────────────────────────────────────────────────
// export const officerAPI = {
//   performance:    () => api.get('/api/officer/me/performance'),
//   updateLocation: (lat: number, lng: number) =>
//     api.patch('/api/officer/me/location', null, { params: { lat, lng } }),
//   wardComplaints: () => api.get('/api/officer/ward/complaints'),
//   leaderboard:    () => api.get('/api/officer/leaderboard'),
// }

// // ── Citizen ───────────────────────────────────────────────────────────────────
// export const citizenAPI = {
//   profile:    () => api.get('/api/citizen/profile'),
//   update:     (data: object) => api.patch('/api/citizen/profile', data),
//   stats:      () => api.get('/api/citizen/stats'),
//   wardDigest: (wardId?: number) =>
//     api.get('/api/citizen/ward-digest', wardId ? { params: { ward_id: wardId } } : undefined),
// }

// // alias so old imports of citizenProfileAPI still compile
// export const citizenProfileAPI = citizenAPI

// // ── Admin ─────────────────────────────────────────────────────────────────────
// export const adminAPI = {
//   overview:          () => api.get('/api/admin/overview'),
//   heatmap:           () => api.get('/api/admin/wards/heatmap'),
//   wardDrilldown:     (id: number) => api.get(`/api/admin/wards/${id}`),

//   alerts:            () => api.get('/api/admin/alerts'),
//   resolveAlert:      (id: string) => api.post(`/api/admin/alerts/${id}/resolve`),
//   scanAlerts:        () => api.post('/api/admin/alerts/scan'),

//   officers:          () => api.get('/api/admin/officers'),

//   digests:           () => api.get('/api/admin/digests'),
//   digestById:        (id: string) => api.get(`/api/admin/digests/${id}`),
//   getDigest:         (wardId: number, weekStart: string) =>
//     api.get(`/api/admin/digests/${wardId}/${weekStart}`),
//   triggerDigest:     () => api.post('/api/admin/digests/trigger'),

//   recalculateHealth: () => api.post('/api/admin/health/recalculate'),
// }

// // ── Analytics ─────────────────────────────────────────────────────────────────
// export const analyticsAPI = {
//   // Primary method names
//   trends:             (days: number) =>
//     api.get('/api/analytics/city/trends', { params: { days } }),
//   categoryBreakdown:  (days: number) =>
//     api.get('/api/analytics/city/category-breakdown', { params: { days } }),
//   zoneComparison:     () => api.get('/api/analytics/zones/comparison'),
//   officerLeaderboard: (limit = 10) =>
//     api.get('/api/analytics/officers/leaderboard-full', { params: { limit } }),
//   worstWards:         (limit = 10) =>
//     api.get('/api/analytics/wards/worst', { params: { limit } }),
//   bestWards:          (limit = 10) =>
//     api.get('/api/analytics/wards/best', { params: { limit } }),
//   summaryCard:        () => api.get('/api/analytics/city/summary-card'),
//   exportComplaints:   (days: number) =>
//     api.get('/api/analytics/export/complaints-csv', {
//       params: { days },
//       responseType: 'blob',
//     }),

//   // Aliases used in AdminDashboardPage & AdminAnalyticsPage
//   cityTrends:        (days: number) =>
//     api.get('/api/analytics/city/trends', { params: { days } }),
//   officersFull:      () =>
//     api.get('/api/analytics/officers/leaderboard-full'),
// }


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
   * Use the returned public_url directly as <img src={...} />
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
   * No R2, no second hop needed.
   */
  uploadAudioAndTranscribe: (blob: Blob, languageHint?: string) => {
    const form = new FormData()
    form.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
    if (languageHint) form.append('language_hint', languageHint)
    return api.post('/api/upload/audio', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Legacy — kept so old code doesn't break but logs a warning
  uploadAudio: (blob: Blob) => {
    console.warn('[uploadAPI] uploadAudio is deprecated. Use uploadAudioAndTranscribe instead.')
    const form = new FormData()
    form.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
    return api.post('/api/upload/audio', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Legacy presign stub — returns error, kept to avoid crash
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
  // Citizen
  submit:  (data: object) => api.post('/api/complaints/', data),

  // TrackComplaintPage uses complaintsAPI.track(id)
  // Backend has GET /{complaint_id}/public (no auth) and GET /{complaint_id} (auth)
  // We try authenticated first, fall back to public
  track: (id: string) =>
    api.get(`/api/complaints/${id}`).catch(() =>
      api.get(`/api/complaints/${id}/public`)
    ),

  mine:    (params?: object) => api.get('/api/complaints/my', { params }),
  rate:    (id: string, data: object) => api.post(`/api/complaints/${id}/rate`, data),
  dispute: (id: string, data: object) => api.post(`/api/complaints/${id}/dispute`, data),

  // Officer
  updateStatus:  (id: string, data: object) => api.patch(`/api/complaints/${id}/status`, data),
  officerInbox:  (params?: object) => api.get('/api/complaints/officer/inbox', { params }),
  inbox:         (params?: object) => api.get('/api/complaints/officer/inbox', { params }),
  officerDetail: (id: string) => api.get(`/api/complaints/${id}`),

  /**
   * transcribeUrl — LEGACY. Now a no-op stub.
   *
   * The old flow was:
   *   1. upload audio to R2 → get URL
   *   2. POST /transcribe-url?audio_url=<huge base64 string>  ← THIS BROKE
   *
   * New flow: use uploadAPI.uploadAudioAndTranscribe(blob, lang)
   * which does everything in one request.
   *
   * This stub is kept so old call sites don't crash immediately —
   * they'll get an empty transcript and a console warning.
   */
  transcribeUrl: (_audio_url: string, _language_hint?: string) => {
    console.warn(
      '[complaintsAPI] transcribeUrl is deprecated and disabled.\n' +
      'Use uploadAPI.uploadAudioAndTranscribe(blob, lang) instead.\n' +
      'It returns { transcript, public_url } in one request.'
    )
    return Promise.resolve({ data: { transcript: '', language: _language_hint } })
  },

  // Notifications
  myNotifications: () => api.get('/api/complaints/notifications/mine'),
  markAllRead:     () => api.post('/api/complaints/notifications/read-all'),
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