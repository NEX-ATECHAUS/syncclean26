import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'

const FIELDS = {
  hubspot:     ['firstname','lastname','email','phone','company','lifecyclestage','hs_lead_status','city','country','createdate'],
  salesforce:  ['FirstName','LastName','Email','Phone','AccountName','LeadSource','Title','City','Country','CreatedDate'],
  pipedrive:   ['first_name','last_name','email','phone','org_name','label','stage_id'],
  monday:      ['name','email','phone','company','status','date'],
  gohighlevel: ['firstName','lastName','email','phone','companyName','city','state','country','tags'],
  airtable:    ['Name','Email','Phone','Company','Status','Notes','Created'],
  zoho:        ['First_Name','Last_Name','Email','Phone','Account_Name','Lead_Source','Title','City','Country'],
}

export default function Mapping() {
  const navigate = useNavigate()
  const { state = {} } = useLocation()
  const [connections, setConnections] = useState([])
  const [sourceId, setSourceId] = useState(state.connectionId || '')
  const [destId, setDestId] = useState('')
  const [fieldMap, setFieldMap] = useState({})
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getConnections().then(d => setConnections((d.connections||[]).filter(Boolean))).catch(()=>{})
  }, [])

  const connected = connections.filter(c => c && c.status === 'active')
  const srcPlat = connected.find(c => c.id === sourceId)?.platform || ''
  const dstPlat = connected.find(c => c.id === destId)?.platform || ''
  const srcFields = FIELDS[srcPlat] || []
  const dstFields = FIELDS[dstPlat] || []

  async function suggestMappings() {
    if (!srcFields.length || !dstFields.length) return
    setSuggesting(true)
    setError('')
    try {
      const { mappings } = await api.suggestMappings(srcFields, dstFields, srcPlat, dstPlat)
      const map = {}
      ;(mappings||[]).forEach(m => { if (m && m.dest_field) map[m.source_field] = m.dest_field })
      setFieldMap(map)
    } catch (err) {
      setError(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  const mappedCount = Object.values(fieldMap).filter(Boolean).length

  return (
    <div style={{ padding:'40px', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>Field mapping</h1>
      <p style={{ color:'#888', margin:'0 0 32px', fontSize:14 }}>Map fields between platforms. AI can suggest mappings automatically.</p>

      <div style={C}>
        <h3 style={CH}>Select platforms</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:16, alignItems:'end', marginBottom: (srcFields.length && dstFields.length) ? 16 : 0 }}>
          <div>
            <label style={L}>Source platform</label>
            <select style={SEL} value={sourceId} onChange={e => { setSourceId(e.target.value); setFieldMap({}) }}>
              <option value=''>Select source...</option>
              {connected.map(c => <option key={c.id} value={c.id}>{c.display_name || c.platform}</option>)}
            </select>
          </div>
          <div style={{ fontSize:24, color:'#7c3aed', paddingBottom:2, textAlign:'center' }}>→</div>
          <div>
            <label style={L}>Destination platform</label>
            <select style={SEL} value={destId} onChange={e => { setDestId(e.target.value); setFieldMap({}) }}>
              <option value=''>Select destination...</option>
              {connected.filter(c => c.id !== sourceId).map(c => <option key={c.id} value={c.id}>{c.display_name || c.platform}</option>)}
            </select>
          </div>
        </div>
        {srcFields.length > 0 && dstFields.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, color:'#888' }}>{mappedCount} of {srcFields.length} fields mapped</span>
            <button onClick={suggestMappings} disabled={suggesting} style={{ ...PB, opacity: suggesting ? 0.6 : 1 }}>
              {suggesting ? '✦ Suggesting...' : '✦ AI suggest mappings →'}
            </button>
          </div>
        )}
      </div>

      {error && <div style={{ fontSize:13, color:'#dc2626', background:'#fee2e2', borderRadius:10, padding:'12px 16px', marginBottom:20 }}>{error}</div>}

      {srcFields.length > 0 && dstFields.length > 0 && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #ede9f7', overflow:'hidden', marginBottom:20 }}>
          <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#f8f7ff' }}>
              <th style={TH}>Source field ({srcPlat})</th>
              <th style={{ ...TH, textAlign:'center', width:60 }}></th>
              <th style={TH}>Destination field ({dstPlat})</th>
              <th style={{ ...TH, width:100 }}>Status</th>
            </tr></thead>
            <tbody>
              {srcFields.map(f => {
                const mapped = fieldMap[f]
                return (
                  <tr key={f}>
                    <td style={TD}><code style={{ background:'#f0eef8', borderRadius:6, padding:'4px 8px', fontSize:12, fontWeight:600, color:'#7c3aed' }}>{f}</code></td>
                    <td style={{ ...TD, textAlign:'center', color:'#ccc', fontSize:18 }}>→</td>
                    <td style={TD}>
                      <select value={mapped||''} onChange={e => setFieldMap(m => ({ ...m, [f]:e.target.value }))}
                        style={{ width:'100%', padding:'7px 10px', fontSize:12, border:'2px solid #ede9f7', borderRadius:7, outline:'none', background:'#fff' }}>
                        <option value=''>— skip —</option>
                        {dstFields.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:999, background: mapped ? '#d1fae5':'#f4f2fc', color: mapped ? '#065f46':'#aaa' }}>
                        {mapped ? 'mapped' : 'unmapped'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
        <button onClick={() => navigate('/merge')} style={GB}>← Back to merge</button>
        <button disabled={!sourceId || !destId} onClick={() => navigate('/sync', { state:{ ...state, sourceId, destId, fieldMap } })} style={{ ...PB, opacity:(!sourceId||!destId) ? 0.5:1 }}>
          Configure sync →
        </button>
      </div>
    </div>
  )
}

const C   = { background:'#fff', border:'1px solid #ede9f7', borderRadius:14, padding:'24px', marginBottom:20 }
const CH  = { fontSize:16, fontWeight:600, margin:'0 0 16px', color:'#1a1744' }
const L   = { fontSize:13, fontWeight:500, color:'#444', display:'block', marginBottom:6 }
const SEL = { width:'100%', padding:'10px 14px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, outline:'none', background:'#fff' }
const PB  = { padding:'10px 20px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }
const GB  = { padding:'10px 20px', background:'#fff', color:'#666', border:'2px solid #ede9f7', borderRadius:8, fontSize:13, cursor:'pointer' }
const TH  = { textAlign:'left', padding:'12px 16px', fontSize:12, fontWeight:600, color:'#888', borderBottom:'2px solid #ede9f7' }
const TD  = { padding:'10px 16px', borderBottom:'1px solid #f4f2fc', verticalAlign:'middle' }
