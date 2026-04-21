import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, consumeSSE } from '../api'

export default function Sync() {
  const navigate = useNavigate()
  const { state = {} } = useLocation()
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
    api.getConnections().then(d => setConnections((d.connections||[]).filter(Boolean))).catch(()=>{})
    api.getJobs().then(d => setJobs((d.jobs||[]).filter(Boolean))).catch(()=>{})
  }, [])

  const connected = connections.filter(c => c && c.status === 'active')
  const lc = { ok:'#059669', warn:'#d97706', info:'#7c3aed', error:'#dc2626', '':'#9ca3af' }

  async function runSync() {
    if (!sourceId || !destId) return
    setRunning(true)
    setLogs([])
    setDone(null)
    setError('')
    const addLog = (text, level='') => setLogs(l => [...l, { text, level }])
    try {
      addLog('Creating sync job...', 'info')
      const job = await api.createJob({
        sourceId, destinationId: destId, direction, conflictPolicy, schedule,
        fieldMap: state.fieldMap || {},
        dedupRules: state.rules || {},
        mergeStrategy: state.rules?.mergeStrategy || 'most_complete',
      })
      addLog('Starting sync...', 'info')
      const res = await api.runJob(job.id)
      await consumeSSE(res, event => {
        if (event.type === 'log') addLog(event.text, event.level)
        if (event.type === 'done') { setDone(event.stats); api.getJobs().then(d => setJobs((d.jobs||[]).filter(Boolean))).catch(()=>{}) }
        if (event.type === 'error') { setError(event.text); addLog('Error: '+event.text, 'error') }
      })
    } catch (err) {
      setError(err.message)
      addLog('Failed: '+err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ padding:'40px', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>Run sync</h1>
      <p style={{ color:'#888', margin:'0 0 32px', fontSize:14 }}>Configure and execute your sync job. Records are cleaned and pushed to the destination.</p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div style={C}>
          <h3 style={CH}>Sync settings</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={L}>Source platform</label>
              <select style={SEL} value={sourceId} onChange={e => setSourceId(e.target.value)}>
                <option value=''>Select source...</option>
                {connected.map(c => <option key={c.id} value={c.id}>{c.display_name||c.platform}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Destination platform</label>
              <select style={SEL} value={destId} onChange={e => setDestId(e.target.value)}>
                <option value=''>Select destination...</option>
                {connected.filter(c => c.id !== sourceId).map(c => <option key={c.id} value={c.id}>{c.display_name||c.platform}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Direction</label>
              <select style={SEL} value={direction} onChange={e => setDirection(e.target.value)}>
                <option value='one_way'>One-way (source → destination)</option>
                <option value='bidirectional'>Bidirectional</option>
              </select>
            </div>
            <div>
              <label style={L}>Conflict resolution</label>
              <select style={SEL} value={conflictPolicy} onChange={e => setConflictPolicy(e.target.value)}>
                <option value='newest_wins'>Most recently updated wins</option>
                <option value='source_wins'>Source always wins</option>
                <option value='dest_wins'>Destination always wins</option>
              </select>
            </div>
            <div>
              <label style={L}>Schedule</label>
              <select style={SEL} value={schedule} onChange={e => setSchedule(e.target.value)}>
                <option value='manual'>Manual only</option>
                <option value='hourly'>Every hour</option>
                <option value='daily'>Daily at midnight</option>
              </select>
            </div>
            <div>
              <label style={L}>Mode</label>
              <select style={SEL} value={dryRun?'dry':'live'} onChange={e => setDryRun(e.target.value==='dry')}>
                <option value='dry'>Dry run — preview only, no writes</option>
                <option value='live'>Live — write to destination</option>
              </select>
            </div>
            {error && <div style={{ fontSize:13, color:'#dc2626', background:'#fee2e2', borderRadius:8, padding:'10px 14px' }}>{error}</div>}
            <button onClick={runSync} disabled={running||!sourceId||!destId}
              style={{ ...PB, padding:'13px', opacity:(running||!sourceId||!destId)?0.5:1 }}>
              {running ? 'Syncing...' : dryRun ? 'Preview sync →' : 'Run sync →'}
            </button>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {(logs.length > 0 || running) && (
            <div style={{ background:'#1a1744', borderRadius:14, padding:'20px', flex:1, minHeight:200 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:12, letterSpacing:'0.08em' }}>SYNC LOG</div>
              {logs.map((l,i) => (
                <div key={i} style={{ color:lc[l.level]||'#9ca3af', fontSize:13, lineHeight:2, fontFamily:'monospace' }}>{l.text}</div>
              ))}
              {running && <div style={{ color:'#a78bfa', fontFamily:'monospace', fontSize:13 }}>▋</div>}
            </div>
          )}

          {done && (
            <div style={{ background:'#f0fdf4', border:'2px solid #86efac', borderRadius:14, padding:'24px' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#166534', marginBottom:16 }}>✓ Sync complete</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                <div style={{ background:'#fff', borderRadius:10, padding:'16px', textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:700, color:'#059669' }}>{done.synced||0}</div>
                  <div style={{ fontSize:12, color:'#888' }}>synced</div>
                </div>
                <div style={{ background:'#fff', borderRadius:10, padding:'16px', textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:700, color:'#7c3aed' }}>{done.merged||0}</div>
                  <div style={{ fontSize:12, color:'#888' }}>merged</div>
                </div>
                <div style={{ background:'#fff', borderRadius:10, padding:'16px', textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:700, color: (done.errors||0) > 0 ? '#dc2626':'#059669' }}>{done.errors||0}</div>
                  <div style={{ fontSize:12, color:'#888' }}>errors</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <div style={C}>
          <h3 style={CH}>Sync history</h3>
          <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#f8f7ff' }}>
              <th style={TH}>Direction</th>
              <th style={TH}>Status</th>
              <th style={TH}>Records synced</th>
              <th style={TH}>Dupes merged</th>
              <th style={TH}>Last run</th>
            </tr></thead>
            <tbody>
              {jobs.map(j => j && (
                <tr key={j.id}>
                  <td style={TD}>{j.direction||'one_way'}</td>
                  <td style={TD}><span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background: j.status==='idle'?'#d1fae5':j.status==='error'?'#fee2e2':'#ede9fe', color: j.status==='idle'?'#065f46':j.status==='error'?'#991b1b':'#5b21b6' }}>{j.status}</span></td>
                  <td style={TD}>{j.stats?.synced ?? '—'}</td>
                  <td style={TD}>{j.stats?.merged ?? '—'}</td>
                  <td style={TD}>{j.last_run ? new Date(j.last_run*1000).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const C   = { background:'#fff', border:'1px solid #ede9f7', borderRadius:14, padding:'24px' }
const CH  = { fontSize:16, fontWeight:600, margin:'0 0 16px', color:'#1a1744' }
const L   = { fontSize:13, fontWeight:500, color:'#444', display:'block', marginBottom:6 }
const SEL = { width:'100%', padding:'10px 14px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, outline:'none', background:'#fff' }
const PB  = { padding:'10px 20px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', width:'100%' }
const TH  = { textAlign:'left', padding:'12px 16px', fontSize:12, fontWeight:600, color:'#888', borderBottom:'2px solid #ede9f7' }
const TD  = { padding:'12px 16px', borderBottom:'1px solid #f4f2fc' }
