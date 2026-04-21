// frontend/src/pages/Rules.jsx
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const DEFAULT_RULES = {
  emailMatch: 'exact',
  nameMatch: 'fuzzy',
  nameSimilarityThreshold: 0.8,
  companyMatch: 'normalise',
  phoneMatch: 'ignore',
  mergeStrategy: 'most_complete',
}

export default function Rules() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}
  const [rules, setRules] = useState(DEFAULT_RULES)

  function set(key, val) { setRules(r => ({ ...r, [key]: val })) }

  function proceed() {
    navigate('/merge', { state: { ...state, rules } })
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Dedup rules</h1>
      <p style={s.sub}>Configure how duplicates are detected and which record wins the merge.</p>

      <div style={s.card}>
        <div style={s.cardHead}>Match logic</div>
        <div style={s.fieldRow}>
          <code style={s.pill}>email</code>
          <span style={s.fieldLabel}>Email matching</span>
          <select style={s.select} value={rules.emailMatch} onChange={e => set('emailMatch', e.target.value)}>
            <option value='exact'>Exact match</option>
            <option value='domain'>Same domain only</option>
            <option value='ignore'>Ignore</option>
          </select>
        </div>
        <div style={s.fieldRow}>
          <code style={s.pill}>name</code>
          <span style={s.fieldLabel}>Name matching</span>
          <select style={s.select} value={rules.nameMatch} onChange={e => set('nameMatch', e.target.value)}>
            <option value='fuzzy'>Fuzzy match</option>
            <option value='exact'>Exact match</option>
            <option value='ignore'>Ignore</option>
          </select>
          {rules.nameMatch === 'fuzzy' && (
            <select style={{ ...s.select, maxWidth: 100 }} value={rules.nameSimilarityThreshold} onChange={e => set('nameSimilarityThreshold', parseFloat(e.target.value))}>
              <option value={0.7}>70%</option>
              <option value={0.8}>80%</option>
              <option value={0.9}>90%</option>
            </select>
          )}
        </div>
        <div style={s.fieldRow}>
          <code style={s.pill}>company</code>
          <span style={s.fieldLabel}>Company matching</span>
          <select style={s.select} value={rules.companyMatch} onChange={e => set('companyMatch', e.target.value)}>
            <option value='normalise'>Normalise & match</option>
            <option value='exact'>Exact match</option>
            <option value='ignore'>Ignore</option>
          </select>
        </div>
        <div style={s.fieldRow}>
          <code style={s.pill}>phone</code>
          <span style={s.fieldLabel}>Phone matching</span>
          <select style={s.select} value={rules.phoneMatch} onChange={e => set('phoneMatch', e.target.value)}>
            <option value='ignore'>Ignore</option>
            <option value='exact'>Exact match</option>
          </select>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardHead}>Merge strategy</div>
        {[
          { val: 'most_complete', label: 'Keep most complete record as master' },
          { val: 'newest', label: 'Keep most recently updated as master' },
          { val: 'prefer_source_a', label: 'Always prefer source platform as master' },
        ].map(opt => (
          <label key={opt.val} style={s.radioRow}>
            <input type='radio' name='merge' value={opt.val} checked={rules.mergeStrategy === opt.val} onChange={() => set('mergeStrategy', opt.val)} />
            {opt.label}
          </label>
        ))}
      </div>

      <div style={s.actions}>
        <button style={s.btnGhost} onClick={() => navigate('/scan')}>← Back to scan</button>
        <button style={s.btnPrimary} onClick={proceed}>Preview merges →</button>
      </div>
    </div>
  )
}

const s = {
  page: { padding: '28px 24px', maxWidth: 680, fontFamily: 'system-ui, sans-serif' },
  h1: { fontSize: 20, fontWeight: 500, margin: '0 0 4px' },
  sub: { fontSize: 13, color: '#666', margin: '0 0 20px' },
  card: { background: '#fff', border: '1px solid #ede9f7', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHead: { fontSize: 13, fontWeight: 500, marginBottom: 14 },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f4f2fc' },
  pill: { background: '#f0eef8', borderRadius: 4, padding: '2px 7px', fontSize: 11, minWidth: 60, textAlign: 'center' },
  fieldLabel: { flex: 1, fontSize: 12, color: '#666' },
  select: { fontSize: 12, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 7 },
  radioRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer' },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 },
  btnPrimary: { padding: '9px 18px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnGhost: { padding: '9px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
}
