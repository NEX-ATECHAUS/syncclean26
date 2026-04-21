// frontend/src/pages/Mapping.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'

const COMMON_FIELDS = {
  hubspot:    ['firstname','lastname','email','phone','company','lifecyclestage','hs_lead_status','city','country'],
  salesforce: ['FirstName','LastName','Email','Phone','Account.Name','LeadSource','Title','City','Country'],
  pipedrive:  ['first_name','last_name','email','phone','org_name'],
  monday:     ['name','email','phone','company'],
  gohighlevel:['firstName','lastName','email','phone','companyName','city','country'],
  airtable:   ['Name','Email','Phone','Company'],
  zoho:       ['First_Name','Last_Name','Email','Phone','Account_Name','Lead_Source'],
}

export default function Mapping() {
  const navigate = useNavigate()
  const location = useLocation()
  const { connectionId, module, rules } = location.state || {}
  const [connections, setConnections] = useState([])
  const [sourceId, setSourceId] = useState(connectionId || '')
  const [destId, setDestId] = useState('')
  const [fieldMap, setFieldMap] = useState({})
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getConnections().then(d => setConnections(d.connections || [])).catch(() => {})
  }, [])

  const connected = connections.filter(c => c.status === 'active')
  const sourcePlatform = connections.find(c => c.id === sourceId)?.platform || ''
  const destPlatform = connections.find(c => c.id === destId)?.platform || ''
  const sourceFields = COMMON_FIELDS[sourcePlatform] || []
  const destFields = COMMON_FIELDS[destPlatform] || []

  async function suggestMappings() {
    if (!sourceFields.length || !destFields.length) return
    setSuggesting(true)
    setError('')
    try {
      const { mappings } = await api.suggestMappings(sourceFields, destFields, sourcePlatform, destPlatform)
      const map = {}
      mappings.forEach(m => { if (m.dest_field) map[m.source_field] = m.dest_field })
      setFieldMap(map)
    } catch (err) {
      setError(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  function setMap(src, dest) {
    setFieldMap(m => ({ ...m, [src]: dest }))
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Field mapping</h1>
      <p style={s.sub}>Map fields from your source platform to the destination. AI can suggest mappings automatically.</p>

      <div style={s.card}>
        <div style={s.twoCol}>
          <div>
            <div style={s.label}>Source platform</div>
            <select style={s.select} value={sourceId} onChange={e => setSourceId(e.target.value)}>
              <option value=''>Select source...</option>
              {connected.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
          <div>
            <div style={s.label}>Destination platform</div>
            <select style={s.select} value={destId} onChange={e => setDestId(e.target.value)}>
              <option value=''>Select destination...</option>
              {connected.filter(c => c.id !== sourceId).map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </div>
        </div>
        {sourceId && destId && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button style={s.btnPrimary} onClick={suggestMappings} disabled={suggesting}>
              {suggesting ? 'AI suggesting...' : '✦ AI suggest mappings →'}
            </button>
          </div>
        )}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {sourceFields.length > 0 && destFields.length > 0 && (
        <div style={s.card}>
          <div style={s.cardHead}>Field mappings</div>
          {sourceFields.map(f => {
            const mapped = fieldMap[f]
            return (
              <div key={f} style={s.fieldRow}>
                <code style={s.pill}>{f}</code>
                <span style={{ color: '#ccc', margin: '0 8px', fontSize: 16 }}>→</span>
                <select
                  style={{ ...s.select, flex: 1 }}
                  value={mapped || ''}
                  onChange={e => setMap(f, e.target.value)}
                >
                  <option value=''>— skip —</option>
                  {destFields.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{
                  ...s.badge,
                  marginLeft: 10,
                  background: mapped ? '#EAF3DE' : '#f4f2fc',
                  color: mapped ? '#3B6D11' : '#aaa'
                }}>
                  {mapped ? 'mapped' : 'unmapped'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={s.actions}>
        <button style={s.btnGhost} onClick={() => navigate('/merge')}>← Back to merge</button>
        <button
          style={s.btnPrimary}
          disabled={!sourceId || !destId}
          onClick={() => navigate('/sync', { state: { sourceId, destId, fieldMap, rules, module } })}
        >
          Configure sync →
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { padding: '28px 24px', maxWidth: 720, fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 20, fontWeight: 500, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#666', margin: '0 0 20px' },
  card: { background: '#fff', border: '1px solid #ede9f7', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHead: { fontSize: 13, fontWeight: 500, marginBottom: 14 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },
  select: { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 8 },
  fieldRow: { display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f4f2fc' },
  pill: { background: '#f0eef8', borderRadius: 4, padding: '2px 7px', fontSize: 11, minWidth: 140 },
  badge: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999 },
  error: { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '10px 14px', marginBottom: 12 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnPrimary: { padding: '9px 18px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnGhost: { padding: '9px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
}
