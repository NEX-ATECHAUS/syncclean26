import { useState, useEffect } from 'react'
import { api } from '../api'

const PLATFORM_META = {
  hubspot:     { name:'HubSpot',      color:'#FF7A59', abbr:'HS', type:'CRM',       auth:'OAuth 2.0',      docs:'https://developers.hubspot.com/docs/api/overview' },
  salesforce:  { name:'Salesforce',   color:'#00A1E0', abbr:'SF', type:'CRM',       auth:'OAuth 2.0',      docs:'https://developer.salesforce.com/docs/apis' },
  pipedrive:   { name:'Pipedrive',    color:'#1A1F71', abbr:'PD', type:'CRM',       auth:'API Key',        docs:'https://developers.pipedrive.com/docs/api/v1' },
  monday:      { name:'Monday.com',   color:'#FF3D57', abbr:'MN', type:'Work OS',   auth:'API Key',        docs:'https://developer.monday.com/api-reference' },
  gohighlevel: { name:'GoHighLevel',  color:'#039855', abbr:'GHL',type:'CRM',       auth:'OAuth 2.0',      docs:'https://highlevel.stoplight.io/docs/integrations' },
  airtable:    { name:'Airtable',     color:'#FCB400', abbr:'AT', type:'Database',  auth:'API Key',        docs:'https://airtable.com/developers/web/api/introduction' },
  zoho:        { name:'Zoho CRM',     color:'#E42527', abbr:'ZO', type:'CRM',       auth:'OAuth 2.0',      docs:'https://www.zoho.com/crm/developer/docs/api/v6' },
}

export default function Connections() {
  const [connections, setConnections] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState({})
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const d = await api.getConnections()
      setConnections((d.connections || []).filter(Boolean))
    } catch {}
  }

  async function handleConnect(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const meta = PLATFORM_META[selected]
      if (meta.auth === 'OAuth 2.0') {
        const { url } = await api.getOAuthUrl(selected)
        window.location.href = url
        return
      }
      await api.addConnection(selected, form, meta.name)
      await load()
      setSelected(null)
      setForm({})
    } catch (err) {
      setError(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleTest(id) {
    setTestResults(t => ({ ...t, [id]: 'testing' }))
    try {
      await api.testConnection(id)
      setTestResults(t => ({ ...t, [id]: 'ok' }))
      load()
    } catch {
      setTestResults(t => ({ ...t, [id]: 'error' }))
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this connection?')) return
    await api.deleteConnection(id)
    load()
  }

  const connectedPlatforms = new Set(connections.filter(Boolean).map(c => c.platform))

  return (
    <div style={{ padding:'40px', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>Platform connections</h1>
      <p style={{ color:'#888', margin:'0 0 32px', fontSize:14 }}>Connect your CRMs. Credentials are AES-256 encrypted at rest.</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:28 }}>
        {Object.entries(PLATFORM_META).map(([id, meta]) => {
          const conn = connections.find(c => c && c.platform === id)
          const isConnected = !!conn
          const isSelected = selected === id
          return (
            <div key={id}
              onClick={() => !isConnected && setSelected(isSelected ? null : id)}
              style={{
                border: isConnected ? `2px solid ${meta.color}` : isSelected ? '2px solid #7c3aed' : '2px solid #ede9f7',
                borderRadius:14, padding:'18px', cursor: isConnected ? 'default' : 'pointer',
                background: isConnected ? `${meta.color}08` : isSelected ? '#f5f3ff' : '#fff',
                transition:'all .15s'
              }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:`${meta.color}22`, color:meta.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{meta.abbr}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1744' }}>{meta.name}</div>
                  <div style={{ fontSize:11, color:'#aaa' }}>{meta.type}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color: isConnected ? '#059669' : '#aaa', marginBottom: isConnected ? 10 : 0 }}>
                {isConnected ? '● connected' : `○ ${meta.auth}`}
              </div>
              {isConnected && (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={e => { e.stopPropagation(); handleTest(conn.id) }}
                    style={{ flex:1, padding:'5px 0', fontSize:11, border:'1px solid #e0ddf7', borderRadius:6, background:'#fff', cursor:'pointer', color:'#7c3aed', fontWeight:500 }}>
                    {testResults[conn.id] === 'testing' ? '...' : testResults[conn.id] === 'ok' ? '✓ OK' : testResults[conn.id] === 'error' ? '✗ Fail' : 'Test'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(conn.id) }}
                    style={{ flex:1, padding:'5px 0', fontSize:11, border:'1px solid #fee2e2', borderRadius:6, background:'#fff', cursor:'pointer', color:'#dc2626', fontWeight:500 }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selected && !connectedPlatforms.has(selected) && (
        <div style={{ background:'#fff', border:'2px solid #7c3aed', borderRadius:16, padding:'28px', maxWidth:520 }}>
          <h3 style={{ fontSize:17, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>Connect {PLATFORM_META[selected]?.name}</h3>
          <p style={{ fontSize:13, color:'#888', margin:'0 0 20px' }}>
            {PLATFORM_META[selected]?.auth === 'OAuth 2.0'
              ? `You'll be redirected to ${PLATFORM_META[selected]?.name} to authorise access.`
              : 'Enter your API credentials below.'}
          </p>
          <form onSubmit={handleConnect} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {PLATFORM_META[selected]?.auth === 'API Key' && (
              <>
                <label style={{ fontSize:13, fontWeight:500, color:'#444' }}>
                  API key
                  <input type="password" required value={form.api_key || ''} onChange={e => setForm({ ...form, api_key: e.target.value })}
                    style={{ display:'block', width:'100%', padding:'10px 14px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, marginTop:4, boxSizing:'border-box', outline:'none' }} />
                </label>
                {selected === 'pipedrive' && (
                  <label style={{ fontSize:13, fontWeight:500, color:'#444' }}>
                    Company domain
                    <input value={form.domain || ''} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="yourcompany.pipedrive.com"
                      style={{ display:'block', width:'100%', padding:'10px 14px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, marginTop:4, boxSizing:'border-box', outline:'none' }} />
                  </label>
                )}
                {selected === 'airtable' && (
                  <label style={{ fontSize:13, fontWeight:500, color:'#444' }}>
                    Base ID
                    <input value={form.base_id || ''} onChange={e => setForm({ ...form, base_id: e.target.value })} placeholder="appXXXXXXXXXXXXXX"
                      style={{ display:'block', width:'100%', padding:'10px 14px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, marginTop:4, boxSizing:'border-box', outline:'none' }} />
                  </label>
                )}
                {selected === 'monday' && (
                  <label style={{ fontSize:13, fontWeight:500, color:'#444' }}>
                    Board ID (optional)
                    <input value={form.board_id || ''} onChange={e => setForm({ ...form, board_id: e.target.value })}
                      style={{ display:'block', width:'100%', padding:'10px 14px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, marginTop:4, boxSizing:'border-box', outline:'none' }} />
                  </label>
                )}
              </>
            )}
            {error && <div style={{ fontSize:13, color:'#dc2626', background:'#fee2e2', borderRadius:8, padding:'10px 14px' }}>{error}</div>}
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={() => { setSelected(null); setForm({}); setError('') }}
                style={{ padding:'10px 18px', background:'#fff', color:'#666', border:'2px solid #ede9f7', borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancel</button>
              <a href={PLATFORM_META[selected]?.docs} target="_blank" rel="noreferrer"
                style={{ padding:'10px 18px', background:'#fff', color:'#7c3aed', border:'2px solid #ede9f7', borderRadius:8, fontSize:13, cursor:'pointer', textDecoration:'none' }}>Docs ↗</a>
              <button type="submit" disabled={loading}
                style={{ flex:1, padding:'10px', background: loading ? '#9b8fe0' : '#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Connecting…' : PLATFORM_META[selected]?.auth === 'OAuth 2.0' ? `Authorise ${PLATFORM_META[selected]?.name} →` : `Connect ${PLATFORM_META[selected]?.name} →`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
