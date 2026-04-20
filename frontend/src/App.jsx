// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Connections from './pages/Connections'
import CustomApi from './pages/CustomApi'

function Shell({ children }) {
  const { user, logout } = useAuth()
  return (
    <div style={s.shell}>
      <div style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoDot} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.2px', lineHeight: 1.2 }}>
              Clean<span style={{ color: '#7F77DD' }}>'</span>Sync
            </div>
            <div style={{ fontSize: 9, color: '#bbb', letterSpacing: '0.03em', marginTop: 1 }}>Nex-a Tech Solutions</div>
          </div>
        </div>

        <div style={s.navSection}>Connect</div>
        <NavLink to="/connections" style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navActive : {}) })}>
          Platforms
        </NavLink>
        <NavLink to="/custom-api" style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navActive : {}) })}>
          Custom API
        </NavLink>

        <div style={s.navSection}>Clean</div>
        <NavLink to="/scan" style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navActive : {}) })}>
          Data scan
        </NavLink>
        <NavLink to="/rules" style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navActive : {}) })}>
          Dedup rules
        </NavLink>

        <div style={s.navSection}>Sync</div>
        <NavLink to="/mapping" style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navActive : {}) })}>
          Field mapping
        </NavLink>
        <NavLink to="/sync" style={({ isActive }) => ({ ...s.navItem, ...(isActive ? s.navActive : {}) })}>
          Run sync
        </NavLink>

        <div style={{ flex: 1 }} />
        <div style={s.userBar}>
          <div style={s.userEmail}>{user?.email}</div>
          <button style={s.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </div>

      <div style={s.main}>{children}</div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, color: '#999', fontFamily: 'system-ui' }}>Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<Verify />} />
          <Route path="/" element={<Navigate to="/connections" replace />} />
          <Route path="/connections" element={<PrivateRoute><Connections /></PrivateRoute>} />
          <Route path="/custom-api" element={<PrivateRoute><CustomApi /></PrivateRoute>} />
          <Route path="/scan" element={<PrivateRoute><PlaceholderPage title="Data scan" /></PrivateRoute>} />
          <Route path="/rules" element={<PrivateRoute><PlaceholderPage title="Dedup rules" /></PrivateRoute>} />
          <Route path="/mapping" element={<PrivateRoute><PlaceholderPage title="Field mapping" /></PrivateRoute>} />
          <Route path="/sync" element={<PrivateRoute><PlaceholderPage title="Run sync" /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div style={{ padding: '28px 24px', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>{title}</h1>
      <p style={{ color: '#888', fontSize: 14 }}>This page hooks into <code>/api/sync</code> and <code>/api/connectors</code> — wire up the components from the previous prototype here.</p>
    </div>
  )
}

const s = {
  shell: { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: 192, borderRight: '1px solid #ede9f7', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, background: '#faf9ff' },
  logo: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', marginBottom: 10 },
  logoDot: { width: 24, height: 24, borderRadius: 6, background: '#534AB7' },
  navSection: { fontSize: 10, fontWeight: 500, color: '#bbb', letterSpacing: '.06em', textTransform: 'uppercase', padding: '10px 10px 4px' },
  navItem: { display: 'block', padding: '7px 10px', borderRadius: 8, fontSize: 12, color: '#777', textDecoration: 'none', transition: 'background .1s' },
  navActive: { background: '#EEEDFE', color: '#3C3489', fontWeight: 500 },
  userBar: { borderTop: '1px solid #ede9f7', paddingTop: 12, marginTop: 8 },
  userEmail: { fontSize: 11, color: '#aaa', marginBottom: 6, padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: { background: 'none', border: 'none', fontSize: 12, color: '#888', cursor: 'pointer', padding: '4px', width: '100%', textAlign: 'left' },
  main: { flex: 1, overflow: 'auto', background: '#fff' },
}
