// frontend/src/pages/Merge.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'

export default function Merge() {
  const navigate = useNavigate()
  const location = useLocation()
  const { connectionId, module, rules } = location.state || {}
  const [dupes, setDupes] = useState([])
  const [merged, setMerged] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!connectionId) { setLoading(false); return }
    api.previewDupes(connectionId, module || 'contacts', rules || {})
      .then(d => setDupes(d.pairs || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function markMerged(idx) {
    setMerged(m => ({ ...m, [idx]: true }))
  }

  function mergeAll() {
    const all = {}
    dupes.forEach((_, i) => { all[i] = true })
    setMerged(all)
  }

  const mergedCount = Object.keys(merged).length
  const pct = dupes.length ? Math.round((mergedCount / dupes.length) * 100) : 0

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Merge duplicates</h1>
      <p style={s.sub}>Review and approve merges one by one, or bulk-approve all.</p>

      {error && <div style={s.error}>{error}</div>}

      {loading ? <div style={s.muted}>Loading duplicates...</div> : dupes.length === 0 ? (
        <div style={s.card}>
          <p style={s.muted}>No duplicates found with the current rules.</p>
          <button style={s.btnGhost} onClick={() => navigate('/rules')}>Adjust rules</button>
        </div>
      ) : (
        <>
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#666' }}>{mergedCount} of {dupes.length} merged</div>
              <button style={s.btnPrimary} onClick={mergeAll}>Merge all {dupes.length} →</button>
            </div>
            <div style={s.progressBar}><div style={{ ...s.progressFill, width: pct + '%' }} /></div>
          </div>

          <div style={s.card}>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Master record</th>
                <th style={s.th}>Duplicate</th>
                <th style={s.th}>Matched on</th>
                <th style={s.th}>Confidence</th>
                <th style={s.th}>Action</th>
              </tr></thead>
              <tbody>
                {dupes.map((d, i) => (
                  <tr key={i} style={{ background: merged[i] ? '#f0faf5' : i % 2 ? '#faf9ff' : '#fff' }}>
                    <td style={s.td}><code style={s.code}>{d.record_a_id?.slice(0, 14)}...</code></td>
                    <td style={s.td}><code style={s.code}>{d.record_b_id?.slice(0, 14)}...</code></td>
                    <td style={s.td}>{(d.matched_on || []).join(', ')}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: d.confidence === 'high' ? '#FCEBEB' : '#FAEEDA', color: d.confidence === 'high' ? '#A32D2D' : '#854F0B' }}>
                        {d.confidence}
                      </span>
                    </td>
                    <td style={s.td}>
                      {merged[i]
                        ? <span style={{ ...s.badge, background: '#EAF3DE', color: '#3B6D11' }}>Merged</span>
                        : <button style={s.btnSm} onClick={() => markMerged(i)}>Merge</button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={s.actions}>
            <button style={s.btnGhost} onClick={() => navigate('/rules')}>← Back to rules</button>
            <button style={s.btnPrimary} onClick={() => navigate('/mapping', { state: { connectionId, module, rules } })}>
              Map fields →
            </button>
          </div>
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
  muted: { fontSize: 13, color: '#999' },
  error: { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '10px 14px', marginBottom: 12 },
  progressBar: { height: 6, borderRadius: 3, background: '#f0eef8', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, background: '#534AB7', transition: 'width .4s' },
  table: { width: '100%', fontSize: 12, borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: '#999', borderBottom: '1px solid #ede9f7' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f4f2fc', verticalAlign: 'middle' },
  code: { background: '#f0eef8', borderRadius: 4, padding: '1px 5px', fontSize: 11 },
  badge: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnPrimary: { padding: '8px 16px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnGhost: { padding: '8px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  btnSm: { padding: '4px 10px', fontSize: 11, border: '1px solid #e0ddf7', borderRadius: 6, background: '#fff', cursor: 'pointer' },
}
