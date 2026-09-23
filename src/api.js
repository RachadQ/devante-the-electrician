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

function cookie(name) {
  return document.cookie.split('; ').find((item) => item.startsWith(`${name}=`))?.split('=').slice(1).join('=')
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
  const method = options.method || 'GET'
  const headers = { Accept: 'application/json', ...options.headers }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
    const csrf = cookie('csrf_token')
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf)
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, method, headers, credentials: 'include' })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.detail || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return sanitizeExternalUrls(data)
}

export const signInUrl = `${API_URL}/auth/microsoft/login`
