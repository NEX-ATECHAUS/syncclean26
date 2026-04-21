// frontend/src/pages/CustomApi.jsx
import { useState } from 'react'
import { api, consumeSSE } from '../api'

const STEPS = ['Paste URL', 'AI analysis', 'Auth', 'Modules', 'Fields']

const QUICK = [
  { label: 'Freshsales', url: 'https://developers.freshsales.io/api' },
  { label: 'Freshdesk', url: 'https://developers.freshdesk.com/api' },
  { label: 'Intercom', url: 'https://developers.intercom.com/docs/rest-apis' },
  { label: 'Close CRM', url: 'https://developer.close.com' },
  { label: 'Copper CRM', url: 'https://developer.copper.com' },
  { label: 'ActiveCampaign', url: 'https://developers.activecampaign.com/reference' },
]

export default function CustomApi() {
  const [step, setStep] = useState(0)
  const [url, setUrl] = useState('')
  const [logs, setLogs] = useState([])
  const [result, setResult] = useState(null)
  const [authForm, setAuthForm] = useState({})
  const [selectedModules, setSelectedModules] = useState({})
  const [fieldSelections, setFieldSelections] = useState({})
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')

  function addLog(text, level = '') {
    setLogs(l => [...l, { text, level, ts: Date.now() }])
  }

  async function runAnalysis() {
    if (!url) return
    setLogs([])
    setError('')
    setAnalysing(true)
    setStep(1)

    try {
      addLog('Fetching documentation page...', 'info')
      const res = await api.analyseDocsStream(url)

      await consumeSSE(res, (event) => {
        if (event.type === 'log') addLog(event.text, event.level)
        if (event.type === 'result') {
          setResult(event.data)
          // Pre-populate auth form
          setAuthForm({
            base_url: event.data.base_url || '',
            header_name: event.data.auth?.details?.header_name || 'Authorization',
            header_format: event.data.auth?.details?.header_format || 'Bearer {token}',
          })
          // Pre-select all modules
          const mods = {}
          event.data.modules?.forEach(m => { mods[m.name] = true })
          setSelectedModules(mods)
          // Pre-select common fields
          const fields = {}
          event.data.modules?.forEach(m => {
            fields[m.name] = {}
            m.fields?.forEach(f => {
              fields[m.name][f.name] = f.required || ['email','name','first_name','last_name','phone','company','id'].includes(f.name.toLowerCase())
            })
          })
          setFieldSelections(fields)
        }
        if (event.type === 'error') {
          setError(event.text)
          setStep(0)
        }
      })

      setAnalysing(false)
    } catch (err) {
      setError(err.message)
      setStep(0)
      setAnalysing(false)
    }
  }

  const logColor = { ok: '#1D9E75', warn: '#854F0B', info: '#534AB7', error: '#c0392b', '': '#666' }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Custom API connection</h1>
      <p style={s.sub}>Paste any API documentation URL — AI reads it and configures the connection automatically.</p>

      {/* Step tracker */}
      <div style={s.stepTrack}>
        {STEPS.map((st, i) => (
          <span key={st} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...s.stepDot, background: i < step ? '#1D9E75' : i === step ? '#534AB7' : '#e0ddf7', color: i <= step ? '#fff' : '#aaa' }}>
              {i < step ? '✓' : i + 1}
            </span>
            <span style={{ fontSize: 12, color: i === step ? '#534AB7' : i < step ? '#1D9E75' : '#aaa', fontWeight: i === step ? 500 : 400 }}>{st}</span>
            {i < STEPS.length - 1 && <span style={{ color: '#ddd', margin: '0 4px' }}>›</span>}
          </span>
        ))}
      </div>

      {/* Step 0 - URL input */}
      {step === 0 && (
        <div>
          <div style={s.aiBox}>
            Paste any REST API documentation URL. I'll detect auth, enumerate all modules, and pre-select the most useful fields.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input style={{ ...s.input, flex: 1 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://developers.yourapp.com/api/reference" />
            <button style={s.btnPrimary} onClick={runAnalysis} disabled={!url}>Analyse docs →</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK.map(q => (
              <button key={q.label} style={s.chip} onClick={() => setUrl(q.url)}>{q.label}</button>
            ))}
          </div>
          {error && <div style={s.error}>{error}</div>}
        </div>
      )}

      {/* Step 1 - AI analysis log */}
      {step === 1 && (
        <div>
          <div style={s.logBox}>
            {logs.map((l, i) => (
              <div key={i} style={{ color: logColor[l.level] || '#666', lineHeight: 1.8, fontSize: 12 }}>
                {l.text}
              </div>
            ))}
            {analysing && <div style={{ color: '#534AB7', fontSize: 12 }}>▋</div>}
          </div>
          {!analysing && result && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={s.btnPrimary} onClick={() => setStep(2)}>Review auth setup →</button>
            </div>
          )}
        </div>
      )}

      {/* Step 2 - Auth confirm */}
      {step === 2 && result && (
        <div>
          <div style={s.aiBox}>
            I detected <strong>{result.auth?.type}</strong> authentication for <strong>{result.platform_name}</strong>.
            Pre-filled from the docs — add your credentials and confirm.
            <br /><br /><em style={{ fontSize: 12 }}>{result.auth?.instructions}</em>
          </div>
          <div style={s.formCard}>
            <div style={s.row}><span style={s.rowLabel}>Auth type</span><span style={{ ...s.badge, background: '#EEEDFE', color: '#3C3489' }}>{result.auth?.type}</span></div>
            <div style={s.row}><span style={s.rowLabel}>Base URL</span><input style={s.inlineInput} value={authForm.base_url} onChange={e => setAuthForm({ ...authForm, base_url: e.target.value })} /></div>
            {result.auth?.type === 'api_key' && (
              <>
                <div style={s.row}><span style={s.rowLabel}>Header name</span><input style={s.inlineInput} value={authForm.header_name} onChange={e => setAuthForm({ ...authForm, header_name: e.target.value })} /></div>
                <div style={s.row}><span style={s.rowLabel}>Format</span><input style={s.inlineInput} value={authForm.header_format} onChange={e => setAuthForm({ ...authForm, header_format: e.target.value })} /></div>
                <div style={s.row}><span style={s.rowLabel}>API key</span><input style={s.inlineInput} type="password" placeholder="Enter your API key" value={authForm.api_key || ''} onChange={e => setAuthForm({ ...authForm, api_key: e.target.value })} /></div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button style={s.btnGhost} onClick={() => setStep(1)}>← Back</button>
            <button style={s.btnPrimary} onClick={() => setStep(3)}>Confirm & select modules →</button>
          </div>
        </div>
      )}

      {/* Step 3 - Modules */}
      {step === 3 && result && (
        <div>
          <div style={s.aiBox}>
            Found <strong>{result.modules?.length} modules</strong>. Select the ones you want to pull data from.
          </div>
          <div style={s.modGrid}>
            {result.modules?.map(m => (
              <div
                key={m.name}
                style={{ ...s.modCard, ...(selectedModules[m.name] ? s.modCardSel : {}) }}
                onClick={() => setSelectedModules(p => ({ ...p, [m.name]: !p[m.name] }))}
              >
                <div style={s.modName}>{m.name}</div>
                <div style={s.modMeta}>{m.endpoint} · {m.fields?.length || 0} fields</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{m.description}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button style={s.btnGhost} onClick={() => setStep(2)}>← Back</button>
            <button style={s.btnPrimary} onClick={() => setStep(4)}>Review fields →</button>
          </div>
        </div>
      )}

      {/* Step 4 - Fields */}
      {step === 4 && result && (
        <div>
          <div style={s.aiBox}>
            I've pre-selected the most commonly useful fields. Adjust as needed, then proceed to the data scan.
          </div>
          {result.modules?.filter(m => selectedModules[m.name]).map(m => (
            <div key={m.name} style={s.fieldCard}>
              <div style={s.fieldCardHead}>{m.name}</div>
              {m.fields?.map(f => (
                <div key={f.name} style={s.fieldRow}>
                  <code style={s.fieldPill}>{f.name}</code>
                  <span style={{ fontSize: 11, color: '#999', flex: 1, marginLeft: 8 }}>{f.type}</span>
                  {f.required && <span style={{ fontSize: 10, color: '#854F0B', background: '#FAEEDA', padding: '1px 6px', borderRadius: 4, marginRight: 8 }}>required</span>}
                  <input
                    type="checkbox"
                    checked={fieldSelections[m.name]?.[f.name] || false}
                    onChange={e => setFieldSelections(p => ({ ...p, [m.name]: { ...p[m.name], [f.name]: e.target.checked } }))}
                    style={{ width: 14, height: 14, cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button style={s.btnGhost} onClick={() => setStep(3)}>← Back</button>
            <button style={s.btnPrimary} onClick={() => window.location.href = '/scan'}>Scan data →</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: '28px 24px', maxWidth: 720, fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 20, fontWeight: 500, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#666', margin: '0 0 20px' },
  stepTrack: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 20 },
  stepDot: { width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500 },
  aiBox: { background: '#EEEDFE', border: '1px solid #AFA9EC', borderRadius: 10, padding: '13px 15px', fontSize: 13, color: '#3C3489', lineHeight: 1.6, marginBottom: 14 },
  logBox: { background: '#f6f5ff', borderRadius: 10, padding: 14, fontFamily: 'monospace', minHeight: 160 },
  formCard: { border: '1px solid #e8e6f8', borderRadius: 10, padding: '4px 0', marginBottom: 4 },
  row: { display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #f0eef8', gap: 12 },
  rowLabel: { fontSize: 12, color: '#888', width: 110, flexShrink: 0 },
  inlineInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: '#222' },
  badge: { fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999 },
  modGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  modCard: { border: '1.5px solid #e8e6f8', borderRadius: 10, padding: '11px 12px', cursor: 'pointer' },
  modCardSel: { borderColor: '#534AB7', background: '#f5f4ff' },
  modName: { fontSize: 13, fontWeight: 500, marginBottom: 3 },
  modMeta: { fontSize: 11, color: '#999', fontFamily: 'monospace' },
  fieldCard: { border: '1px solid #e8e6f8', borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  fieldCardHead: { fontSize: 13, fontWeight: 500, padding: '10px 14px', background: '#f8f7ff', borderBottom: '1px solid #e8e6f8' },
  fieldRow: { display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid #f4f2fc', fontSize: 12 },
  fieldPill: { background: '#f0eef8', borderRadius: 4, padding: '2px 6px', fontSize: 11 },
  input: { padding: '10px 12px', fontSize: 13, border: '1px solid #ddd', borderRadius: 8 },
  btnPrimary: { padding: '9px 18px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnGhost: { padding: '9px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  chip: { padding: '4px 10px', borderRadius: 999, fontSize: 11, border: '1px solid #e0ddf7', background: '#fff', cursor: 'pointer', color: '#555' },
  error: { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 6, padding: '8px 12px', marginTop: 10 },
}
