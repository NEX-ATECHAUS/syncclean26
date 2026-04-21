import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

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
    api.getConnections().then(d => setConnections((d.connections || []).filter(Boolean))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedConn) return
    setModules([])
    api.getModules(selectedConn)
      .then(d => {
        const mods = (d.modules || []).filter(Boolean)
        setModules(mods)
        if (mods[0]) setModule(mods[0].key || mods[0].name?.toLowerCase() || 'contacts')
      })
      .catch(() => {})
  }, [selectedConn])

  const addLog = (text, level = '') => setLogs(l => [...l, { text, level }])

  async function runScan() {
    if (!selectedConn) return
    setScanning(true)
    setLogs([])
    setRecords([])
    setDupes([])
    setStats(null)
    setError('')
    try {
      addLog('Connecting to platform...', 'info')
      const { records: recs } = await api.getRecords(selectedConn, module, 1, 200)
      const safeRecs = (recs || []).filter(Boolean)
      addLog(`Fetched ${safeRecs.length} records`, 'ok')
      setRecords(safeRecs)
      addLog('Running duplicate detection...', 'info')
      const dupeRes = await api.previewDupes(selectedConn, module, {})
      const safePairs = (dupeRes.pairs || []).filter(Boolean)
      setDupes(safePairs)
      addLog(`Found ${dupeRes.duplicates || 0} duplicate pairs`, (dupeRes.duplicates || 0) > 0 ? 'warn' : 'ok')
      const missing = safeRecs.filter(r => !r.email && !r.Email).length
      if (missing > 0) addLog(`${missing} records missing email`, 'warn')
      setStats({ total: safeRecs.length, dupes: dupeRes.duplicates || 0, missing })
      addLog('Scan complete ✓', 'ok')
    } catch (err) {
      setError(err.message)
      addLog('Scan failed: ' + err.message, 'error')
    } finally {
      setScanning(false)
    }
  }

  const connected = connections.filter(c => c && c.status === 'active')
  const lc = { ok:'#059669', warn:'#d97706', info:'#7c3aed', error:'#dc2626', '':'#666' }

  return (
    <div style={{ padding:'40px', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>Data scan</h1>
      <p style={{ color:'#888', margin:'0 0 32px', fontSize:14 }}>Fetch records and automatically detect duplicates and data issues.</p>

      {connected.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:14, padding:40, textAlign:'center', border:'2px dashed #ede9f7' }}>
          <p style={{ color:'#aaa', marginBottom:16 }}>No platforms connected yet.</p>
          <button onClick={() => navigate('/connections')} style={PB}>Connect a platform →</button>
        </div>
      ) : (
        <>
          <div style={C}>
            <h3 style={CH}>Configure scan</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              <div>
                <label style={L}>Platform</label>
                <select style={S} value={selectedConn} onChange={e => setSelectedConn(e.target.value)}>
                  <option value=''>Select platform...</option>
                  {connected.map(c => <option key={c.id} value={c.id}>{c.display_name || c.platform}</option>)}
                </select>
              </div>
              <div>
                <label style={L}>Module</label>
                <select style={S} value={module} onChange={e => setModule(e.target.value)}>
                  {modules.length > 0
                    ? modules.map(m => <option key={m.key || m.name} value={m.key || m.name?.toLowerCase()}>{m.name}</option>)
                    : <option value='contacts'>Contacts</option>}
                </select>
              </div>
            </div>
            {error && <div style={{ fontSize:13, color:'#dc2626', background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>{error}</div>}
            <button style={{ ...PB, opacity: (!selectedConn || scanning) ? 0.6 : 1 }} onClick={runScan} disabled={!selectedConn || scanning}>
              {scanning ? 'Scanning...' : 'Start scan →'}
            </button>
          </div>

          {logs.length > 0 && (
            <div style={{ background:'#1a1744', borderRadius:12, padding:'16px 20px', marginBottom:20, fontFamily:'monospace' }}>
              {logs.map((l, i) => (
                <div key={i} style={{ color: lc[l.level] || '#aaa', fontSize:13, lineHeight:2 }}>{l.text}</div>
              ))}
              {scanning && <div style={{ color:'#a78bfa', fontSize:13 }}>▋</div>}
            </div>
          )}

          {stats && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
              <div style={{ background:'#fff', borderRadius:14, padding:'20px 24px', border:'1px solid #ede9f7' }}>
                <div style={{ fontSize:32, fontWeight:700, color:'#1a1744' }}>{stats.total}</div>
                <div style={{ fontSize:13, color:'#888' }}>total records</div>
              </div>
              <div style={{ background:'#fff', borderRadius:14, padding:'20px 24px', border:'1px solid #fee2e2' }}>
                <div style={{ fontSize:32, fontWeight:700, color:'#dc2626' }}>{stats.dupes}</div>
                <div style={{ fontSize:13, color:'#888' }}>duplicates found</div>
              </div>
              <div style={{ background:'#fff', borderRadius:14, padding:'20px 24px', border:'1px solid #fef3c7' }}>
                <div style={{ fontSize:32, fontWeight:700, color:'#d97706' }}>{stats.missing}</div>
                <div style={{ fontSize:13, color:'#888' }}>missing email</div>
              </div>
            </div>
          )}

          {dupes.length > 0 && (
            <div style={C}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <h3 style={{ ...CH, margin:0 }}>Duplicate pairs detected</h3>
                <button style={PB} onClick={() => navigate('/rules', { state:{ connectionId:selectedConn, module, records } })}>Set dedup rules →</button>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#f8f7ff' }}>
                    <th style={TH}>Record A</th><th style={TH}>Record B</th><th style={TH}>Matched on</th><th style={TH}>Confidence</th>
                  </tr></thead>
                  <tbody>
                    {dupes.slice(0,15).map((d, i) => d && (
                      <tr key={i}>
                        <td style={TD}><code style={{ background:'#f0eef8', borderRadius:4, padding:'2px 6px', fontSize:12 }}>{String(d.record_a_id || '').slice(0,14)}...</code></td>
                        <td style={TD}><code style={{ background:'#f0eef8', borderRadius:4, padding:'2px 6px', fontSize:12 }}>{String(d.record_b_id || '').slice(0,14)}...</code></td>
                        <td style={TD}>{(d.matched_on || []).join(', ')}</td>
                        <td style={TD}><span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background: d.confidence === 'high' ? '#fee2e2' : '#fef3c7', color: d.confidence === 'high' ? '#991b1b' : '#92400e' }}>{d.confidence}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {records.length > 0 && (
            <div style={C}>
              <h3 style={CH}>Sample records</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#f8f7ff' }}>
                    <th style={TH}>Name</th><th style={TH}>Email</th><th style={TH}>Company</th>
                  </tr></thead>
                  <tbody>
                    {records.slice(0,10).map((r, i) => r && (
                      <tr key={i}>
                        <td style={TD}>{r.firstname || r.FirstName || r.first_name || r.name || '—'} {r.lastname || r.LastName || r.last_name || ''}</td>
                        <td style={TD}>{r.email || r.Email || '—'}</td>
                        <td style={TD}>{r.company || r.Company || r.company_name || '—'}</td>
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

const C  = { background:'#fff', border:'1px solid #ede9f7', borderRadius:14, padding:'24px', marginBottom:20 }
const CH = { fontSize:16, fontWeight:600, margin:'0 0 16px', color:'#1a1744' }
const L  = { fontSize:13, fontWeight:500, color:'#444', display:'block', marginBottom:6 }
const S  = { width:'100%', padding:'10px 14px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, outline:'none', background:'#fff' }
const PB = { padding:'10px 20px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }
const TH = { textAlign:'left', padding:'10px 14px', fontSize:12, fontWeight:600, color:'#888', borderBottom:'2px solid #ede9f7' }
const TD = { padding:'10px 14px', borderBottom:'1px solid #f4f2fc' }
