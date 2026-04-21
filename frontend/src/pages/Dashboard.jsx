// frontend/src/pages/Dashboard.jsx
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
    Promise.all([api.getConnections(), api.getJobs()])
      .then(([c, j]) => { setConnections(c.connections || []); setJobs(j.jobs || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const connected = connections.filter(c => c.status === 'active')
  const lastJob = jobs[0]
  const lastStats = lastJob?.stats || {}

  return (
    <div style={s.page}>
      <div style={s.welcome}>
        <div>
          <h1 style={s.h1}>Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
          <p style={s.sub}>Here's the state of your CRM data.</p>
        </div>
        <button style={s.btnPrimary} onClick={() => navigate('/scan')}>
          Run new scan →
        </button>
      </div>

      {/* Metric cards */}
      <div style={s.metrics}>
        <div style={s.metric}>
          <div style={s.metricN}>{connected.length}</div>
          <div style={s.metricL}>connected platforms</div>
        </div>
        <div style={s.metric}>
          <div style={{ ...s.metricN, color: '#1D9E75' }}>{lastStats.synced || 0}</div>
          <div style={s.metricL}>records synced</div>
        </div>
        <div style={s.metric}>
          <div style={{ ...s.metricN, color: '#A32D2D' }}>{lastStats.merged || 0}</div>
          <div style={s.metricL}>duplicates merged</div>
        </div>
        <div style={s.metric}>
          <div style={{ ...s.metricN, color: '#854F0B' }}>{lastStats.errors || 0}</div>
          <div style={s.metricL}>errors last sync</div>
        </div>
      </div>

      <div style={s.grid}>
        {/* Connected platforms */}
        <div style={s.card}>
          <div style={s.cardHead}>
            Connected platforms
            <button style={s.btnSm} onClick={() => navigate('/connections')}>Manage</button>
          </div>
          {loading ? <div style={s.muted}>Loading...</div> :
            connected.length === 0 ? (
              <div style={s.empty}>
                <p style={s.muted}>No platforms connected yet.</p>
                <button style={s.btnPrimary} onClick={() => navigate('/connections')}>Connect a platform →</button>
              </div>
            ) : connected.map(c => (
              <div key={c.id} style={s.platformRow}>
                <div style={s.platformDot} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.display_name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{c.platform} · {c.auth_type}</div>
                </div>
                <span style={{ ...s.badge, marginLeft: 'auto' }}>active</span>
              </div>
            ))
          }
        </div>

        {/* Recent sync jobs */}
        <div style={s.card}>
          <div style={s.cardHead}>
            Recent syncs
            <button style={s.btnSm} onClick={() => navigate('/sync')}>View all</button>
          </div>
          {loading ? <div style={s.muted}>Loading...</div> :
            jobs.length === 0 ? (
              <div style={s.empty}>
                <p style={s.muted}>No sync jobs yet.</p>
                <button style={s.btnPrimary} onClick={() => navigate('/sync')}>Create sync job →</button>
              </div>
            ) : jobs.slice(0, 5).map(j => (
              <div key={j.id} style={s.jobRow}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{j.direction === 'bidirectional' ? '⇄' : '→'} {j.status}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{j.last_run ? new Date(j.last_run * 1000).toLocaleString() : 'Never run'}</div>
                </div>
                <span style={{ ...s.badge, background: j.status === 'idle' ? '#EAF3DE' : j.status === 'error' ? '#FCEBEB' : '#EEEDFE', color: j.status === 'idle' ? '#3B6D11' : j.status === 'error' ? '#A32D2D' : '#3C3489' }}>
                  {j.status}
                </span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Quick actions */}
      <div style={s.card}>
        <div style={s.cardHead}>Quick actions</div>
        <div style={s.actions}>
          <div style={s.action} onClick={() => navigate('/connections')}>
            <div style={s.actionIcon}>+</div>
            <div style={s.actionLabel}>Connect platform</div>
          </div>
          <div style={s.action} onClick={() => navigate('/custom-api')}>
            <div style={s.actionIcon}>⚡</div>
            <div style={s.actionLabel}>Custom API</div>
          </div>
          <div style={s.action} onClick={() => navigate('/scan')}>
            <div style={s.actionIcon}>⌕</div>
            <div style={s.actionLabel}>Scan for dupes</div>
          </div>
          <div style={s.action} onClick={() => navigate('/sync')}>
            <div style={s.actionIcon}>↻</div>
            <div style={s.actionLabel}>Run sync</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { padding: '28px 24px', maxWidth: 860, fontFamily: 'system-ui, sans-serif' },
  welcome: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  h1: { fontSize: 22, fontWeight: 500, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#666', margin: 0 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 },
  metric: { background: '#f8f7ff', borderRadius: 10, padding: '14px 16px' },
  metricN: { fontSize: 26, fontWeight: 500 },
  metricL: { fontSize: 11, color: '#999', marginTop: 2 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  card: { background: '#fff', border: '1px solid #ede9f7', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHead: { fontSize: 13, fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  platformRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f4f2fc' },
  platformDot: { width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 },
  jobRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f4f2fc' },
  badge: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: '#EAF3DE', color: '#3B6D11' },
  actions: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 },
  action: { border: '1px solid #ede9f7', borderRadius: 10, padding: '14px 12px', cursor: 'pointer', textAlign: 'center', transition: 'background .1s' },
  actionIcon: { fontSize: 20, marginBottom: 6 },
  actionLabel: { fontSize: 12, color: '#666' },
  empty: { padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 },
  muted: { fontSize: 13, color: '#999' },
  btnPrimary: { padding: '8px 16px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnSm: { padding: '4px 10px', fontSize: 11, border: '1px solid #e0ddf7', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#534AB7' },
}
