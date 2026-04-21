import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Dashboard from './pages/Dashboard'
import Connections from './pages/Connections'
import CustomApi from './pages/CustomApi'
import Scan from './pages/Scan'
import Rules from './pages/Rules'
import Merge from './pages/Merge'
import Mapping from './pages/Mapping'
import Sync from './pages/Sync'

function Shell({ children }) {
  const { user, logout } = useAuth()
  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'"Inter",-apple-system,BlinkMacSystemFont,sans-serif', background:'#f5f4ff' }}>
      <div style={{ width:220, background:'#1a1744', display:'flex', flexDirection:'column', flexShrink:0, minHeight:'100vh' }}>
        <div style={{ padding:'24px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:20, fontWeight:700, color:'#fff', letterSpacing:'-0.5px' }}>
            Clean<span style={{ color:'#a78bfa' }}>'</span>Sync
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2, letterSpacing:'0.08em' }}>NEX-A TECH SOLUTIONS</div>
        </div>
        <nav style={{ padding:'12px 10px', flex:1 }}>
          <NLink to="/dashboard">Dashboard</NLink>
          <div style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.3)', padding:'16px 10px 6px', letterSpacing:'0.1em' }}>CONNECT</div>
          <NLink to="/connections">Platforms</NLink>
          <NLink to="/custom-api">Custom API</NLink>
          <div style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.3)', padding:'16px 10px 6px', letterSpacing:'0.1em' }}>CLEAN</div>
          <NLink to="/scan">Data scan</NLink>
          <NLink to="/rules">Dedup rules</NLink>
          <NLink to="/merge">Merge dupes</NLink>
          <div style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.3)', padding:'16px 10px 6px', letterSpacing:'0.1em' }}>SYNC</div>
          <NLink to="/mapping">Field mapping</NLink>
          <NLink to="/sync">Run sync</NLink>
        </nav>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
          <button onClick={logout} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:'rgba(255,255,255,0.6)', fontSize:12, cursor:'pointer', padding:'6px 12px', borderRadius:6, width:'100%', textAlign:'left' }}>Sign out</button>
        </div>
      </div>
      <div style={{ flex:1, overflow:'auto', minWidth:0 }}>{children}</div>
    </div>
  )
}

function NLink({ to, children }) {
  return (
    <NavLink to={to} style={({ isActive }) => ({
      display:'block', padding:'8px 10px', borderRadius:8, fontSize:13, color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
      textDecoration:'none', background: isActive ? 'rgba(167,139,250,0.2)' : 'transparent',
      fontWeight: isActive ? 500 : 400, marginBottom:1, borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
    })}>
      {children}
    </NavLink>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'system-ui', color:'#888' }}>Loading…</div>
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/connections" element={<PrivateRoute><Connections /></PrivateRoute>} />
          <Route path="/custom-api"  element={<PrivateRoute><CustomApi /></PrivateRoute>} />
          <Route path="/scan"        element={<PrivateRoute><Scan /></PrivateRoute>} />
          <Route path="/rules"       element={<PrivateRoute><Rules /></PrivateRoute>} />
          <Route path="/merge"       element={<PrivateRoute><Merge /></PrivateRoute>} />
          <Route path="/mapping"     element={<PrivateRoute><Mapping /></PrivateRoute>} />
          <Route path="/sync"        element={<PrivateRoute><Sync /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
