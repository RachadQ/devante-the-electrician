function apiOrigin() {
  const configured = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:8002')
  const parsed = new URL(configured, window.location.origin)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('VITE_API_URL must be a safe HTTP(S) origin')
  }
  if (import.meta.env.PROD && parsed.protocol !== 'https:' && !local) {
    throw new Error('VITE_API_URL must use HTTPS outside local development')
  }
  return parsed.origin
}

export const API_URL = apiOrigin()

let csrfToken = ''
let csrfRequest = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfRequest) {
    csrfRequest = api('/auth/csrf').then(data => {
      if (!data.csrf_token) throw new Error('Could not initialize session security. Please sign in again.')
      csrfToken = data.csrf_token
      return csrfToken
    }).finally(() => { csrfRequest = null })
  }
  return csrfRequest
}

function sanitizeExternalUrls(value) {
  if (Array.isArray(value)) return value.map(sanitizeExternalUrls)
  if (!value || typeof value !== 'object') return value
  const clean = { ...value }
  if ('web_url' in clean) {
    try {
      const url = new URL(clean.web_url)
      if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) delete clean.web_url
    } catch { delete clean.web_url }
  }
  return clean
}

export async function api(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path')
  const { responseType, ...requestOptions } = options
  const method = options.method || 'GET'
  const headers = { Accept: responseType === 'blob' ? 'application/pdf' : 'application/json', ...options.headers }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && path !== '/auth/google' && path !== '/public/rfi/responses') {
    headers['X-CSRF-Token'] = await getCsrfToken()
  }
  const response = await fetch(`${API_URL}${path}`, { ...requestOptions, method, headers, credentials: 'include' })
  if (response.status === 204) return null
  if (response.ok && responseType === 'blob') return response.blob()
  const data = await response.json().catch(() => ({}))
  if (response.ok && data.csrf_token) csrfToken = data.csrf_token
  if (response.status === 401 || (response.ok && path === '/auth/logout')) csrfToken = ''
  if (!response.ok) {
    const error = new Error(data.detail || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return sanitizeExternalUrls(data)
}

