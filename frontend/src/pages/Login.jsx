import { useState } from 'react'
import { api } from '../api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.sendMagicLink(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:'"Inter",-apple-system,sans-serif', background:'#f5f4ff' }}>
      <div style={{ width:'50%', background:'#1a1744', display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 80px' }}>
        <div style={{ fontSize:32, fontWeight:700, color:'#fff', marginBottom:12 }}>Clean<span style={{ color:'#a78bfa' }}>'</span>Sync</div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', letterSpacing:'0.08em', marginBottom:48 }}>NEX-A TECH SOLUTIONS</div>
        <div style={{ fontSize:22, fontWeight:500, color:'#fff', marginBottom:16, lineHeight:1.4 }}>Clean your CRM data.<br/>Sync it anywhere.</div>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.7 }}>Connect any CRM, detect and merge duplicates, map fields, and sync clean data across platforms — powered by AI.</p>
        <div style={{ marginTop:48, display:'flex', flexDirection:'column', gap:12 }}>
          {['HubSpot','Salesforce','Pipedrive','Monday.com','GoHighLevel','Airtable','Zoho CRM','Any REST API'].map(p => (
            <div key={p} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'rgba(255,255,255,0.5)' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#a78bfa' }} />{p}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ width:'100%', maxWidth:420 }}>
          {sent ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#e8f5e9', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', fontSize:28 }}>✓</div>
              <h2 style={{ fontSize:22, fontWeight:600, margin:'0 0 8px' }}>Check your email</h2>
              <p style={{ color:'#666', fontSize:14, margin:'0 0 24px' }}>We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.</p>
              <button onClick={() => setSent(false)} style={{ background:'none', border:'none', color:'#7c3aed', cursor:'pointer', fontSize:13 }}>Use a different email</button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize:26, fontWeight:700, margin:'0 0 8px', color:'#1a1744' }}>Sign in</h2>
              <p style={{ color:'#888', fontSize:14, margin:'0 0 32px' }}>No password needed — we'll email you a magic link.</p>
              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:500, color:'#444', display:'block', marginBottom:6 }}>Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required
                    style={{ width:'100%', padding:'12px 16px', fontSize:14, border:'2px solid #e8e6f7', borderRadius:10, outline:'none', boxSizing:'border-box' }} autoFocus />
                </div>
                {error && <div style={{ fontSize:13, color:'#c0392b', background:'#fdf0ef', borderRadius:8, padding:'10px 14px' }}>{error}</div>}
                <button type="submit" disabled={loading}
                  style={{ padding:'13px', background: loading ? '#9b8fe0' : '#7c3aed', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Sending…' : 'Send magic link →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
