import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

// ✅ FIX: Lazy load all pages for MASSIVE speed boost
const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })))
const CitizenAuthPage = lazy(() => import('@/pages/citizen/CitizenAuthPage').then(m => ({ default: m.CitizenAuthPage })))
const CitizenDashboardPage = lazy(() => import('@/pages/citizen/CitizenDashboardPage').then(m => ({ default: m.CitizenDashboardPage })))
const SubmitComplaintPage = lazy(() => import('@/pages/citizen/SubmitComplaintPage').then(m => ({ default: m.SubmitComplaintPage })))
const CitizenComplaintsPage = lazy(() => import('@/pages/citizen/CitizenComplaintsPage').then(m => ({ default: m.CitizenComplaintsPage })))
const TrackComplaintPage = lazy(() => import('@/pages/citizen/TrackComplaintPage').then(m => ({ default: m.TrackComplaintPage })))
const CitizenProfilePage = lazy(() => import('@/pages/citizen/CitizenProfilePage').then(m => ({ default: m.CitizenProfilePage })))

const OfficerAuthPage = lazy(() => import('@/pages/officer/OfficerAuthPage').then(m => ({ default: m.OfficerAuthPage })))
const OfficerDashboardPage = lazy(() => import('@/pages/officer/OfficerDashboardPage').then(m => ({ default: m.OfficerDashboardPage })))
const OfficerInboxPage = lazy(() => import('@/pages/officer/OfficerInboxPage').then(m => ({ default: m.OfficerInboxPage })))
const OfficerComplaintDetailPage = lazy(() => import('@/pages/officer/OfficerComplaintDetailPage').then(m => ({ default: m.OfficerComplaintDetailPage })))
const OfficerProfilePage = lazy(() => import('@/pages/officer/OfficerProfilePage').then(m => ({ default: m.OfficerProfilePage })))

const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))
const AdminHeatmapPage = lazy(() => import('@/pages/admin/AdminHeatmapPage').then(m => ({ default: m.AdminHeatmapPage })))
const AdminAnalyticsPage = lazy(() => import('@/pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })))
const AdminAlertsPage = lazy(() => import('@/pages/admin/AdminAlertsPage').then(m => ({ default: m.AdminAlertsPage })))
const AdminOfficersPage = lazy(() => import('@/pages/admin/AdminOfficersPage').then(m => ({ default: m.AdminOfficersPage })))
const AdminOfficerDetailPage = lazy(() => import('@/pages/admin/AdminOfficerDetailPage').then(m => ({ default: m.AdminOfficerDetailPage })))
const AdminDigestsPage = lazy(() => import('@/pages/admin/AdminDigestsPage').then(m => ({ default: m.AdminDigestsPage })))
const AdminProfilePage = lazy(() => import('@/pages/admin/AdminProfilePage').then(m => ({ default: m.AdminProfilePage })))

// ✅ NEW: Universal Digest Pages
const DigestSelectionPage = lazy(() => import('@/pages/shared/DigestSelectionPage').then(m => ({ default: m.DigestSelectionPage })))
const WeeklyDigestPage = lazy(() => import('@/pages/shared/WeeklyDigestPage').then(m => ({ default: m.WeeklyDigestPage })))

// Guards
function CitizenGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuthStore()
  if (!isAuthenticated || role !== 'citizen') return <Navigate to="/citizen/auth" replace />
  return <>{children}</>
}
function OfficerGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuthStore()
  if (!isAuthenticated || (role !== 'officer' && role !== 'admin')) return <Navigate to="/officer/auth" replace />
  return <>{children}</>
}
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuthStore()
  if (!isAuthenticated || role !== 'admin') return <Navigate to="/admin" replace />
  return <>{children}</>
}

// Global Loading State
const PageLoader = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <Loader2 size={32} className="animate-spin text-primary-500" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/track/:complaint_id" element={<TrackComplaintPage />} />
        
        {/* Shared Weekly Digest Views */}
        <Route path="/digest" element={<WeeklyDigestPage />} />
        <Route path="/digest/:digestId" element={<WeeklyDigestPage />} />

        {/* Citizen */}
        <Route path="/citizen/auth" element={<CitizenAuthPage />} />
        <Route path="/citizen/dashboard" element={<CitizenGuard><CitizenDashboardPage /></CitizenGuard>} />
        <Route path="/citizen/submit" element={<CitizenGuard><SubmitComplaintPage /></CitizenGuard>} />
        <Route path="/citizen/complaints" element={<CitizenGuard><CitizenComplaintsPage /></CitizenGuard>} />
        <Route path="/citizen/track/:id" element={<CitizenGuard><TrackComplaintPage /></CitizenGuard>} />
        <Route path="/citizen/profile" element={<CitizenGuard><CitizenProfilePage /></CitizenGuard>} />
        <Route path="/citizen/digest" element={<CitizenGuard><DigestSelectionPage /></CitizenGuard>} />

        {/* Officer */}
        <Route path="/officer/auth" element={<OfficerAuthPage />} />
        <Route path="/officer/dashboard" element={<OfficerGuard><OfficerDashboardPage /></OfficerGuard>} />
        <Route path="/officer/inbox" element={<OfficerGuard><OfficerInboxPage /></OfficerGuard>} />
        <Route path="/officer/complaint/:id" element={<OfficerGuard><OfficerComplaintDetailPage /></OfficerGuard>} />
        <Route path="/officer/profile" element={<OfficerGuard><OfficerProfilePage /></OfficerGuard>} />
        <Route path="/officer/digest" element={<OfficerGuard><DigestSelectionPage /></OfficerGuard>} />

        {/* Admin */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
        <Route path="/admin/heatmap" element={<AdminGuard><AdminHeatmapPage /></AdminGuard>} />
        <Route path="/admin/analytics" element={<AdminGuard><AdminAnalyticsPage /></AdminGuard>} />
        <Route path="/admin/alerts" element={<AdminGuard><AdminAlertsPage /></AdminGuard>} />
        <Route path="/admin/officers" element={<AdminGuard><AdminOfficersPage /></AdminGuard>} />
        <Route path="/admin/officers/:id" element={<AdminGuard><AdminOfficerDetailPage /></AdminGuard>} />
        <Route path="/admin/digests" element={<AdminGuard><AdminDigestsPage /></AdminGuard>} />
        <Route path="/admin/profile" element={<AdminGuard><AdminProfilePage /></AdminGuard>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}