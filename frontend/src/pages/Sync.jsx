// frontend/src/pages/Sync.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, consumeSSE } from '../api'

export default function Sync() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}

  const [connections, setConnections] = useState([])
  const [sourceId, setSourceId] = useState(state.sourceId || '')
  const [destId, setDestId] = useState(state.destId || '')
  const [direction, setDirection] = useState('one_way')
  const [conflictPolicy, setConflictPolicy] = useState('newest_wins')
  const [schedule, setSchedule] = useState('manual')
  const [dryRun, setDryRun] = useState(true)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [done, setDone] = useState(null)
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.getConnections().then(d => setConnections(d.connections || [])).catch(() => {})
    api.getJobs().then(d => setJobs(d.jobs || [])).catch(() => {})
  }, [])

  const connected = connections.filter(c => c.status === 'active')
  const logColor = { ok: '#1D9E75', warn: '#854F0B', info: '#534AB7', error: '#c0392b', '': '#666' }

  async function runSync() {
    if (!sourceId || !destId) return
    setRunning(true)
    setLogs([])
    setDone(null)
    setError('')

    const addLog = (text, level = '') => setLogs(l => [...l, { text, level }])

    try {
      addLog('Creating sync job...', 'info')
      const job = await api.createJob({
        sourceId,
        destinationId: destId,
        direction,
        conflictPolicy,
        schedule,
        fieldMap: state.fieldMap || {},
        dedupRules: state.rules || {},
        mergeStrategy: state.rules?.mergeStrategy || 'most_complete',
      })

      addLog('Starting sync...', 'info')
      const res = await api.runJob(job.id)

      await consumeSSE(res, (event) => {
        if (event.type === 'log') addLog(event.text, event.level)
        if (event.type === 'done') {
          setDone(event.stats)
          api.getJobs().then(d => setJobs(d.jobs || [])).catch(() => {})
        }
        if (event.type === 'error') {
          setError(event.text)
          addLog('Error: ' + event.text, 'error')
        }
      })
    } catch (err) {
      setError(err.message)
      addLog('Failed: ' + err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Run sync</h1>
      <p style={s.sub}>Configure your sync job and run it. Records are cleaned and pushed to the destination.</p>

      <div style={s.card}>
        <div style={s.cardHead}>Sync settings</div>
        <div style={s.twoCol}>
          <div>
            <div style={s.label}>Source</div>
            <select style={s.select} value={sourceId} onChange={e => setSourceId(e.target.value)}>
              <option value=''>Select source...</option>
              {connected.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Destination</div>
            <select style={s.select} value={destId} onChange={e => setDestId(e.target.value)}>
              <option value=''>Select destination...</option>
              {connected.filter(c => c.id !== sourceId).map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ ...s.twoCol, marginTop: 12 }}>
          <div>
            <div style={s.label}>Direction</div>
            <select style={s.select} value={direction} onChange={e => setDirection(e.target.value)}>
              <option value='one_way'>One-way (source → destination)</option>
              <option value='bidirectional'>Bidirectional</option>
            </select>
          </div>
          <div>
            <div style={s.label}>Conflict resolution</div>
            <select style={s.select} value={conflictPolicy} onChange={e => setConflictPolicy(e.target.value)}>
              <option value='newest_wins'>Most recently updated wins</option>
              <option value='source_wins'>Source always wins</option>
              <option value='dest_wins'>Destination always wins</option>
            </select>
          </div>
        </div>
        <div style={{ ...s.twoCol, marginTop: 12 }}>
          <div>
            <div style={s.label}>Schedule</div>
            <select style={s.select} value={schedule} onChange={e => setSchedule(e.target.value)}>
              <option value='manual'>Manual only</option>
              <option value='hourly'>Every hour</option>
              <option value='daily'>Daily at midnight</option>
            </select>
          </div>
          <div>
            <div style={s.label}>Mode</div>
            <select style={s.select} value={dryRun ? 'dry' : 'live'} onChange={e => setDryRun(e.target.value === 'dry')}>
              <option value='dry'>Dry run — preview only</option>
              <option value='live'>Live — write to destination</option>
            </select>
          </div>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button
          style={{ ...s.btnPrimary, width: '100%', marginTop: 16, padding: '11px 0' }}
          onClick={runSync}
          disabled={running || !sourceId || !destId}
        >
          {running ? 'Syncing...' : `${dryRun ? 'Preview' : 'Run'} sync →`}
        </button>
      </div>

      {logs.length > 0 && (
        <div style={s.logBox}>
          {logs.map((l, i) => (
            <div key={i} style={{ color: logColor[l.level] || '#666', fontSize: 12, lineHeight: 1.9 }}>{l.text}</div>
          ))}
          {running && <div style={{ color: '#534AB7', fontSize: 12 }}>▋</div>}
        </div>
      )}

      {done && (
        <div style={s.successCard}>
          <div style={s.successTitle}>Sync complete</div>
          <div style={s.metrics}>
            <div style={s.metric}><div style={{ ...s.metricN, color: '#1D9E75' }}>{done.synced || 0}</div><div style={s.metricL}>synced</div></div>
            <div style={s.metric}><div style={{ ...s.metricN, color: '#534AB7' }}>{done.merged || 0}</div><div style={s.metricL}>merged</div></div>
            <div style={s.metric}><div style={{ ...s.metricN, color: '#854F0B' }}>{done.errors || 0}</div><div style={s.metricL}>errors</div></div>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div style={s.card}>
          <div style={s.cardHead}>Sync history</div>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>Direction</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Synced</th>
              <th style={s.th}>Merged</th>
              <th style={s.th}>Last run</th>
            </tr></thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td style={s.td}>{j.direction}</td>
                  <td style={s.td}><span style={{ ...s.badge, background: j.status === 'idle' ? '#EAF3DE' : j.status === 'error' ? '#FCEBEB' : '#EEEDFE', color: j.status === 'idle' ? '#3B6D11' : j.status === 'error' ? '#A32D2D' : '#3C3489' }}>{j.status}</span></td>
                  <td style={s.td}>{j.stats?.synced ?? '—'}</td>
                  <td style={s.td}>{j.stats?.merged ?? '—'}</td>
                  <td style={s.td}>{j.last_run ? new Date(j.last_run * 1000).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: '28px 24px', maxWidth: 860, fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 20, fontWeight: 500, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#666', margin: '0 0 20px' },
  card: { background: '#fff', border: '1px solid #ede9f7', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHead: { fontSize: 13, fontWeight: 500, marginBottom: 14 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },
  select: { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 8 },
  logBox: { background: '#f6f5ff', borderRadius: 10, padding: 14, fontFamily: 'monospace', marginBottom: 12 },
  successCard: { background: '#f0faf5', border: '1px solid #9FE1CB', borderRadius: 12, padding: 16, marginBottom: 12 },
  successTitle: { fontSize: 14, fontWeight: 500, color: '#1D9E75', marginBottom: 12 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 },
  metric: { background: '#fff', borderRadius: 8, padding: '10px 14px', textAlign: 'center' },
  metricN: { fontSize: 22, fontWeight: 500 },
  metricL: { fontSize: 11, color: '#999', marginTop: 2 },
  table: { width: '100%', fontSize: 12, borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: '#999', borderBottom: '1px solid #ede9f7' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f4f2fc' },
  badge: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999 },
  error: { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '10px 14px', marginTop: 12 },
  btnPrimary: { padding: '9px 18px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
}
