// frontend/src/pages/Connections.jsx
import { useState, useEffect } from 'react'
import { api } from '../api'

const PLATFORM_COLORS = {
  hubspot: '#FF7A59', salesforce: '#00A1E0', pipedrive: '#1A1F71',
  monday: '#FF3D57', gohighlevel: '#039855', airtable: '#FCB400', zoho: '#E42527',
}

export default function Connections() {
  const [connections, setConnections] = useState([])
  const [platforms, setPlatforms] = useState({})
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await api.getConnections()
      setConnections(data.connections)
      setPlatforms(data.platforms)
    } catch (e) { setError(e.message) }
  }

  function selectPlatform(id) {
    setSelected(id)
    setForm({})
    setTestResult(null)
    setError('')
  }

  async function handleConnect(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const meta = platforms[selected]
      if (meta.authType === 'oauth2') {
        const { url } = await api.getOAuthUrl(selected)
        window.location.href = url
        return
      }
      await api.addConnection(selected, form, meta.name)
      await load()
      setSelected(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleTest(id) {
    setTestResult({ id, status: 'testing' })
    try {
      const r = await api.testConnection(id)
      setTestResult({ id, status: 'ok', msg: r.user || r.location || 'Connected' })
      load()
    } catch (err) {
      setTestResult({ id, status: 'error', msg: err.message })
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this connection?')) return
    await api.deleteConnection(id)
    load()
  }

  const connectedIds = new Set(connections.map(c => c.platform))

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Platform connections</h1>
      <p style={s.sub}>Connect your CRMs and tools. Credentials are encrypted at rest.</p>

      {error && <div style={s.error}>{error}</div>}

      <div style={s.grid}>
        {Object.entries(platforms).map(([id, meta]) => {
          const conn = connections.find(c => c.platform === id)
          const isConnected = !!conn
          const color = PLATFORM_COLORS[id] || '#534AB7'
          const isActive = selected === id

          return (
            <div
              key={id}
              style={{ ...s.platCard, ...(isActive ? s.platCardActive : {}), ...(isConnected ? s.platCardConnected : {}) }}
              onClick={() => !isConnected && selectPlatform(id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ ...s.platIcon, background: color + '22', color }}>{id.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={s.platName}>{meta.name}</div>
                  <div style={s.platType}>{meta.type} · {meta.authType}</div>
                </div>
              </div>
              <div style={{ ...s.platStatus, color: isConnected ? '#1D9E75' : '#999' }}>
                {isConnected ? '● connected' : '○ not connected'}
              </div>

              {isConnected && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button style={s.btnSm} onClick={e => { e.stopPropagation(); handleTest(conn.id) }}>
                    {testResult?.id === conn.id && testResult.status === 'testing' ? 'Testing…' : 'Test'}
                  </button>
                  <button style={{ ...s.btnSm, color: '#c0392b' }} onClick={e => { e.stopPropagation(); handleDelete(conn.id) }}>Remove</button>
                </div>
              )}
              {testResult?.id === conn?.id && testResult.status !== 'testing' && (
                <div style={{ fontSize: 11, marginTop: 6, color: testResult.status === 'ok' ? '#1D9E75' : '#c0392b' }}>
                  {testResult.msg}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selected && !connectedIds.has(selected) && (
        <div style={s.formCard}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500 }}>Connect {platforms[selected]?.name}</h3>
          <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
            {platforms[selected]?.authType === 'oauth2'
              ? `Clicking Connect will open the ${platforms[selected]?.name} authorization page.`
              : 'Enter your API credentials below.'}
          </p>

          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {platforms[selected]?.authType === 'api_key' && (
              <>
                <label style={s.label}>API key
                  <input style={s.input} type="password" required value={form.api_key || ''} onChange={e => setForm({ ...form, api_key: e.target.value })} />
                </label>
                {selected === 'pipedrive' && (
                  <label style={s.label}>Company domain (yourcompany.pipedrive.com)
                    <input style={s.input} value={form.domain || ''} onChange={e => setForm({ ...form, domain: e.target.value })} />
                  </label>
                )}
                {selected === 'airtable' && (
                  <label style={s.label}>Base ID (appXXXXXXXXXXXXXX)
                    <input style={s.input} value={form.base_id || ''} onChange={e => setForm({ ...form, base_id: e.target.value })} />
                  </label>
                )}
                {selected === 'monday' && (
                  <label style={s.label}>Board ID (optional)
                    <input style={s.input} value={form.board_id || ''} onChange={e => setForm({ ...form, board_id: e.target.value })} />
                  </label>
                )}
              </>
            )}

            {error && <div style={s.error}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" style={s.btnGhost} onClick={() => setSelected(null)}>Cancel</button>
              <a href={platforms[selected]?.docsUrl} target="_blank" rel="noreferrer" style={{ ...s.btnGhost, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>API docs ↗</a>
              <button type="submit" disabled={loading} style={s.btnPrimary}>
                {loading ? 'Connecting…' : `Connect ${platforms[selected]?.name} →`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: '28px 24px', maxWidth: 860, fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 20, fontWeight: 500, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#666', margin: '0 0 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 16 },
  platCard: { border: '1.5px solid #e8e6f8', borderRadius: 12, padding: '14px', cursor: 'pointer', transition: 'border-color .15s' },
  platCardActive: { borderColor: '#534AB7', background: '#f5f4ff' },
  platCardConnected: { borderColor: '#1D9E75', background: '#f0faf5', cursor: 'default' },
  platIcon: { width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 },
  platName: { fontSize: 13, fontWeight: 500 },
  platType: { fontSize: 11, color: '#999' },
  platStatus: { fontSize: 11 },
  btnSm: { padding: '4px 10px', fontSize: 11, border: '1px solid #e0ddf7', borderRadius: 6, background: '#fff', cursor: 'pointer' },
  formCard: { background: '#fff', border: '1px solid #e8e6f8', borderRadius: 12, padding: 20, maxWidth: 500, marginTop: 8 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' },
  input: { padding: '9px 12px', fontSize: 13, border: '1px solid #ddd', borderRadius: 8, marginTop: 2 },
  error: { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 6, padding: '8px 12px' },
  btnPrimary: { padding: '9px 18px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnGhost: { padding: '9px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
}
