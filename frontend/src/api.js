const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
const CLAUDE_USAGE_STORAGE_KEY = 'atv_claude_usage_v1'
const CLAUDE_BALANCE_STORAGE_KEY = 'atv_claude_balance_v1'

function detailMessage(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg ?? JSON.stringify(d)).join(' ')
  }
  if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message)
  return 'Error al iniciar sesión'
}

function authHeaders() {
  const token = sessionStorage.getItem('atv_token')
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

function parseStoredUsage() {
  try {
    const raw =
      localStorage.getItem(CLAUDE_USAGE_STORAGE_KEY) ??
      sessionStorage.getItem(CLAUDE_USAGE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getTotalUsageSpentUsd() {
  const all = parseStoredUsage()
  return all.reduce((acc, r) => acc + Number(r.costUsd || 0), 0)
}

function getModelRatesPerMillion(model) {
  const m = String(model || '').toLowerCase()
  if (m.includes('haiku')) return { input: 0.8, output: 4.0 }
  if (m.includes('opus-4-7')) return { input: 5.0, output: 25.0 }
  if (m.includes('opus')) return { input: 15.0, output: 75.0 }
  return { input: 3.0, output: 15.0 }
}

export function estimateClaudeCostUsd(model, inputTokens, outputTokens) {
  const inTok = Number(inputTokens || 0)
  const outTok = Number(outputTokens || 0)
  const rates = getModelRatesPerMillion(model)
  const inCost = (inTok / 1_000_000) * rates.input
  const outCost = (outTok / 1_000_000) * rates.output
  return inCost + outCost
}

export function pushClaudeUsageSample(sample) {
  const current = parseStoredUsage()
  const next = [
    ...current,
    {
      ts: new Date().toISOString(),
      model: sample.model || 'desconocido',
      inputTokens: Number(sample.inputTokens || 0),
      outputTokens: Number(sample.outputTokens || 0),
      costUsd: Number(sample.costUsd || 0),
    },
  ]
  localStorage.setItem(CLAUDE_USAGE_STORAGE_KEY, JSON.stringify(next))
  sessionStorage.removeItem(CLAUDE_USAGE_STORAGE_KEY)
}

export function getClaudeUsageSummary(monthlyBudgetUsd = 20) {
  const all = parseStoredUsage()
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  const monthRows = all.filter((r) => {
    const d = new Date(r.ts)
    return d.getMonth() === month && d.getFullYear() === year
  })
  const monthSpentUsd = monthRows.reduce((acc, r) => acc + Number(r.costUsd || 0), 0)
  const monthInputTokens = monthRows.reduce((acc, r) => acc + Number(r.inputTokens || 0), 0)
  const monthOutputTokens = monthRows.reduce((acc, r) => acc + Number(r.outputTokens || 0), 0)
  const monthRemainingUsd = Math.max(0, Number(monthlyBudgetUsd || 0) - monthSpentUsd)
  return {
    monthSpentUsd,
    monthRemainingUsd,
    monthInputTokens,
    monthOutputTokens,
    monthlyBudgetUsd: Number(monthlyBudgetUsd || 0),
  }
}

export function getClaudeDailyCostSeries(days = 14) {
  const all = parseStoredUsage()
  const byDay = new Map()
  for (const row of all) {
    const d = new Date(row.ts)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    byDay.set(key, (byDay.get(key) || 0) + Number(row.costUsd || 0))
  }
  const out = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    out.push({
      dateKey: key,
      label: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      costUsd: Number(byDay.get(key) || 0),
    })
  }
  return out
}

export function getClaudeEstimatedBalance(currentBalanceUsd = 4.9) {
  const spentUsd = getTotalUsageSpentUsd()
  return {
    baseBalanceUsd: Number(currentBalanceUsd || 0),
    spentUsd,
    remainingUsd: Math.max(0, Number(currentBalanceUsd || 0) - spentUsd),
  }
}

export function getClaudeBalanceConfig() {
  try {
    const raw = localStorage.getItem(CLAUDE_BALANCE_STORAGE_KEY)
    if (!raw) {
      return {
        balanceUsd: 4.9,
        baselineSpentUsd: 0,
      }
    }
    const parsed = JSON.parse(raw)
    const balanceUsd = Number(parsed?.balanceUsd ?? 4.9)
    const baselineSpentUsd = Number(parsed?.baselineSpentUsd ?? 0)
    return {
      balanceUsd: Number.isFinite(balanceUsd) ? balanceUsd : 4.9,
      baselineSpentUsd: Number.isFinite(baselineSpentUsd) ? baselineSpentUsd : 0,
    }
  } catch {
    return {
      balanceUsd: 4.9,
      baselineSpentUsd: 0,
    }
  }
}

export function setClaudeBalanceConfig(balanceUsd) {
  const safeBalance = Math.max(0, Number(balanceUsd || 0))
  const payload = {
    balanceUsd: safeBalance,
    baselineSpentUsd: getTotalUsageSpentUsd(),
  }
  localStorage.setItem(CLAUDE_BALANCE_STORAGE_KEY, JSON.stringify(payload))
  return payload
}

export function getClaudeEstimatedBalanceFromConfig() {
  const cfg = getClaudeBalanceConfig()
  const spentUsd = getTotalUsageSpentUsd()
  const consumedSinceSet = Math.max(0, spentUsd - cfg.baselineSpentUsd)
  return {
    baseBalanceUsd: cfg.balanceUsd,
    spentUsd: consumedSinceSet,
    remainingUsd: Math.max(0, cfg.balanceUsd - consumedSinceSet),
  }
}

export async function getClaudeStats(days = 14) {
  const qs = new URLSearchParams({ days: String(days) })
  const res = await fetch(`${API_BASE}/claude/stats?${qs.toString()}`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudieron obtener estadísticas de Claude.')
}

export async function getClaudeBalance() {
  const res = await fetch(`${API_BASE}/claude/balance`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo obtener el saldo de Claude.')
}

export async function resetClaudeBalance(balanceUsd) {
  const res = await fetch(`${API_BASE}/claude/balance/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ balance_usd: Number(balanceUsd) }),
  })
  return parseResponse(res, 'No se pudo actualizar el saldo de Claude.')
}

async function parseResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(detailMessage(data.detail) || fallbackMessage)
  }
  return data
}

export async function loginRequest(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return parseResponse(res, 'No se pudo iniciar sesión.')
}

export async function listClientes({ skip = 0, limit = 50 } = {}) {
  const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  const res = await fetch(`${API_BASE}/clientes/?${qs.toString()}`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudieron listar los clientes.')
}

export async function createCliente(payload) {
  const res = await fetch(`${API_BASE}/clientes/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo crear el cliente.')
}

export async function updateCliente(clienteId, payload) {
  const res = await fetch(`${API_BASE}/clientes/${clienteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo actualizar el cliente.')
}

export async function deleteCliente(clienteId) {
  const res = await fetch(`${API_BASE}/clientes/${clienteId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo eliminar el cliente.')
}

export async function listFathomTranscripts(clienteId, { skip = 0, limit = 200 } = {}) {
  const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  const res = await fetch(`${API_BASE}/fathom/clientes/${clienteId}/transcripts/?${qs.toString()}`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudieron listar los transcripts Fathom.')
}

export async function getFathomTranscript(clienteId, transcriptId) {
  const res = await fetch(`${API_BASE}/fathom/clientes/${clienteId}/transcripts/${transcriptId}`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo obtener el transcript Fathom.')
}

export async function createFathomTranscript(clienteId, payload) {
  const res = await fetch(`${API_BASE}/fathom/clientes/${clienteId}/transcripts/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo crear el transcript Fathom.')
}

export async function updateFathomTranscript(clienteId, transcriptId, payload) {
  const res = await fetch(`${API_BASE}/fathom/clientes/${clienteId}/transcripts/${transcriptId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo actualizar el transcript Fathom.')
}

export async function deleteFathomTranscript(clienteId, transcriptId) {
  const res = await fetch(`${API_BASE}/fathom/clientes/${clienteId}/transcripts/${transcriptId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo eliminar el transcript Fathom.')
}

export async function getDiscordDocumento(clienteId) {
  const res = await fetch(`${API_BASE}/discord/clientes/${clienteId}/documento/`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo cargar el documento Discord.')
}

export async function appendDiscordDocumento(clienteId, payload) {
  const res = await fetch(`${API_BASE}/discord/clientes/${clienteId}/documento/append/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo agregar contenido al documento Discord.')
}

export async function updateDiscordDocumentoBlock(clienteId, blockIndex, payload) {
  const res = await fetch(`${API_BASE}/discord/clientes/${clienteId}/documento/blocks/${blockIndex}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo actualizar el bloque Discord.')
}

export async function deleteDiscordDocumentoBlock(clienteId, blockIndex) {
  const res = await fetch(`${API_BASE}/discord/clientes/${clienteId}/documento/blocks/${blockIndex}/`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo eliminar el bloque Discord.')
}

/** Slug de plantilla del formulario de onboarding (entregable). */
export const ENTREGABLE_SLUG_ONBOARDING = 'onboarding'

export async function listEntregablePlantillas() {
  const res = await fetch(`${API_BASE}/entregables/plantillas/`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo listar las plantillas de entregables.')
}

export async function postEntregablePlantilla(payload) {
  const res = await fetch(`${API_BASE}/entregables/plantillas/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo crear la plantilla del entregable.')
}

export async function patchEntregablePlantillaMeta(slug, payload) {
  const s = encodeURIComponent(String(slug).trim())
  const res = await fetch(`${API_BASE}/entregables/plantillas/${s}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo actualizar el entregable.')
}

export async function getEntregablePlantilla(slug) {
  const s = encodeURIComponent(String(slug).trim())
  const res = await fetch(`${API_BASE}/entregables/plantillas/${s}/`)
  return parseResponse(res, 'No se pudo cargar la plantilla del entregable.')
}

export async function putEntregablePlantilla(slug, payload) {
  const s = encodeURIComponent(String(slug).trim())
  const res = await fetch(`${API_BASE}/entregables/plantillas/${s}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo guardar la plantilla del entregable.')
}

export async function getOnboardingPlantilla() {
  return getEntregablePlantilla(ENTREGABLE_SLUG_ONBOARDING)
}

export async function putOnboardingPlantilla(payload) {
  return putEntregablePlantilla(ENTREGABLE_SLUG_ONBOARDING, payload)
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

/** Onboarding guardado (panel interno). Devuelve `null` si aún no hay registro (404). */
export async function getOnboarding(clienteId) {
  const id = String(clienteId).trim()
  const res = await fetch(`${API_BASE}/onboarding/${id}/`, {
    headers: { ...authHeaders() },
  })
  if (res.status === 404) return null
  return parseResponse(res, 'No se pudo cargar el onboarding.')
}

/** Elimina el entregable de onboarding del cliente (requiere sesión). */
export async function deleteOnboarding(clienteId) {
  const id = String(clienteId).trim()
  const res = await fetch(`${API_BASE}/onboarding/${id}/`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo eliminar el onboarding.')
}

export async function queryClaudeClient(payload) {
  const res = await fetch(`${API_BASE}/claude/clients/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return parseResponse(res, 'No se pudo consultar Claude para este cliente.')
}

/**
 * Consulta Claude por cliente con streaming NDJSON (experiencia tipo chat).
 * @param {object} payload mismo cuerpo que queryClaudeClient
 * @param {{ onDelta?: (chunk: string, accumulated: string) => void, signal?: AbortSignal }} [options]
 * @returns {Promise<{ text: string, model: string, stop_reason: string | null, input_tokens: number, output_tokens: number, cost_usd: number }>}
 */
export async function queryClaudeClientStream(payload, options = {}) {
  const { onDelta, signal } = options
  const res = await fetch(`${API_BASE}/claude/clients/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (res.status === 429) {
    throw new Error('Límite de uso de Anthropic; reintentá más tarde.')
  }
  if (!res.ok) {
    return await parseResponse(res, 'No se pudo consultar Claude para este cliente.')
  }
  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('El navegador no soporta lectura del cuerpo de la respuesta.')
  }
  const dec = new TextDecoder()
  let buf = ''
  let accumulated = ''
  let donePayload = null
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n')
    buf = parts.pop() ?? ''
    for (const line of parts) {
      const s = line.trim()
      if (!s) continue
      let ev
      try {
        ev = JSON.parse(s)
      } catch {
        continue
      }
      if (ev.type === 'delta' && typeof ev.text === 'string') {
        accumulated += ev.text
        onDelta?.(ev.text, accumulated)
      } else if (ev.type === 'done') {
        donePayload = ev
      } else if (ev.type === 'error') {
        throw new Error(ev.detail || 'Error en el stream de Claude.')
      }
    }
  }
  const tail = buf.trim()
  if (tail) {
    try {
      const ev = JSON.parse(tail)
      if (ev.type === 'done') donePayload = ev
      if (ev.type === 'error') throw new Error(ev.detail || 'Error en el stream de Claude.')
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Error en')) throw e
    }
  }
  if (!donePayload) {
    throw new Error('La respuesta de Claude terminó sin evento de cierre.')
  }
  return {
    text: String(donePayload.text ?? '').trim(),
    model: donePayload.model ?? null,
    stop_reason: donePayload.stop_reason ?? null,
    input_tokens: Number(donePayload.input_tokens ?? 0),
    output_tokens: Number(donePayload.output_tokens ?? 0),
    cost_usd: Number(donePayload.cost_usd ?? 0),
  }
}

/** @param {string} [area] venta | cliente | marketing */
export async function getClaudeAreaPrompts() {
  const res = await fetch(`${API_BASE}/claude/area-prompts`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudieron cargar las instrucciones por área.')
}

export async function putClaudeAreaPrompts(body) {
  const res = await fetch(`${API_BASE}/claude/area-prompts`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })
  return parseResponse(res, 'No se pudieron guardar las instrucciones por área.')
}

export async function getClaudeClientQuerySystemInstruction(area = 'cliente') {
  const q = new URLSearchParams({ area: String(area || 'cliente') })
  const res = await fetch(`${API_BASE}/claude/clients/query/system-instruction?${q}`, {
    headers: { ...authHeaders() },
  })
  return parseResponse(res, 'No se pudo obtener la instrucción del sistema de Claude.')
}
