// Central place for future calls to the Node.js/Express backend.
// The frontend should call Express, never call MongoDB or FastAPI directly.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Unable to complete the request.')
  return body
}

// Replace demonstration state once Express endpoint names and response formats are confirmed.
export const authApi = {
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (patient) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(patient) }),
}

export const aiApi = {
  ask: (message) => apiRequest('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
}
