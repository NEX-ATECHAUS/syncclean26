// frontend/src/api.js
// Centralised API client. All fetch calls go through here.

const BASE = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('access_token')
}

async function request(method, path, body, isStream = false) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    // Try refresh
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      const r = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (r.ok) {
        const data = await r.json()
        localStorage.setItem('access_token', data.accessToken)
        // Retry original request
        return request(method, path, body, isStream)
      }
    }
    localStorage.clear()
    window.location.href = '/login'
    return
  }

  if (isStream) return res
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  // Auth
  sendMagicLink: (email) => request('POST', '/auth/magic', { email }),
  verifyToken: (token) => request('GET', `/auth/verify?token=${token}`),
  getMe: () => request('GET', '/auth/me'),
  updateMe: (name) => request('PATCH', '/auth/me', { name }),

  // Connectors
  getConnections: () => request('GET', '/connectors'),
  addConnection: (platform, credentials, displayName) =>
    request('POST', '/connectors', { platform, credentials, displayName }),
  deleteConnection: (id) => request('DELETE', `/connectors/${id}`),
  testConnection: (id) => request('GET', `/connectors/${id}/test`),
  getModules: (id) => request('GET', `/connectors/${id}/modules`),
  getRecords: (id, module, page = 1, pageSize = 100) =>
    request('GET', `/connectors/${id}/records/${module}?page=${page}&pageSize=${pageSize}`),
  getOAuthUrl: (platform) => request('GET', `/connectors/${platform}/oauth/start`),

  // AI
  analyseDocs: (url) => request('POST', '/ai/analyse-docs', { url }),
  analyseDocsStream: (url) => request('POST', '/ai/analyse-docs/stream', { url }, true),
  suggestMappings: (sourceFields, destFields, sourcePlatform, destPlatform) =>
    request('POST', '/ai/suggest-mappings', { sourceFields, destFields, sourcePlatform, destPlatform }),
  detectDuplicates: (records, rules) =>
    request('POST', '/ai/detect-duplicates', { records, rules }),

  // Sync
  getJobs: () => request('GET', '/sync/jobs'),
  createJob: (payload) => request('POST', '/sync/jobs', payload),
  runJob: (id) => request('POST', `/sync/jobs/${id}/run`, {}, true),
  getJobRuns: (id) => request('GET', `/sync/jobs/${id}/runs`),
  previewDupes: (connectionId, module, rules) =>
    request('POST', '/sync/preview-dupes', { connectionId, module, rules }),
}

// SSE helper — parses a stream and calls onEvent for each message
export async function consumeSSE(response, onEvent) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop()
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim()
      if (!line) continue
      try { onEvent(JSON.parse(line)) } catch {}
    }
  }
}
