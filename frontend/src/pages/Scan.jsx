// frontend/src/pages/Scan.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, consumeSSE } from '../api'

export default function Scan() {
  const navigate = useNavigate()
  const [connections, setConnections] = useState([])
  const [selectedConn, setSelectedConn] = useState('')
  const [module, setModule] = useState('contacts')
  const [modules, setModules] = useState([])
  const [scanning, setScanning] = useState(false)
  const [logs, setLogs] = useState([])
  const [records, setRecords] = useState([])
  const [dupes, setDupes] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getConnections().then(d => setConnections(d.connections || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedConn) return
    api.getModules(selectedConn)
      .then(d => { setModules(d.modules || []); if (d.modules?.[0]) setModule(d.modules[0].key) })
      .catch(() => {})
  }, [selectedConn])

  async function runScan() {
    if (!selectedConn) return
    setScanning(true)
    setLogs([])
    setRecords([])
    setDupes([])
    setStats(null)
    setError('')

    const addLog = (text, level = '') => setLogs(l => [...l, { text, level }])

    try {
      addLog('Connecting to platform...', 'info')
      const { records: recs, nextPage } = await api.getRecords(selectedConn, module, 1, 200)
      addLog(`Fetched ${recs.length} records`, 'ok')
      setRecords(recs)

      addLog('Running duplicate detection...', 'info')
      const dupeRes = await api.previewDupes(selectedConn, module, {})
      setDupes(dupeRes.pairs || [])
      addLog(`Found ${dupeRes.duplicates} duplicate pairs`, dupeRes.duplicates > 0 ? 'warn' : 'ok')

      const missing = recs.filter(r => !r.email && !r.Email).length
      if (missing > 0) addLog(`${missing} records missing email field`, 'warn')

      setStats({ total: recs.length, dupes: dupeRes.duplicates, missing })
      addLog('Scan complete', 'ok')
    } catch (err) {
      setError(err.message)
      addLog('Scan failed: ' + err.message, 'error')
    } finally {
      setScanning(false)
    }
  }

  const logColor = { ok: '#1D9E75', warn: '#854F0B', info: '#534AB7', error: '#c0392b', '': '#666' }
  const connected = connections.filter(c => c.status === 'active')

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Data scan</h1>
      <p style={s.sub}>Fetch records from a connected platform and scan for duplicates and issues.</p>

      {connected.length === 0 ? (
        <div style={s.empty}>
          <p>No platforms connected yet.</p>
          <button style={s.btnPrimary} onClick={() => navigate('/connections')}>Connect a platform →</button>
        </div>
      ) : (
        <>
          <div style={s.card}>
            <div style={s.row}>
              <label style={s.label}>Platform</label>
              <select style={s.select} value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
                <option value=''>Select a platform...</option>
                {connected.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
              </select>
            </div>
            {modules.length > 0 && (
              <div style={s.row}>
                <label style={s.label}>Module</label>
                <select style={s.select} value={module} onChange={e => setModule(e.target.value)}>
                  {modules.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button style={s.btnPrimary} onClick={runScan} disabled={!selectedConn || scanning}>
                {scanning ? 'Scanning...' : 'Start scan →'}
              </button>
            </div>
          </div>

          {logs.length > 0 && (
            <div style={s.logBox}>
              {logs.map((l, i) => (
                <div key={i} style={{ color: logColor[l.level] || '#666', fontSize: 12, lineHeight: 1.9 }}>{l.text}</div>
              ))}
              {scanning && <div style={{ color: '#534AB7', fontSize: 12 }}>▋</div>}
            </div>
          )}

          {stats && (
            <div style={s.metrics}>
              <div style={s.metric}><div style={s.metricN}>{stats.total}</div><div style={s.metricL}>total records</div></div>
              <div style={s.metric}><div style={{ ...s.metricN, color: '#A32D2D' }}>{stats.dupes}</div><div style={s.metricL}>duplicates</div></div>
              <div style={s.metric}><div style={{ ...s.metricN, color: '#854F0B' }}>{stats.missing}</div><div style={s.metricL}>missing email</div></div>
            </div>
          )}

          {dupes.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHead}>
                Duplicate pairs found
                <button style={s.btnPrimary} onClick={() => navigate('/rules', { state: { connectionId: selectedConn, module, records } })}>
                  Set dedup rules →
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Record A</th>
                    <th style={s.th}>Record B</th>
                    <th style={s.th}>Matched on</th>
                    <th style={s.th}>Confidence</th>
                  </tr></thead>
                  <tbody>
                    {dupes.slice(0, 10).map((d, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#faf9ff' : '#fff' }}>
                        <td style={s.td}><code style={s.code}>{d.record_a_id?.slice(0, 12)}...</code></td>
                        <td style={s.td}><code style={s.code}>{d.record_b_id?.slice(0, 12)}...</code></td>
                        <td style={s.td}>{(d.matched_on || []).join(', ')}</td>
                        <td style={s.td}><span style={{ ...s.badge, background: d.confidence === 'high' ? '#FCEBEB' : '#FAEEDA', color: d.confidence === 'high' ? '#A32D2D' : '#854F0B' }}>{d.confidence}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {records.length > 0 && dupes.length === 0 && (
            <div style={s.card}>
              <div style={s.cardHead}>Sample records</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Company</th>
                  </tr></thead>
                  <tbody>
                    {records.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#faf9ff' : '#fff' }}>
                        <td style={s.td}>{r.firstname || r.FirstName || r.first_name || '—'} {r.lastname || r.LastName || r.last_name || ''}</td>
                        <td style={s.td}>{r.email || r.Email || '—'}</td>
                        <td style={s.td}>{r.company || r.Company || r['company_name'] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  page: { padding: '28px 24px', maxWidth: 860, fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 20, fontWeight: 500, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#666', margin: '0 0 20px' },
  card: { background: '#fff', border: '1px solid #ede9f7', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHead: { fontSize: 13, fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  row: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  label: { fontSize: 12, color: '#666', width: 80, flexShrink: 0 },
  select: { flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 8 },
  logBox: { background: '#f6f5ff', borderRadius: 10, padding: 14, fontFamily: 'monospace', marginBottom: 12 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 },
  metric: { background: '#f8f7ff', borderRadius: 10, padding: '14px 16px' },
  metricN: { fontSize: 26, fontWeight: 500 },
  metricL: { fontSize: 11, color: '#999', marginTop: 2 },
  table: { width: '100%', fontSize: 12, borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: '#999', borderBottom: '1px solid #ede9f7' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f4f2fc' },
  code: { background: '#f0eef8', borderRadius: 4, padding: '1px 5px', fontSize: 11 },
  badge: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999 },
  empty: { padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: '#666' },
  btnPrimary: { padding: '8px 16px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
}
