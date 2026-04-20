// frontend/src/pages/Login.jsx
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
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoDot} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px' }}>Clean<span style={{ color: '#534AB7' }}>'</span>Sync</div>
            <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.04em', marginTop: 1 }}>by Nex-a Tech Solutions</div>
          </div>
        </div>

        {sent ? (
          <div style={styles.sentBox}>
            <div style={styles.sentIcon}>✓</div>
            <h2 style={styles.h2}>Check your email</h2>
            <p style={styles.sub}>We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.</p>
            <button style={styles.linkBtn} onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <>
            <h2 style={styles.h2}>Sign in</h2>
            <p style={styles.sub}>Enter your email and we'll send you a magic link — no password needed.</p>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={styles.input}
                autoFocus
              />
              {error && <div style={styles.error}>{error}</div>}
              <button type="submit" disabled={loading} style={styles.btn}>
                {loading ? 'Sending…' : 'Send magic link →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7ff', fontFamily: 'system-ui, sans-serif' },
  card: { background: '#fff', border: '1px solid #e5e3f7', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 400 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoDot: { width: 28, height: 28, borderRadius: 7, background: '#534AB7' },
  h2: { fontSize: 20, fontWeight: 500, margin: '0 0 8px' },
  sub: { fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '10px 14px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none' },
  btn: { padding: '11px 0', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  error: { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 6, padding: '8px 12px' },
  sentBox: { textAlign: 'center', padding: '8px 0' },
  sentIcon: { width: 48, height: 48, borderRadius: '50%', background: '#E1F5EE', color: '#1D9E75', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  linkBtn: { background: 'none', border: 'none', color: '#534AB7', cursor: 'pointer', fontSize: 13, marginTop: 12 },
}
