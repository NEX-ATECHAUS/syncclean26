// frontend/src/pages/Verify.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../AuthContext'

export default function Verify() {
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setError('No token in URL'); return }

    api.verifyToken(token)
      .then(data => {
        login(data.accessToken, data.refreshToken, data.user)
        navigate('/dashboard', { replace: true })
      })
      .catch(err => setError(err.message))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      {error
        ? <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#c0392b', marginBottom: 12 }}>{error}</p>
            <a href="/login" style={{ color: '#534AB7' }}>Back to sign in</a>
          </div>
        : <p style={{ color: '#666' }}>Signing you in…</p>
      }
    </div>
  )
}
