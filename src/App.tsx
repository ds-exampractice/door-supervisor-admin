import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import LoginPage from './auth/LoginPage'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import PromoCodesPage from './pages/PromoCodesPage'
import QuestionsPage from './pages/QuestionsPage'
import UsersPage from './pages/UsersPage'
import AppSettingsPage from './pages/AppSettingsPage'

function ProtectedLayout() {
  const { user, isAdmin, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
      </div>
    )
  }

  if (!user || !isAdmin) return <Navigate to="/login" replace />

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-main">
        {/* Mobile top bar */}
        <header className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)', padding: 6, borderRadius: 6,
              display: 'flex',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="nav-logo-name">DS Exam Admin</span>
        </header>

        <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
          <Routes>
            <Route path="/dashboard"   element={<DashboardPage />} />
            <Route path="/promo-codes" element={<PromoCodesPage />} />
            <Route path="/questions"   element={<QuestionsPage />} />
            <Route path="/users"       element={<UsersPage />} />
            <Route path="/settings"    element={<AppSettingsPage />} />
            <Route path="*"            element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user && isAdmin ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/*"     element={<ProtectedLayout />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}
