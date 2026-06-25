const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function detailMessage(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg ?? JSON.stringify(d)).join(' ')
  }
  if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message)
  return 'Error al iniciar sesión'
}

async function parseResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(detailMessage(data.detail) || fallbackMessage)
  }
  return data
}

/** Sesión por cookie httpOnly (`ecosystem_session`). */
export async function loginRequest(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })
  return parseResponse(res, 'No se pudo iniciar sesión.')
}

export async function getSession() {
  const res = await fetch(`${API_BASE}/api/auth/session`, {
    credentials: 'include',
  })
  if (res.status === 401) {
    throw new Error('No autenticado')
  }
  return parseResponse(res, 'No se pudo validar la sesión.')
}

export async function logoutRequest() {
  const res = await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  return parseResponse(res, 'No se pudo cerrar sesión.')
}

function authHeaders() {
  const token = localStorage.getItem('atv_token') || sessionStorage.getItem('atv_token')
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

// —— ATV Discord: Tickets API ——

export async function listAreas() {
  const res = await fetch(`${API_BASE}/api/areas`, { headers: { ...authHeaders() } })
  return parseResponse(res, 'No se pudieron listar las áreas.')
}

export async function listStaff() {
  const res = await fetch(`${API_BASE}/api/staff`, { headers: { ...authHeaders() } })
  return parseResponse(res, 'No se pudo listar el staff.')
}

export async function listTickets() {
  const res = await fetch(`${API_BASE}/api/tickets`, { headers: { ...authHeaders() } })
  return parseResponse(res, 'No se pudieron listar los tickets.')
}

export async function getTicketDetail(id) {
  const res = await fetch(`${API_BASE}/api/tickets/${id}`, { headers: { ...authHeaders() } })
  return parseResponse(res, 'No se pudo obtener el ticket.')
}

export async function responderTicket(id, respuesta) {
  const res = await fetch(`${API_BASE}/api/tickets/${id}/responder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ respuesta }),
  })
  return parseResponse(res, 'No se pudo responder el ticket.')
}

export async function transferirTicket(id, area_destino_id, nota) {
  const res = await fetch(`${API_BASE}/api/tickets/${id}/transferir`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ area_destino_id, nota }),
  })
  return parseResponse(res, 'No se pudo transferir el ticket.')
}

export async function cerrarTicket(id) {
  const res = await fetch(`${API_BASE}/api/tickets/${id}/cerrar`, {
    method: 'PATCH',
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo cerrar el ticket.')
}

const ENTREGABLE_SLUG_ONBOARDING = 'onboarding'

async function getEntregablePlantilla(slug) {
  const s = encodeURIComponent(String(slug).trim())
  const res = await fetch(`${API_BASE}/entregables/plantillas/${s}/`)
  return parseResponse(res, 'No se pudo cargar la plantilla del entregable.')
}

export async function getOnboardingPlantilla() {
  return getEntregablePlantilla(ENTREGABLE_SLUG_ONBOARDING)
}

export async function validateOnboardingCliente(identificador) {
  const id = encodeURIComponent(String(identificador).trim())
  const res = await fetch(`${API_BASE}/onboarding/validar/${id}/`)
  return parseResponse(res, 'No se pudo validar el cliente.')
}

export async function submitOnboarding(payload) {
  const res = await fetch(`${API_BASE}/onboarding/submit/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo enviar el formulario.')
}
