
// Central place for calls to the Node.js/Express backend.
// The frontend should call Express, never call MongoDB or FastAPI directly.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
const TOKEN_KEY = 'medimind-token'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token, remember = true) {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  } catch { /* storage unavailable */ }
}

function query(params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, value)
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function send(path, options = {}) {
  const { body, headers, ...rest } = options
  const token = getToken()
  const isForm = body instanceof FormData
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: { ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body && !isForm ? JSON.stringify(body) : body,
  })
  if (response.status === 401 && token) window.dispatchEvent(new Event('medimind:unauthorized'))
  return response
}

export async function apiRequest(path, options = {}) {
  const response = await send(path, options)
  if (response.status === 204) return {}
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.message || 'Unable to complete the request.')
    error.status = response.status
    error.details = body.details
    throw error
  }
  return body
}

export async function apiDownload(path, filename) {
  const response = await send(path)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || 'Unable to download the file.')
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const authApi = {
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  register: (patient) => apiRequest('/auth/register', { method: 'POST', body: patient }),
  me: () => apiRequest('/auth/me'),
}

export const doctorApi = {
  path: (params) => `/doctors${query(params)}`,
  slotsPath: (id, date) => `/doctors/${id}/slots${query({ date })}`,
  create: (doctor) => apiRequest('/doctors', { method: 'POST', body: doctor }),
  update: (id, changes) => apiRequest(`/doctors/${id}`, { method: 'PUT', body: changes }),
  setVerification: (id, verificationStatus) => apiRequest(`/doctors/${id}/verification`, { method: 'PATCH', body: { verificationStatus } }),
}

export const appointmentApi = {
  path: (params) => `/appointments${query(params)}`,
  book: (appointment) => apiRequest('/appointments', { method: 'POST', body: appointment }),
  reschedule: (id, startAt) => apiRequest(`/appointments/${id}`, { method: 'PATCH', body: { startAt } }),
  setStatus: (id, status, cancellationReason) => apiRequest(`/appointments/${id}`, { method: 'PATCH', body: { status, ...(cancellationReason ? { cancellationReason } : {}) } }),
}

export const patientApi = {
  path: (params) => `/patients${query(params)}`,
  update: (id, changes) => apiRequest(`/patients/${id}`, { method: 'PUT', body: changes }),
}

export const recordApi = {
  path: (params) => `/medical-records${query(params)}`,
  patientPath: (id, params) => `/medical-records/patient/${id}${query(params)}`,
  create: (record) => apiRequest('/medical-records', { method: 'POST', body: record }),
}

export const documentApi = {
  path: (params) => `/documents${query(params)}`,
  upload: (file, fields = {}) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value)
    form.append('file', file)
    return apiRequest('/documents', { method: 'POST', body: form })
  },
  download: (document) => apiDownload(`/documents/${document.id}/download`, document.name),
}

export const aiApi = {
  ask: (message, conversationId) => apiRequest('/ai/chat', { method: 'POST', body: { message, ...(conversationId ? { conversationId } : {}) } }),
}

export const analyticsApi = {
  overviewPath: (params) => `/analytics/overview${query(params)}`,
  mePath: '/analytics/me',
}

export const notificationApi = {
  path: (params) => `/notifications${query(params)}`,
  readAll: () => apiRequest('/notifications/read-all', { method: 'PATCH' }),
}

export const settingsApi = {
  path: '/settings',
  update: (changes) => apiRequest('/settings', { method: 'PUT', body: changes }),
}
