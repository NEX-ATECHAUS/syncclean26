import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Rules() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}
  const [rules, setRules] = useState({ emailMatch:'exact', nameMatch:'fuzzy', nameSimilarityThreshold:0.8, companyMatch:'normalise', phoneMatch:'ignore', mergeStrategy:'most_complete' })
  const set = (k,v) => setRules(r => ({ ...r, [k]:v }))

  const fields = [
    { key:'emailMatch',   label:'email',   opts:[['exact','Exact match'],['domain','Domain match'],['ignore','Ignore']] },
    { key:'nameMatch',    label:'name',    opts:[['fuzzy','Fuzzy match'],['exact','Exact match'],['ignore','Ignore']] },
    { key:'companyMatch', label:'company', opts:[['normalise','Normalise & match'],['exact','Exact match'],['ignore','Ignore']] },
    { key:'phoneMatch',   label:'phone',   opts:[['ignore','Ignore'],['exact','Exact match']] },
  ]

  const strategies = [
    { val:'most_complete', label:'Keep most complete record as master' },
    { val:'newest',        label:'Keep most recently updated as master' },
    { val:'prefer_source_a', label:'Always prefer source platform as master' },
  ]

  return (
    <div style={{ padding:'40px', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 4px', color:'#1a1744' }}>Dedup rules</h1>
      <p style={{ color:'#888', margin:'0 0 32px', fontSize:14 }}>Configure how duplicates are detected and which record wins the merge.</p>

      <div style={C}>
        <h3 style={CH}>Match logic</h3>
        {fields.map(f => (
          <div key={f.key} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 0', borderBottom:'1px solid #f4f2fc' }}>
            <code style={{ background:'#f0eef8', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600, color:'#7c3aed', minWidth:80, textAlign:'center' }}>{f.label}</code>
            <div style={{ flex:1, fontSize:14, color:'#444' }}>
              {f.key === 'emailMatch' && 'How to match email addresses'}
              {f.key === 'nameMatch' && 'How to match full names'}
              {f.key === 'companyMatch' && 'How to match company names'}
              {f.key === 'phoneMatch' && 'How to match phone numbers'}
            </div>
            <select value={rules[f.key]} onChange={e => set(f.key, e.target.value)}
              style={{ padding:'8px 12px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, outline:'none', background:'#fff' }}>
              {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {f.key === 'nameMatch' && rules.nameMatch === 'fuzzy' && (
              <select value={rules.nameSimilarityThreshold} onChange={e => set('nameSimilarityThreshold', parseFloat(e.target.value))}
                style={{ padding:'8px 12px', fontSize:13, border:'2px solid #ede9f7', borderRadius:8, outline:'none', background:'#fff', width:90 }}>
                <option value={0.7}>70%</option><option value={0.8}>80%</option><option value={0.9}>90%</option>
              </select>
            )}
          </div>
        ))}
      </div>

      <div style={C}>
        <h3 style={CH}>Merge strategy</h3>
        {strategies.map(s => (
          <label key={s.val} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:10, cursor:'pointer', marginBottom:8, border:`2px solid ${rules.mergeStrategy === s.val ? '#7c3aed' : '#ede9f7'}`, background: rules.mergeStrategy === s.val ? '#f5f3ff' : '#fff' }}>
            <input type="radio" name="merge" value={s.val} checked={rules.mergeStrategy === s.val} onChange={() => set('mergeStrategy', s.val)} style={{ accentColor:'#7c3aed' }} />
            <span style={{ fontSize:14, color:'#333' }}>{s.label}</span>
          </label>
        ))}
      </div>

      <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
        <button onClick={() => navigate('/scan')} style={GB}>← Back to scan</button>
        <button onClick={() => navigate('/merge', { state:{ ...state, rules } })} style={PB}>Preview merges →</button>
      </div>
    </div>
  )
}

const C  = { background:'#fff', border:'1px solid #ede9f7', borderRadius:14, padding:'24px', marginBottom:20 }
const CH = { fontSize:16, fontWeight:600, margin:'0 0 16px', color:'#1a1744' }
const PB = { padding:'10px 20px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }
const GB = { padding:'10px 20px', background:'#fff', color:'#666', border:'2px solid #ede9f7', borderRadius:8, fontSize:13, cursor:'pointer' }
