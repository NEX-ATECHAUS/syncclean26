import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [connections, setConnections] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getConnections().catch(() => ({ connections: [] })),
      api.getJobs().catch(() => ({ jobs: [] }))
    ]).then(([c, j]) => {
      setConnections((c.connections || []).filter(Boolean))
      setJobs((j.jobs || []).filter(Boolean))
    }).finally(() => setLoading(false))
  }, [])

  const connected = connections.filter(c => c && c.status === 'active')
  const lastJob = jobs[0] || null
  const lastStats = lastJob?.stats || {}

  const metrics = [
    { label: 'Connected platforms', value: connected.length, color: '#7c3aed' },
    { label: 'Records synced', value: lastStats.synced || 0, color: '#059669' },
    { label: 'Dupes merged', value: lastStats.merged || 0, color: '#dc2626' },
    { label: 'Sync errors', value: lastStats.errors || 0, color: '#d97706' },
  ]

  const quickActions = [
    { label: 'Connect platform', icon: '⊕', path: '/connections', color: '#7c3aed' },
    { label: 'Custom API', icon: '⚡', path: '/custom-api', color: '#2563eb' },
    { label: 'Scan for dupes', icon: '⌕', path: '/scan', color: '#059669' },
    { label: 'Run sync', icon: '↻', path: '/sync', color: '#d97706' },
  ]

  return (
    <div style={{ padding:'40px', minHeight:'100vh' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>
            {user?.name ? `Welcome back, ${user.name}` : 'Dashboard'}
          </h1>
          <p style={{ color:'#888', margin:0, fontSize:14 }}>Here's the state of your CRM data.</p>
        </div>
        <button onClick={() => navigate('/scan')} style={btn.primary}>Run new scan →</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background:'#fff', borderRadius:14, padding:'20px 24px', border:'1px solid #ede9f7' }}>
            <div style={{ fontSize:32, fontWeight:700, color:m.color, marginBottom:4 }}>{loading ? '—' : m.value}</div>
            <div style={{ fontSize:13, color:'#888' }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div style={card}>
          <div style={cardHead}>
            <span>Connected platforms</span>
            <button onClick={() => navigate('/connections')} style={btn.sm}>Manage</button>
          </div>
          {loading ? <div style={muted}>Loading...</div> : connected.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <p style={muted}>No platforms connected yet.</p>
              <button onClick={() => navigate('/connections')} style={btn.primary}>Connect a platform →</button>
            </div>
          ) : connected.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f4f2fc' }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#059669', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500 }}>{c.display_name || c.platform}</div>
                <div style={{ fontSize:12, color:'#aaa' }}>{c.platform}</div>
              </div>
              <span style={badge.green}>active</span>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={cardHead}>
            <span>Recent syncs</span>
            <button onClick={() => navigate('/sync')} style={btn.sm}>View all</button>
          </div>
          {loading ? <div style={muted}>Loading...</div> : jobs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <p style={muted}>No sync jobs yet.</p>
              <button onClick={() => navigate('/sync')} style={btn.primary}>Create sync job →</button>
            </div>
          ) : jobs.slice(0,5).map(j => (
            <div key={j.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f4f2fc' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{j.direction || 'one_way'}</div>
                <div style={{ fontSize:12, color:'#aaa' }}>{j.last_run ? new Date(j.last_run * 1000).toLocaleString() : 'Never run'}</div>
              </div>
              <span style={j.status === 'idle' ? badge.green : j.status === 'error' ? badge.red : badge.purple}>{j.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ ...cardHead, marginBottom:16 }}>Quick actions</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {quickActions.map(a => (
            <div key={a.label} onClick={() => navigate(a.path)}
              style={{ border:`2px solid ${a.color}22`, borderRadius:12, padding:'20px 16px', cursor:'pointer', textAlign:'center', background:`${a.color}08`, transition:'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = `${a.color}15`}
              onMouseLeave={e => e.currentTarget.style.background = `${a.color}08`}>
              <div style={{ fontSize:28, marginBottom:8, color:a.color }}>{a.icon}</div>
              <div style={{ fontSize:13, fontWeight:500, color:a.color }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const card = { background:'#fff', border:'1px solid #ede9f7', borderRadius:14, padding:'20px 24px' }
const cardHead = { fontSize:15, fontWeight:600, marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', color:'#1a1744' }
const muted = { fontSize:13, color:'#aaa', textAlign:'center', padding:'8px 0' }
const btn = {
  primary: { padding:'10px 20px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  sm: { padding:'5px 12px', fontSize:12, border:'1px solid #e0ddf7', borderRadius:6, background:'#fff', cursor:'pointer', color:'#7c3aed', fontWeight:500 },
}
const badge = {
  green:  { fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background:'#d1fae5', color:'#065f46' },
  red:    { fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background:'#fee2e2', color:'#991b1b' },
  purple: { fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background:'#ede9fe', color:'#5b21b6' },
}
