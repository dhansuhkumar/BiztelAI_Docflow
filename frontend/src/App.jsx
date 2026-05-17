import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import UploadPage from './pages/UploadPage'
import DocumentsPage from './pages/DocumentsPage'
import ReviewPage from './pages/ReviewPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2f42',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            fontSize: '14px',
          },
        }}
      />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <nav style={{
          background: 'linear-gradient(135deg, #0d1f2d 0%, #0f2233 100%)',
          borderBottom: '1px solid rgba(20,184,166,0.2)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '60px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(12px)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '24px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', boxShadow: '0 2px 12px rgba(20,184,166,0.3)'
            }}>⚙️</div>
            <span style={{ fontWeight: 700, fontSize: '18px', color: 'white', letterSpacing: '-0.3px' }}>
              DocFlow
            </span>
          </div>

          {[
            { to: '/', label: '📤 Upload', end: true },
            { to: '/documents', label: '📋 Documents', end: false },
            { to: '/dashboard', label: '📊 Dashboard', end: true },
          ].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                fontSize: '14px',
                fontWeight: 500,
                padding: '7px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
              })}
            >
              {label}
            </NavLink>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              padding: '4px 12px',
              background: 'rgba(20,184,166,0.15)',
              border: '1px solid rgba(20,184,166,0.3)',
              borderRadius: '20px',
              fontSize: '12px',
              color: '#4ade80',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              AI Powered
            </div>
          </div>
        </nav>

        <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id/review" element={<ReviewPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
