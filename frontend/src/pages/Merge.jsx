import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'

export default function Merge() {
  const navigate = useNavigate()
  const { state = {} } = useLocation()
  const { connectionId, module, rules } = state
  const [dupes, setDupes] = useState([])
  const [merged, setMerged] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!connectionId) return
    setLoading(true)
    api.previewDupes(connectionId, module || 'contacts', rules || {})
      .then(d => setDupes((d.pairs || []).filter(Boolean)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const mergedCount = Object.keys(merged).length
  const pct = dupes.length ? Math.round((mergedCount / dupes.length) * 100) : 0

  return (
    <div style={{ padding:'40px', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>Merge duplicates</h1>
      <p style={{ color:'#888', margin:'0 0 32px', fontSize:14 }}>Review and approve merges individually or bulk-approve all at once.</p>

      {error && <div style={{ fontSize:13, color:'#dc2626', background:'#fee2e2', borderRadius:10, padding:'12px 16px', marginBottom:20 }}>{error}</div>}

      {!connectionId && (
        <div style={{ background:'#fff', borderRadius:14, padding:40, textAlign:'center', border:'2px dashed #ede9f7' }}>
          <p style={{ color:'#aaa', marginBottom:16 }}>Start from the Data scan page to load duplicates.</p>
          <button onClick={() => navigate('/scan')} style={PB}>Go to scan →</button>
        </div>
      )}

      {connectionId && loading && <div style={{ color:'#888', fontSize:14 }}>Loading duplicates...</div>}

      {connectionId && !loading && dupes.length === 0 && !error && (
        <div style={{ background:'#fff', borderRadius:14, padding:40, textAlign:'center', border:'1px solid #ede9f7' }}>
          <div style={{ fontSize:40, marginBottom:16 }}>🎉</div>
          <p style={{ color:'#059669', fontWeight:600, fontSize:16, marginBottom:8 }}>No duplicates found!</p>
          <p style={{ color:'#aaa', fontSize:14, marginBottom:20 }}>Your data looks clean with the current rules.</p>
          <button onClick={() => navigate('/rules')} style={GB}>Adjust rules</button>
        </div>
      )}

      {dupes.length > 0 && (
        <>
          <div style={{ background:'#fff', borderRadius:14, padding:'20px 24px', marginBottom:20, border:'1px solid #ede9f7', display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:14, fontWeight:600, color:'#1a1744' }}>{mergedCount} of {dupes.length} merged</span>
                <span style={{ fontSize:13, color:'#7c3aed', fontWeight:600 }}>{pct}%</span>
              </div>
              <div style={{ height:8, background:'#f0eef8', borderRadius:4, overflow:'hidden' }}>
                <div style={{ width:pct+'%', height:'100%', background:'#7c3aed', borderRadius:4, transition:'width .4s' }} />
              </div>
            </div>
            <button onClick={() => { const all={}; dupes.forEach((_,i) => { all[i]=true }); setMerged(all) }} style={PB}>
              Merge all {dupes.length} →
            </button>
          </div>

          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ede9f7', overflow:'hidden', marginBottom:20 }}>
            <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#f8f7ff' }}>
                <th style={TH}>Master record</th>
                <th style={TH}>Duplicate</th>
                <th style={TH}>Matched on</th>
                <th style={TH}>Confidence</th>
                <th style={TH}>Action</th>
              </tr></thead>
              <tbody>
                {dupes.map((d, i) => d && (
                  <tr key={i} style={{ background: merged[i] ? '#f0faf5' : 'transparent' }}>
                    <td style={TD}><code style={{ background:'#f0eef8', borderRadius:4, padding:'2px 6px', fontSize:12 }}>{String(d.record_a_id||'').slice(0,16)}...</code></td>
                    <td style={TD}><code style={{ background:'#f0eef8', borderRadius:4, padding:'2px 6px', fontSize:12 }}>{String(d.record_b_id||'').slice(0,16)}...</code></td>
                    <td style={TD}>{(d.matched_on||[]).join(', ')}</td>
                    <td style={TD}><span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background: d.confidence==='high' ? '#fee2e2':'#fef3c7', color: d.confidence==='high' ? '#991b1b':'#92400e' }}>{d.confidence}</span></td>
                    <td style={TD}>
                      {merged[i]
                        ? <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background:'#d1fae5', color:'#065f46' }}>Merged ✓</span>
                        : <button onClick={() => setMerged(m => ({ ...m, [i]:true }))} style={{ padding:'5px 14px', fontSize:12, border:'2px solid #7c3aed', borderRadius:6, background:'#fff', cursor:'pointer', color:'#7c3aed', fontWeight:600 }}>Merge</button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
        <button onClick={() => navigate('/rules')} style={GB}>← Back to rules</button>
        <button onClick={() => navigate('/mapping', { state })} style={PB}>Map fields →</button>
      </div>
    </div>
  )
}

const PB = { padding:'10px 20px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }
const GB = { padding:'10px 20px', background:'#fff', color:'#666', border:'2px solid #ede9f7', borderRadius:8, fontSize:13, cursor:'pointer' }
const TH = { textAlign:'left', padding:'12px 16px', fontSize:12, fontWeight:600, color:'#888', borderBottom:'2px solid #ede9f7' }
const TD = { padding:'12px 16px', borderBottom:'1px solid #f4f2fc', verticalAlign:'middle' }
