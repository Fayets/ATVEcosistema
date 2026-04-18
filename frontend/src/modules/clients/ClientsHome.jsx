import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import OnboardingViewer from '../../components/OnboardingViewer.jsx'
import EntregablesPlantillaEditor from './EntregablesPlantillaEditor.jsx'
import {
  appendDiscordDocumento,
  createCliente,
  createFathomTranscript,
  deleteCliente,
  deleteDiscordDocumentoBlock,
  deleteFathomTranscript,
  getClaudeAreaPrompts,
  getClaudeBalance,
  getClaudeStats,
  getDiscordDocumento,
  getClaudeClientQuerySystemInstruction,
  getOnboarding,
  listClientes,
  listFathomTranscripts,
  putClaudeAreaPrompts,
  queryClaudeClientStream,
  resetClaudeBalance,
  updateCliente,
  updateDiscordDocumentoBlock,
  updateFathomTranscript,
} from '../../api.js'

/** Parte el documento Discord en bloques (cada append queda tras un separador con fecha UTC). */
function splitDiscordDocumento(contenido) {
  if (!contenido || !String(contenido).trim()) return []
  const s = String(contenido)
  const sepRe = /\n\n--- \[[^\]]+\] ---\n\n/
  const dates = [...s.matchAll(/\n\n--- \[([^\]]+)\] ---\n\n/g)].map((m) => m[1])
  const parts = s.split(sepRe)
  return parts
    .map((raw, i) => {
      const text = stripDiscordExportProfileHeader(raw.trim())
      if (!text) return null
      const firstLine = text.split('\n')[0]?.trim() || 'Discord'
      const shortTitle = firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine
      return {
        id: `discord-block-${i}`,
        blockIndex: i,
        title: shortTitle,
        dateLabel: i === 0 ? null : dates[i - 1] ?? null,
        body: text,
      }
    })
    .filter(Boolean)
}

function formatDiscordBlockDate(utcLabel) {
  if (!utcLabel) return ''
  const m = String(utcLabel).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/)
  if (!m) return utcLabel
  try {
    return new Date(`${m[1]}T${m[2]}Z`).toLocaleString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return utcLabel
  }
}

/** Quita líneas de encabezado de exportación de Discord (nombre, usuario, estado) hasta el primer mensaje con fecha. */
function stripDiscordExportProfileHeader(text) {
  const raw = String(text)
  const lines = raw.split(/\r?\n/)
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Típico: "Nombre – 3/11/21, 8:27" (guión largo/corto + fecha con barras)
    if (/[\u2013\u2014-].*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) {
      startIdx = i
      break
    }
  }
  if (startIdx === -1) return raw.trim()
  return lines.slice(startIdx).join('\n').trim()
}

function clientDisplayName(cliente) {
  if (!cliente) return ''
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(' ').trim() || 'Sin nombre'
}

export default function ClientsHome() {
  const [activeView, setActiveView] = useState('dashboard')
  const [clientes, setClientes] = useState([])
  const [boostSearch, setBoostSearch] = useState('')
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clienteEditingId, setClienteEditingId] = useState(null)
  const [menuClienteId, setMenuClienteId] = useState(null)

  const [fathomTranscripts, setFathomTranscripts] = useState([])
  const [fathomLoading, setFathomLoading] = useState(false)
  const [fathomSearch, setFathomSearch] = useState('')
  const [fathomSelectedId, setFathomSelectedId] = useState(null)
  const [fathomModal, setFathomModal] = useState(null)
  const [fathomForm, setFathomForm] = useState({
    titulo: '',
    recording_url: '',
    contenido: '',
    occurred_at: '',
  })
  const [fathomSaving, setFathomSaving] = useState(false)
  /** Evita que un GET inicial (useEffect) pise la lista tras crear/editar/borrar (misma vista). */
  const fathomLoadGenRef = useRef(0)
  /** Dentro del cliente: carpetas → Fathom / Discord / Entregables; la lógica Fathom vive en `fathom`. */
  const [clienteKnowledgeSubView, setClienteKnowledgeSubView] = useState('overview')

  const [discordDoc, setDiscordDoc] = useState(null)
  const [discordLoading, setDiscordLoading] = useState(false)
  const [discordAppendText, setDiscordAppendText] = useState('')
  const [discordSaving, setDiscordSaving] = useState(false)
  const [discordSearch, setDiscordSearch] = useState('')
  const [discordSelectedBlockId, setDiscordSelectedBlockId] = useState(null)
  const [discordModal, setDiscordModal] = useState(null)
  const [discordEditText, setDiscordEditText] = useState('')
  const [discordAppendOpen, setDiscordAppendOpen] = useState(false)
  const discordAppendRef = useRef(null)
  const iaClienteComboRef = useRef(null)
  const [onboardingData, setOnboardingData] = useState(null)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboardingError, setOnboardingError] = useState('')
  const discordBlocks = useMemo(
    () => splitDiscordDocumento(discordDoc?.contenido ?? ''),
    [discordDoc?.contenido],
  )
  const discordBlocksFiltered = useMemo(() => {
    const q = discordSearch.trim().toLowerCase()
    if (!q) return discordBlocks
    return discordBlocks.filter(
      (b) =>
        (b.title && String(b.title).toLowerCase().includes(q)) ||
        (b.body && String(b.body).toLowerCase().includes(q)),
    )
  }, [discordBlocks, discordSearch])
  const discordSelectedBlock = useMemo(
    () => discordBlocks.find((b) => b.id === discordSelectedBlockId) ?? null,
    [discordBlocks, discordSelectedBlockId],
  )

  const [iaMessages, setIaMessages] = useState([
    {
      id: 'ia-welcome',
      role: 'assistant',
      content:
        'Hola, soy la IA de ATV. Podés preguntarme sobre clientes, transcripts y entregables. A la izquierda vas a ver qué contexto estoy usando.',
      usage: null,
    },
  ])
  const [iaInput, setIaInput] = useState('')
  const [iaClienteId, setIaClienteId] = useState('')
  const [iaClienteSearch, setIaClienteSearch] = useState('')
  const [iaClienteListOpen, setIaClienteListOpen] = useState(false)
  /** Área ATV: mismo valor que envía el backend en `area` (venta | cliente | marketing). */
  const [iaArea, setIaArea] = useState('cliente')
  const [iaConfigLoading, setIaConfigLoading] = useState(false)
  const [iaConfigSaving, setIaConfigSaving] = useState(false)
  const [iaConfigMsg, setIaConfigMsg] = useState('')
  const [iaConfigPrompts, setIaConfigPrompts] = useState({
    venta: '',
    cliente: '',
    marketing: '',
  })
  const [iaIncludeFathom, setIaIncludeFathom] = useState(true)
  const [iaIncludeDiscord, setIaIncludeDiscord] = useState(true)
  const [iaIncludeOnboarding, setIaIncludeOnboarding] = useState(true)
  const [iaSending, setIaSending] = useState(false)
  const [iaSystemInstruction, setIaSystemInstruction] = useState(
    'Cargando instrucción del sistema desde backend…',
  )
  const [claudeBalanceInput, setClaudeBalanceInput] = useState('')
  const [claudeBalanceMsg, setClaudeBalanceMsg] = useState('')
  const [usageRefreshTick, setUsageRefreshTick] = useState(0)
  const [claudeUsageSummary, setClaudeUsageSummary] = useState({
    monthSpentUsd: 0,
    monthInputTokens: 0,
    monthOutputTokens: 0,
  })
  const [claudeDailySeries, setClaudeDailySeries] = useState([])
  const [claudeBalance, setClaudeBalance] = useState({
    balanceUsd: 4.9,
    baselineSpentUsd: 0,
    spentSinceResetUsd: 0,
    remainingUsd: 4.9,
  })

  const [clienteForm, setClienteForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    instagram: '',
    programa: 'boost',
    estado: 'activo',
    notas: '',
  })
  const isClienteEditMode = useMemo(() => clienteEditingId !== null, [clienteEditingId])
  const activosCount = useMemo(
    () => clientes.filter((cliente) => cliente.estado === 'activo').length,
    [clientes],
  )
  const inactivosCount = useMemo(
    () => clientes.filter((cliente) => cliente.estado === 'inactivo').length,
    [clientes],
  )
  const maxDailyTokens = useMemo(
    () => Math.max(...claudeDailySeries.map((d) => d.totalTokens || 0), 1),
    [claudeDailySeries],
  )
  const claudeLinePoints = useMemo(() => {
    if (!claudeDailySeries.length) return ''
    const width = 100
    const height = 100
    const n = claudeDailySeries.length
    return claudeDailySeries
      .map((d, i) => {
        const x = n === 1 ? width / 2 : (i / (n - 1)) * width
        const y = height - ((d.totalTokens || 0) / maxDailyTokens) * height
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  }, [claudeDailySeries, maxDailyTokens])
  const clientesBoost = useMemo(
    () => clientes.filter((cliente) => cliente.programa === 'boost'),
    [clientes],
  )
  const clientesBoostFiltered = useMemo(() => {
    const q = boostSearch.trim().toLowerCase()
    if (!q) return clientesBoost
    return clientesBoost.filter((cliente) => cliente.nombre.toLowerCase().includes(q))
  }, [clientesBoost, boostSearch])
  const clientesMentoria = useMemo(
    () => clientes.filter((cliente) => cliente.programa === 'mentoria_avanzada'),
    [clientes],
  )
  const fathomFiltered = useMemo(() => {
    const q = fathomSearch.trim().toLowerCase()
    if (!q) return fathomTranscripts
    return fathomTranscripts.filter(
      (t) =>
        (t.titulo && String(t.titulo).toLowerCase().includes(q)) ||
        (t.contenido && String(t.contenido).toLowerCase().includes(q)),
    )
  }, [fathomTranscripts, fathomSearch])

  const selectedFathom = useMemo(
    () =>
      fathomTranscripts.find((t) => String(t.id) === String(fathomSelectedId ?? '')) ?? null,
    [fathomTranscripts, fathomSelectedId],
  )

  const iaClientesFiltered = useMemo(() => {
    const q = iaClienteSearch.trim().toLowerCase()
    if (!q) return []
    const digits = q.replace(/\D/g, '')
    return clientes
      .filter((c) => {
        const name = clientDisplayName(c).toLowerCase()
        const prog = String(c.programa || '').toLowerCase()
        const estado = String(c.estado || '').toLowerCase()
        const id = String(c.id || '').toLowerCase()
        const codigo = c.codigo_publico != null ? String(c.codigo_publico) : ''
        return (
          name.includes(q) ||
          prog.includes(q) ||
          estado.includes(q) ||
          id.includes(q) ||
          (digits.length > 0 && codigo.includes(digits))
        )
      })
      .slice(0, 50)
  }, [clientes, iaClienteSearch])

  const iaClienteSeleccionLabel = useMemo(() => {
    if (!iaClienteId) return ''
    const sel = clientes.find((x) => String(x.id) === String(iaClienteId))
    return clientDisplayName(sel) || iaClienteSearch.trim() || String(iaClienteId).slice(0, 8)
  }, [clientes, iaClienteId, iaClienteSearch])

  const [sidebarOpen, setSidebarOpen] = useState(true)

  function toggleSidebar() {
    setSidebarOpen((prev) => !prev)
  }

  function renderIaContent(text) {
    const source = String(text ?? '')
    const lines = source.split('\n')
    return lines.map((line, idx) => {
      const key = `line-${idx}`
      const headingMatch = line.match(/^\s*#{1,6}\s+(.+)$/)
      if (headingMatch) {
        return (
          <p key={key} className="clients-ia-msg__heading">
            <strong>{headingMatch[1].trim()}</strong>
          </p>
        )
      }

      const inlineParts = []
      const boldRegex = /\*\*(.+?)\*\*/g
      let lastIndex = 0
      let match
      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          inlineParts.push(line.slice(lastIndex, match.index))
        }
        inlineParts.push(<strong key={`${key}-b-${match.index}`}>{match[1]}</strong>)
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < line.length) inlineParts.push(line.slice(lastIndex))
      return (
        <p key={key} className="clients-ia-msg__line">
          {inlineParts.length > 0 ? inlineParts : line}
        </p>
      )
    })
  }

  function handleIaClienteSearchChange(e) {
    const value = e.target.value
    setIaClienteSearch(value)
    setIaClienteListOpen(true)
    setIaClienteId((currentId) => {
      if (!currentId) return ''
      const selected = clientes.find((c) => String(c.id) === String(currentId))
      if (!selected) return ''
      if (clientDisplayName(selected).trim() === value.trim()) return currentId
      return ''
    })
  }

  function handlePickIaCliente(c) {
    setIaClienteId(String(c.id))
    setIaClienteSearch(clientDisplayName(c))
    setIaClienteListOpen(false)
  }

  async function handleIaSubmit(e) {
    e.preventDefault()
    const text = iaInput.trim()
    if (!text) return
    if (!iaClienteId) {
      window.alert('Seleccioná un cliente objetivo antes de enviar la consulta.')
      return
    }
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setIaMessages((prev) => [...prev, userMessage])
    setIaInput('')
    setIaSending(true)
    const thinkingId = `assistant-thinking-${Date.now()}`
    const assistantId = `assistant-${Date.now()}`
    let streamRaf = null
    let pendingStreamText = ''
    setIaMessages((prev) => [
      ...prev,
      {
        id: thinkingId,
        role: 'assistant',
        content: '',
        usage: null,
        thinking: true,
      },
    ])

    function cancelStreamRaf() {
      if (streamRaf != null) {
        cancelAnimationFrame(streamRaf)
        streamRaf = null
      }
    }

    function scheduleStreamFlush(full) {
      pendingStreamText = full
      if (streamRaf != null) return
      streamRaf = requestAnimationFrame(() => {
        streamRaf = null
        const next = pendingStreamText
        setIaMessages((prev) =>
          prev.map((msg) =>
            msg.id === thinkingId
              ? {
                  id: assistantId,
                  role: 'assistant',
                  content: next,
                  usage: null,
                  streaming: true,
                }
              : msg.id === assistantId
                ? { ...msg, content: next, streaming: true }
                : msg,
          ),
        )
      })
    }

    try {
      const response = await queryClaudeClientStream(
        {
          cliente_id: iaClienteId,
          area: iaArea,
          prompt: text,
          include_fathom: iaIncludeFathom,
          include_discord: iaIncludeDiscord,
          include_onboarding: iaIncludeOnboarding,
        },
        {
          onDelta: (_chunk, full) => {
            scheduleStreamFlush(full)
          },
        },
      )
      cancelStreamRaf()
      const usage = {
        model: response?.model ?? null,
        inputTokens: response?.input_tokens ?? null,
        outputTokens: response?.output_tokens ?? null,
        totalTokens:
          Number(response?.input_tokens ?? 0) + Number(response?.output_tokens ?? 0) || null,
        costUsd: Number(response?.cost_usd ?? 0),
      }
      setUsageRefreshTick((v) => v + 1)
      const finalText =
        (response?.text && String(response.text).trim()) || 'Claude no devolvió contenido.'
      setIaMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantId) {
            return { ...msg, content: finalText, usage, streaming: false }
          }
          if (msg.id === thinkingId) {
            return {
              id: assistantId,
              role: 'assistant',
              content: finalText,
              usage,
              streaming: false,
            }
          }
          return msg
        }),
      )
    } catch (err) {
      cancelStreamRaf()
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content:
          err instanceof Error
            ? `No pude obtener el resumen del cliente: ${err.message}`
            : 'No pude obtener el resumen del cliente.',
        usage: null,
      }
      setIaMessages((prev) =>
        prev.map((msg) => (msg.id === thinkingId ? assistantMessage : msg)),
      )
    } finally {
      setIaSending(false)
    }
  }

  useEffect(() => {
    if (activeView !== 'ia') return
    let cancelled = false
    ;(async () => {
      try {
        const data = await getClaudeClientQuerySystemInstruction(iaArea)
        if (cancelled) return
        setIaSystemInstruction(
          data?.system_instruction?.trim() || 'No se pudo leer la instrucción del sistema.',
        )
      } catch (err) {
        if (cancelled) return
        setIaSystemInstruction(
          err instanceof Error
            ? `No se pudo cargar la instrucción del sistema: ${err.message}`
            : 'No se pudo cargar la instrucción del sistema.',
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeView, iaArea])

  useEffect(() => {
    if (!iaClienteListOpen) return
    function onDocDown(ev) {
      if (iaClienteComboRef.current && !iaClienteComboRef.current.contains(ev.target)) {
        setIaClienteListOpen(false)
      }
    }
    function onKey(ev) {
      if (ev.key === 'Escape') setIaClienteListOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [iaClienteListOpen])

  useEffect(() => {
    if (activeView !== 'ia-config') return
    let cancelled = false
    ;(async () => {
      setIaConfigLoading(true)
      setIaConfigMsg('')
      try {
        const data = await getClaudeAreaPrompts()
        if (cancelled) return
        const next = { venta: '', cliente: '', marketing: '' }
        for (const it of data?.items || []) {
          if (it?.area && typeof it.instruction === 'string') {
            next[it.area] = it.instruction
          }
        }
        setIaConfigPrompts(next)
      } catch (err) {
        if (!cancelled) {
          setIaConfigMsg(
            err instanceof Error ? err.message : 'No se pudieron cargar las instrucciones.',
          )
        }
      } finally {
        if (!cancelled) setIaConfigLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeView])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [stats, balance] = await Promise.all([getClaudeStats(14), getClaudeBalance()])
        if (cancelled) return
        setClaudeUsageSummary({
          monthSpentUsd: Number(stats?.month_spent_usd || 0),
          monthInputTokens: Number(stats?.month_input_tokens || 0),
          monthOutputTokens: Number(stats?.month_output_tokens || 0),
        })
        setClaudeDailySeries(
          Array.isArray(stats?.daily_series)
            ? stats.daily_series.map((p) => ({
                dateKey: p?.date_key ?? '',
                label: p?.label ?? '',
                costUsd: Number(p?.cost_usd || 0),
                inputTokens: Number(p?.input_tokens || 0),
                outputTokens: Number(p?.output_tokens || 0),
                totalTokens: Number(p?.total_tokens || 0),
              }))
            : [],
        )
        setClaudeBalance({
          balanceUsd: Number(balance?.balance_usd || 0),
          baselineSpentUsd: Number(balance?.baseline_spent_usd || 0),
          spentSinceResetUsd: Number(balance?.spent_since_reset_usd || 0),
          remainingUsd: Number(balance?.remaining_usd || 0),
        })
        setClaudeBalanceInput(String(Number(balance?.balance_usd || 0)))
      } catch (err) {
        if (!cancelled) {
          setClaudeBalanceMsg(
            err instanceof Error ? `No se pudieron cargar stats de Claude: ${err.message}` : 'No se pudieron cargar stats de Claude.',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [usageRefreshTick])

  function handleSaveClaudeBalance(e) {
    e.preventDefault()
    const parsed = Number(String(claudeBalanceInput || '').replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setClaudeBalanceMsg('Ingresá un saldo válido (USD).')
      return
    }
    ;(async () => {
      try {
        const saved = await resetClaudeBalance(parsed)
        setClaudeBalance({
          balanceUsd: Number(saved?.balance_usd || parsed),
          baselineSpentUsd: Number(saved?.baseline_spent_usd || 0),
          spentSinceResetUsd: Number(saved?.spent_since_reset_usd || 0),
          remainingUsd: Number(saved?.remaining_usd || 0),
        })
        setClaudeBalanceInput(String(Number(saved?.balance_usd || parsed)))
        setClaudeBalanceMsg('Saldo actualizado. El conteo se reinició desde este momento.')
        setUsageRefreshTick((v) => v + 1)
      } catch (err) {
        setClaudeBalanceMsg(
          err instanceof Error ? `No se pudo actualizar saldo Claude: ${err.message}` : 'No se pudo actualizar saldo Claude.',
        )
      }
    })()
  }

  async function handleSaveIaConfig(e) {
    e.preventDefault()
    setIaConfigSaving(true)
    setIaConfigMsg('')
    try {
      const data = await putClaudeAreaPrompts({
        items: [
          { area: 'venta', instruction: iaConfigPrompts.venta },
          { area: 'cliente', instruction: iaConfigPrompts.cliente },
          { area: 'marketing', instruction: iaConfigPrompts.marketing },
        ],
      })
      const next = { venta: '', cliente: '', marketing: '' }
      for (const it of data?.items || []) {
        if (it?.area && typeof it.instruction === 'string') {
          next[it.area] = it.instruction
        }
      }
      setIaConfigPrompts(next)
      setIaConfigMsg('Cambios guardados. Se usarán en las consultas Claude por cliente.')
    } catch (err) {
      setIaConfigMsg(
        err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
      )
    } finally {
      setIaConfigSaving(false)
    }
  }

  function renderIaConfigView() {
    return (
      <>
        <header className="clients-content__header">
          <h2>Configuración</h2>
          <p className="module-lead">
            Editá el system prompt que recibe Claude para cada área (Venta, Cliente, Marketing). Los textos se
            guardan en el servidor y aplican al chat de Claude ATV.
          </p>
        </header>

        <section className="clients-panel clients-panel--ia-config">
          {iaConfigLoading ? (
            <p className="clients-ia-config__status">Cargando…</p>
          ) : (
            <form className="clients-ia-config-form" onSubmit={handleSaveIaConfig}>
              <div className="clients-ia-config-block">
                <label className="clients-ia-config-label" htmlFor="ia-prompt-venta">
                  Área Venta
                </label>
                <textarea
                  id="ia-prompt-venta"
                  className="clients-ia-config-textarea"
                  rows={10}
                  value={iaConfigPrompts.venta}
                  onChange={(e) => setIaConfigPrompts((p) => ({ ...p, venta: e.target.value }))}
                  spellCheck="false"
                />
              </div>
              <div className="clients-ia-config-block">
                <label className="clients-ia-config-label" htmlFor="ia-prompt-cliente">
                  Área Cliente
                </label>
                <textarea
                  id="ia-prompt-cliente"
                  className="clients-ia-config-textarea"
                  rows={10}
                  value={iaConfigPrompts.cliente}
                  onChange={(e) => setIaConfigPrompts((p) => ({ ...p, cliente: e.target.value }))}
                  spellCheck="false"
                />
              </div>
              <div className="clients-ia-config-block">
                <label className="clients-ia-config-label" htmlFor="ia-prompt-marketing">
                  Área Marketing
                </label>
                <textarea
                  id="ia-prompt-marketing"
                  className="clients-ia-config-textarea"
                  rows={10}
                  value={iaConfigPrompts.marketing}
                  onChange={(e) => setIaConfigPrompts((p) => ({ ...p, marketing: e.target.value }))}
                  spellCheck="false"
                />
              </div>
              {iaConfigMsg ? (
                <p className={iaConfigMsg.includes('guardad') ? 'clients-ia-config__msg clients-ia-config__msg--ok' : 'clients-ia-config__msg'} role="status">
                  {iaConfigMsg}
                </p>
              ) : null}
              <div className="clients-ia-config-actions">
                <button type="submit" className="login-submit" disabled={iaConfigSaving}>
                  {iaConfigSaving ? 'Guardando…' : 'Guardar instrucciones'}
                </button>
              </div>
            </form>
          )}
        </section>
      </>
    )
  }

  function renderDashboardView() {
    return (
      <>
        <header className="clients-content__header">
          <h2>Dashboard</h2>
          <p className="module-lead">Métricas generales del módulo ATV Clients.</p>
        </header>

        <section className="clients-panel clients-metrics-grid">
          <article className="clients-metric-card">
            <span>Clientes</span>
            <strong>{clientes.length}</strong>
          </article>
          <article className="clients-metric-card">
            <span>Activos</span>
            <strong>{activosCount}</strong>
          </article>
          <article className="clients-metric-card">
            <span>Inactivos</span>
            <strong>{inactivosCount}</strong>
          </article>
          <article className="clients-metric-card clients-metric-card--balance">
            <span>Saldo restante</span>
            <strong>${claudeBalance.remainingUsd.toFixed(2)}</strong>
          </article>
        </section>

        <section className="clients-panel clients-panel--claude-balance">
          <h3>Claude</h3>
          <form className="clients-claude-balance-form" onSubmit={handleSaveClaudeBalance}>
            <label className="clients-claude-balance-form__label">
              <span>Saldo inicial / recarga (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={claudeBalanceInput}
                onChange={(e) => setClaudeBalanceInput(e.target.value)}
                placeholder="Ej. 20.00"
              />
            </label>
            <button type="submit" className="clients-secondary">
              Guardar y reiniciar contador
            </button>
          </form>
          {claudeBalanceMsg ? <p className="clients-claude-balance-msg">{claudeBalanceMsg}</p> : null}
          <div className="clients-claude-chart" aria-label="Consumo diario estimado de Claude">
            <p className="clients-claude-chart__meta">
              Consumo mes: USD {claudeUsageSummary.monthSpentUsd.toFixed(4)} · tokens entrada{' '}
              {claudeUsageSummary.monthInputTokens} / salida {claudeUsageSummary.monthOutputTokens}
            </p>
            <div className="clients-claude-chart__line-wrap" aria-hidden="true">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="clients-claude-chart__line-svg">
                <polyline points={claudeLinePoints} className="clients-claude-chart__line" />
              </svg>
            </div>
            <div
              className="clients-claude-chart__bars"
              style={{ gridTemplateColumns: `repeat(${Math.max(claudeDailySeries.length, 1)}, minmax(0, 1fr))` }}
            >
              {claudeDailySeries.map((item) => {
                const hasTokens = (item.totalTokens || 0) > 0
                return (
                  <div
                    key={item.dateKey}
                    className="clients-claude-chart__bar-wrap"
                    title={`${item.label}: ${item.totalTokens || 0} tokens · USD ${item.costUsd.toFixed(4)}`}
                  >
                    <div
                      className={`clients-claude-chart__dot${hasTokens ? '' : ' clients-claude-chart__dot--empty'}`}
                    />
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </>
    )
  }
  async function refreshClientes(showLoader = true) {
    if (showLoader) setLoading(true)
    try {
      const data = await listClientes({ skip: 0, limit: 100 })
      setClientes(Array.isArray(data) ? data : [])
      return true
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'No se pudo cargar clientes.')
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    async function boot() {
      setError('')
      setLoading(true)
      try {
        await refreshClientes(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la información inicial.')
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  useEffect(() => {
    if (activeView !== 'cliente-knowledge' || !selectedCliente || clienteKnowledgeSubView !== 'fathom') return
    const clienteId = selectedCliente.id
    const genAtStart = fathomLoadGenRef.current
    let cancelled = false
    async function loadFathom() {
      setFathomLoading(true)
      try {
        const data = await listFathomTranscripts(clienteId, { skip: 0, limit: 200 })
        if (cancelled) return
        if (fathomLoadGenRef.current !== genAtStart) return
        setFathomTranscripts(Array.isArray(data) ? data : [])
      } catch (err) {
        if (cancelled || fathomLoadGenRef.current !== genAtStart) return
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los transcripts Fathom.')
      } finally {
        if (!cancelled) setFathomLoading(false)
      }
    }
    loadFathom()
    return () => {
      cancelled = true
    }
  }, [activeView, selectedCliente?.id, clienteKnowledgeSubView])

  useEffect(() => {
    if (activeView !== 'cliente-knowledge' || !selectedCliente || clienteKnowledgeSubView !== 'discord') return
    const clienteId = selectedCliente.id
    let cancelled = false
    async function loadDiscord() {
      setDiscordLoading(true)
      try {
        const data = await getDiscordDocumento(clienteId)
        if (!cancelled) setDiscordDoc(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el documento Discord.')
        }
      } finally {
        if (!cancelled) setDiscordLoading(false)
      }
    }
    loadDiscord()
    return () => {
      cancelled = true
    }
  }, [activeView, selectedCliente?.id, clienteKnowledgeSubView])

  useEffect(() => {
    if (!discordSelectedBlockId) return
    if (!discordBlocksFiltered.some((b) => b.id === discordSelectedBlockId)) {
      setDiscordSelectedBlockId(null)
      setDiscordModal(null)
    }
  }, [discordBlocksFiltered, discordSelectedBlockId])

  useEffect(() => {
    if (discordModal === 'edit' && discordSelectedBlock) {
      setDiscordEditText(discordSelectedBlock.body)
    }
  }, [discordModal, discordSelectedBlock])

  useEffect(() => {
    if (clienteKnowledgeSubView !== 'discord') setDiscordAppendOpen(false)
  }, [clienteKnowledgeSubView])

  useEffect(() => {
    if (!discordAppendOpen) return
    const id = window.requestAnimationFrame(() => {
      discordAppendRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [discordAppendOpen])

  useEffect(() => {
    if (!discordAppendOpen) return
    function onKey(e) {
      if (e.key === 'Escape' && !discordSaving) setDiscordAppendOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [discordAppendOpen, discordSaving])

  useEffect(() => {
    if (activeView !== 'cliente-knowledge' || !selectedCliente || clienteKnowledgeSubView !== 'entregables') return
    const clienteId = selectedCliente.id
    let cancelled = false
    async function loadOnboarding() {
      setOnboardingLoading(true)
      setOnboardingData(null)
      setOnboardingError('')
      try {
        const data = await getOnboarding(clienteId)
        if (!cancelled) setOnboardingData(data)
      } catch (err) {
        if (!cancelled) {
          setOnboardingError(err instanceof Error ? err.message : 'No se pudo cargar el onboarding.')
        }
      } finally {
        if (!cancelled) setOnboardingLoading(false)
      }
    }
    loadOnboarding()
    return () => {
      cancelled = true
    }
  }, [activeView, selectedCliente?.id, clienteKnowledgeSubView])

  useEffect(() => {
    if (menuClienteId === null) return
    function handlePointerDown(e) {
      const el = e.target
      if (!(el instanceof Element)) return
      if (el.closest('[data-cliente-menu-root]')) return
      setMenuClienteId(null)
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setMenuClienteId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuClienteId])

  function resetClienteForm() {
    setClienteForm({
      nombre: '',
      apellido: '',
      telefono: '',
      instagram: '',
      programa: 'boost',
      estado: 'activo',
      notas: '',
    })
    setClienteEditingId(null)
  }

  function handleClienteChange(e) {
    const { name, value } = e.target
    setClienteForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmitCliente(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      nombre: clienteForm.nombre.trim(),
      apellido: clienteForm.apellido.trim() || null,
      telefono: clienteForm.telefono.trim() || null,
      instagram: clienteForm.instagram.trim() || null,
      programa: clienteForm.programa,
      estado: clienteForm.estado,
      notas: clienteForm.notas.trim() || null,
    }

    try {
      if (isClienteEditMode) await updateCliente(clienteEditingId, payload)
      else await createCliente(payload)
      await refreshClientes(false)
      resetClienteForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  function handleEditCliente(cliente) {
    setClienteEditingId(cliente.id)
    setClienteForm({
      nombre: cliente.nombre ?? '',
      apellido: cliente.apellido ?? '',
      telefono: cliente.telefono ?? '',
      instagram: cliente.instagram ?? '',
      programa: cliente.programa ?? 'boost',
      estado: cliente.estado ?? 'activo',
      notas: cliente.notas ?? '',
    })
    setActiveView('crear-cliente')
  }

  async function handleDeleteCliente(cliente) {
    if (!window.confirm(`¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`)) return
    setError('')
    try {
      await deleteCliente(cliente.id)
      await refreshClientes(false)
      if (clienteEditingId === cliente.id) resetClienteForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el cliente.')
    }
  }

  function toggleClienteMenu(clienteId) {
    setMenuClienteId((prev) => (prev === clienteId ? null : clienteId))
  }

  async function handleDeleteFromMenu(cliente) {
    setMenuClienteId(null)
    const ok = window.confirm(`¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`)
    if (!ok) return
    await handleDeleteCliente(cliente)
  }

  function openClienteKnowledge(cliente) {
    fathomLoadGenRef.current = 0
    setDiscordDoc(null)
    setDiscordAppendText('')
    setDiscordSearch('')
    setDiscordSelectedBlockId(null)
    setDiscordModal(null)
    setDiscordEditText('')
    setOnboardingData(null)
    setOnboardingError('')
    setSelectedCliente(cliente)
    setMenuClienteId(null)
    setClienteKnowledgeSubView('overview')
    setFathomSearch('')
    setFathomSelectedId(null)
    setFathomModal(null)
    setActiveView('cliente-knowledge')
  }

  function closeClienteKnowledge() {
    fathomLoadGenRef.current = 0
    setDiscordDoc(null)
    setDiscordAppendText('')
    setDiscordSearch('')
    setDiscordSelectedBlockId(null)
    setDiscordModal(null)
    setDiscordEditText('')
    setOnboardingData(null)
    setOnboardingError('')
    setClienteKnowledgeSubView('overview')
    setFathomTranscripts([])
    setFathomSearch('')
    setFathomSelectedId(null)
    setFathomModal(null)
    setFathomForm({ titulo: '', recording_url: '', contenido: '', occurred_at: '' })
    if (!selectedCliente) {
      setActiveView('dashboard')
      return
    }
    setActiveView(selectedCliente.programa === 'mentoria_avanzada' ? 'mentoria' : 'boost')
    setSelectedCliente(null)
  }

  function handleClienteKnowledgeBack() {
    if (clienteKnowledgeSubView !== 'overview') {
      setDiscordSearch('')
      setDiscordSelectedBlockId(null)
      setDiscordModal(null)
      setDiscordEditText('')
      setOnboardingData(null)
      setOnboardingError('')
      setClienteKnowledgeSubView('overview')
      setFathomModal(null)
      return
    }
    closeClienteKnowledge()
  }

  function resetFathomForm() {
    setFathomForm({ titulo: '', recording_url: '', contenido: '', occurred_at: '' })
  }

  function openFathomCreate() {
    resetFathomForm()
    setFathomModal('create')
  }

  function openFathomTranscriptRead(transcriptId) {
    setFathomSelectedId(String(transcriptId))
    setFathomModal('read')
  }

  function openFathomEdit() {
    if (!selectedFathom) {
      window.alert('Seleccioná un transcript haciendo click en una tarjeta.')
      return
    }
    const t = selectedFathom
    let occurredLocal = ''
    if (t.occurred_at) {
      try {
        const d = new Date(t.occurred_at)
        const pad = (n) => String(n).padStart(2, '0')
        occurredLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      } catch {
        occurredLocal = ''
      }
    }
    setFathomForm({
      titulo: t.titulo ?? '',
      recording_url: t.recording_url ?? '',
      contenido: t.contenido ?? '',
      occurred_at: occurredLocal,
    })
    setFathomModal('edit')
  }

  async function handleFathomSubmit(e) {
    e.preventDefault()
    if (!selectedCliente) return
    setFathomSaving(true)
    setError('')
    const occurredRaw = fathomForm.occurred_at.trim()
    let occurred_at = null
    if (occurredRaw) {
      const parsed = new Date(occurredRaw)
      occurred_at = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
    }
    const payload = {
      titulo: fathomForm.titulo.trim(),
      recording_url: fathomForm.recording_url.trim() || null,
      contenido: fathomForm.contenido.trim() || null,
      occurred_at,
    }
    try {
      if (fathomModal === 'create') {
        await createFathomTranscript(selectedCliente.id, payload)
      } else if (fathomModal === 'edit' && fathomSelectedId) {
        await updateFathomTranscript(selectedCliente.id, fathomSelectedId, payload)
      }
      setFathomModal(null)
      resetFathomForm()
      fathomLoadGenRef.current += 1
      const data = await listFathomTranscripts(selectedCliente.id, { skip: 0, limit: 200 })
      setFathomTranscripts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el transcript Fathom.')
    } finally {
      setFathomSaving(false)
    }
  }

  async function handleFathomDelete() {
    if (!selectedCliente || !fathomSelectedId) {
      window.alert('Seleccioná un transcript haciendo click en una tarjeta.')
      return
    }
    if (!window.confirm('¿Eliminar este transcript Fathom? Esta acción no se puede deshacer.')) return
    setError('')
    try {
      await deleteFathomTranscript(selectedCliente.id, fathomSelectedId)
      setFathomSelectedId(null)
      fathomLoadGenRef.current += 1
      const data = await listFathomTranscripts(selectedCliente.id, { skip: 0, limit: 200 })
      setFathomTranscripts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el transcript Fathom.')
    }
  }

  function openDiscordEdit() {
    if (!discordSelectedBlockId) {
      window.alert('Seleccioná un bloque haciendo click en la tarjeta.')
      return
    }
    setDiscordAppendOpen(false)
    setDiscordModal('edit')
  }

  async function handleDiscordSaveBlock() {
    if (!selectedCliente || !discordSelectedBlock) return
    const texto = stripDiscordExportProfileHeader(discordEditText.trim())
    if (!texto) {
      window.alert('El texto no puede estar vacío.')
      return
    }
    setDiscordSaving(true)
    setError('')
    try {
      const data = await updateDiscordDocumentoBlock(selectedCliente.id, discordSelectedBlock.blockIndex, { texto })
      setDiscordDoc(data)
      setDiscordModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el bloque Discord.')
    } finally {
      setDiscordSaving(false)
    }
  }

  async function handleDiscordDeleteBlock() {
    if (!discordSelectedBlockId || !discordSelectedBlock) {
      window.alert('Seleccioná un bloque haciendo click en la tarjeta.')
      return
    }
    if (!window.confirm('¿Eliminar este bloque del documento Discord? Esta acción no se puede deshacer.')) return
    if (!selectedCliente) return
    setDiscordSaving(true)
    setError('')
    try {
      const data = await deleteDiscordDocumentoBlock(selectedCliente.id, discordSelectedBlock.blockIndex)
      setDiscordDoc(data)
      setDiscordSelectedBlockId(null)
      setDiscordModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el bloque Discord.')
    } finally {
      setDiscordSaving(false)
    }
  }

  async function handleDiscordAppend(e) {
    e.preventDefault()
    if (!selectedCliente) return
    const raw = discordAppendText.trim()
    if (!raw) return
    const texto = stripDiscordExportProfileHeader(raw)
    if (!texto) {
      window.alert('El texto solo contenía el encabezado de perfil de Discord; pegá también los mensajes.')
      return
    }
    setDiscordSaving(true)
    setError('')
    try {
      const data = await appendDiscordDocumento(selectedCliente.id, { texto })
      setDiscordDoc(data)
      setDiscordAppendText('')
      setDiscordSelectedBlockId(null)
      setDiscordAppendOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar contenido al documento Discord.')
    } finally {
      setDiscordSaving(false)
    }
  }

  function formatFathomCardDate(iso) {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  function renderClienteKnowledgeView() {
    if (!selectedCliente) return null
    const fullName = `${selectedCliente.nombre}${selectedCliente.apellido ? ` ${selectedCliente.apellido}` : ''}`.trim()
    const knowledgeCrumbLabels = { fathom: 'Fathom', discord: 'Discord', entregables: 'Entregables' }
    const subCrumb =
      clienteKnowledgeSubView === 'overview' ? null : knowledgeCrumbLabels[clienteKnowledgeSubView] ?? null

    return (
      <>
        <header className="clients-content__header clients-knowledge-head">
          <div className="clients-knowledge-head__top">
            <button type="button" className="clients-secondary clients-knowledge-back" onClick={handleClienteKnowledgeBack}>
              ← Volver
            </button>
            <h2 className="clients-knowledge-head__title">
              {fullName}
              {subCrumb ? <span className="clients-knowledge-head__crumb"> · {subCrumb}</span> : null}
            </h2>
          </div>
        </header>

        {clienteKnowledgeSubView === 'overview' ? (
          <section className="clients-panel clients-panel--knowledge-overview">
            <div className="clients-knowledge-folders-grid" role="navigation" aria-label="Carpetas del cliente">
              <button
                type="button"
                className="clients-knowledge-folder clients-knowledge-folder--fathom"
                onClick={() => setClienteKnowledgeSubView('fathom')}
              >
                <div className="clients-knowledge-folder__preview" aria-hidden="true" />
                <span className="clients-knowledge-folder__label">Fathom</span>
                <span className="clients-knowledge-folder__hint">Transcripts de llamadas</span>
              </button>
              <button
                type="button"
                className="clients-knowledge-folder clients-knowledge-folder--discord"
                onClick={() => setClienteKnowledgeSubView('discord')}
              >
                <div className="clients-knowledge-folder__preview" aria-hidden="true" />
                <span className="clients-knowledge-folder__label">Discord</span>
                <span className="clients-knowledge-folder__hint">Chats y reportes</span>
              </button>
              <button
                type="button"
                className="clients-knowledge-folder clients-knowledge-folder--entregables"
                onClick={() => setClienteKnowledgeSubView('entregables')}
              >
                <div className="clients-knowledge-folder__preview" aria-hidden="true" />
                <span className="clients-knowledge-folder__label">Entregables</span>
                <span className="clients-knowledge-folder__hint">Documentos y planes</span>
              </button>
            </div>
          </section>
        ) : null}

        {clienteKnowledgeSubView === 'discord' ? (
          <section className="clients-panel clients-panel--discord">
            <div className="clients-fathom-toolbar">
              <input
                type="search"
                className="clients-search-input clients-fathom-toolbar__search"
                placeholder="Buscar en el documento Discord…"
                value={discordSearch}
                onChange={(e) => setDiscordSearch(e.target.value)}
                aria-label="Buscar en el documento Discord"
              />
              <div className="clients-fathom-toolbar__crud" role="group" aria-label="Acciones Discord">
                <button
                  type="button"
                  className="clients-crud-btn"
                  onClick={() => {
                    setDiscordModal(null)
                    setDiscordAppendOpen(true)
                  }}
                  disabled={discordLoading || discordSaving}
                >
                  Agregar contenido
                </button>
                <button type="button" className="clients-crud-btn" onClick={openDiscordEdit} disabled={discordLoading || discordSaving}>
                  Editar
                </button>
                <button
                  type="button"
                  className="clients-crud-btn clients-crud-btn--danger"
                  onClick={handleDiscordDeleteBlock}
                  disabled={discordLoading || discordSaving}
                >
                  Eliminar
                </button>
              </div>
            </div>
            {discordLoading ? <p className="module-lead">Cargando documento Discord…</p> : null}
            {!discordLoading && !discordDoc ? (
              <p className="module-lead clients-discord-load-hint">
                No se pudo cargar el documento. Podés usar <strong>Agregar contenido</strong> arriba; si el servidor
                responde, se creará o actualizará el documento.
              </p>
            ) : null}
            {!discordLoading && discordDoc && discordBlocks.length === 0 ? (
              <p className="module-lead">
                Todavía no hay bloques. Usá <strong>Agregar contenido</strong> en la barra superior.
              </p>
            ) : null}
            {!discordLoading && discordDoc && discordBlocks.length > 0 && discordBlocksFiltered.length === 0 ? (
              <p className="module-lead">No hay bloques que coincidan con la búsqueda.</p>
            ) : null}
            {!discordLoading && discordDoc && discordBlocksFiltered.length > 0 ? (
              <div className="clients-docs-grid clients-docs-grid--discord">
                {discordBlocksFiltered.map((block) => (
                  <article
                    key={block.id}
                    className={`clients-doc-card clients-doc-card--discord-static${
                      discordSelectedBlockId === block.id ? ' clients-doc-card--selected' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="clients-doc-card__hit clients-doc-card__hit--discord"
                      aria-label={`Abrir bloque: ${block.title}`}
                      onClick={() => {
                        setDiscordAppendOpen(false)
                        setDiscordSelectedBlockId(block.id)
                        setDiscordModal('read')
                      }}
                    >
                      <div className="clients-doc-card__preview clients-doc-card__preview--discord" aria-hidden="true">
                        <span>Discord</span>
                      </div>
                      <div className="clients-doc-card__body">
                        <h4>{block.title}</h4>
                        <p>Discord · Documento</p>
                        <small>
                          {block.dateLabel ? formatDiscordBlockDate(block.dateLabel) : 'Primer bloque (sin separador de fecha)'}
                        </small>
                      </div>
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {clienteKnowledgeSubView === 'discord' && discordAppendOpen ? (
          <div
            className="clients-modal-overlay"
            role="presentation"
            onClick={() => {
              if (!discordSaving) setDiscordAppendOpen(false)
            }}
          >
            <div
              className="clients-modal clients-modal--read clients-modal--discord-append"
              role="dialog"
              aria-modal="true"
              aria-labelledby="discord-append-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="discord-append-modal-title">Agregar contenido</h3>
              <p className="clients-discord-modal-meta">Se guarda al final del documento con fecha y hora.</p>
              <form className="clients-discord-append-form" onSubmit={handleDiscordAppend}>
                <label className="clients-field clients-field--full">
                  <span>Texto</span>
                  <textarea
                    ref={discordAppendRef}
                    className="clients-discord-append-textarea"
                    value={discordAppendText}
                    onChange={(e) => setDiscordAppendText(e.target.value)}
                    rows={8}
                    placeholder="Pegá aquí mensajes, reportes o recortes de Discord…"
                    disabled={discordSaving}
                    aria-label="Texto a agregar al documento Discord"
                  />
                </label>
                <div className="clients-modal-actions">
                  <button
                    type="submit"
                    className="login-submit"
                    disabled={discordSaving || !discordAppendText.trim()}
                  >
                    {discordSaving ? 'Guardando…' : 'Agregar al documento'}
                  </button>
                  <button
                    type="button"
                    className="clients-secondary"
                    onClick={() => {
                      if (!discordSaving) setDiscordAppendOpen(false)
                    }}
                    disabled={discordSaving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {clienteKnowledgeSubView === 'discord' && discordModal && discordSelectedBlock ? (
          <div
            className="clients-modal-overlay"
            role="presentation"
            onClick={() => {
              if (!discordSaving) setDiscordModal(null)
            }}
          >
            <div
              className="clients-modal clients-modal--read"
              role="dialog"
              aria-modal="true"
              aria-labelledby="discord-block-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="discord-block-modal-title">
                {discordModal === 'edit' ? 'Editar bloque Discord' : 'Documento Discord'}
              </h3>
              <p className="clients-discord-modal-meta">
                {discordSelectedBlock.dateLabel
                  ? formatDiscordBlockDate(discordSelectedBlock.dateLabel)
                  : 'Primer bloque del documento'}
              </p>
              {discordModal === 'read' ? (
                <>
                  <div className="clients-modal-body-scroll clients-modal-body-scroll--discord-read">
                    <div className="clients-discord-modal-body">{discordSelectedBlock.body}</div>
                  </div>
                  <div className="clients-modal-actions">
                    <button type="button" className="login-submit" onClick={() => setDiscordModal(null)} disabled={discordSaving}>
                      Cerrar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="clients-field clients-field--full clients-discord-edit-field">
                    <span>Contenido del bloque</span>
                    <textarea
                      className="clients-discord-edit-textarea"
                      rows={14}
                      value={discordEditText}
                      onChange={(e) => setDiscordEditText(e.target.value)}
                      disabled={discordSaving}
                    />
                  </label>
                  <div className="clients-modal-actions">
                    <button type="button" className="login-submit" onClick={handleDiscordSaveBlock} disabled={discordSaving}>
                      {discordSaving ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      className="clients-secondary"
                      onClick={() => setDiscordModal(null)}
                      disabled={discordSaving}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {clienteKnowledgeSubView === 'entregables' ? (
          <section className="clients-panel clients-panel--entregables">
            {onboardingLoading ? <p className="module-lead">Cargando entregables…</p> : null}
            {!onboardingLoading && onboardingError ? (
              <p className="module-lead clients-entregables-error">{onboardingError}</p>
            ) : null}
            <div className="clients-entregables-list" aria-label="Entregables del cliente">
              {!onboardingLoading && !onboardingError && onboardingData ? (
                <OnboardingViewer
                  respuestas={onboardingData.respuestas}
                  clienteNombre={[selectedCliente.nombre, selectedCliente.apellido].filter(Boolean).join(' ')}
                  submittedAt={onboardingData.updated_at ?? onboardingData.created_at}
                  clienteId={selectedCliente.id}
                  onDeleted={() => setOnboardingData(null)}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {clienteKnowledgeSubView === 'fathom' ? (
          <section className="clients-panel clients-panel--knowledge">
            <div className="clients-fathom-toolbar">
              <input
                type="search"
                className="clients-search-input clients-fathom-toolbar__search"
                placeholder="Buscar en transcripts Fathom…"
                value={fathomSearch}
                onChange={(e) => setFathomSearch(e.target.value)}
                aria-label="Buscar en transcripts Fathom"
              />
              <div className="clients-fathom-toolbar__crud" role="group" aria-label="Acciones Fathom">
                <button type="button" className="clients-crud-btn" onClick={openFathomCreate} disabled={fathomLoading}>
                  Crear
                </button>
                <button type="button" className="clients-crud-btn" onClick={openFathomEdit} disabled={fathomLoading}>
                  Editar
                </button>
                <button
                  type="button"
                  className="clients-crud-btn clients-crud-btn--danger"
                  onClick={handleFathomDelete}
                  disabled={fathomLoading}
                >
                  Eliminar
                </button>
              </div>
            </div>

            {fathomLoading ? <p className="module-lead">Cargando transcripts Fathom…</p> : null}
            {!fathomLoading && fathomFiltered.length === 0 ? (
              <p className="module-lead">No hay transcripts Fathom para este cliente.</p>
            ) : null}
            {!fathomLoading && fathomFiltered.length > 0 ? (
              <div className="clients-docs-grid">
                {fathomFiltered.map((t) => (
                  <article
                    key={t.id}
                    className={`clients-doc-card${
                      String(fathomSelectedId) === String(t.id) ? ' clients-doc-card--selected' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="clients-doc-card__hit"
                      aria-label={`Abrir transcript: ${t.titulo}`}
                      onClick={() => openFathomTranscriptRead(t.id)}
                    >
                      <div className="clients-doc-card__preview">
                        <span>Fathom</span>
                      </div>
                      <div className="clients-doc-card__body">
                        <h4>{t.titulo}</h4>
                        <p>Fathom · Transcript</p>
                        <small>{formatFathomCardDate(t.occurred_at || t.created_at)}</small>
                      </div>
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {clienteKnowledgeSubView === 'fathom' && (fathomModal === 'create' || fathomModal === 'edit') ? (
          <div
            className="clients-modal-overlay"
            role="presentation"
            onClick={() => {
              if (!fathomSaving) setFathomModal(null)
            }}
          >
            <div
              className="clients-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="fathom-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="fathom-modal-title">{fathomModal === 'create' ? 'Nuevo transcript Fathom' : 'Editar transcript Fathom'}</h3>
              <form className="clients-fathom-form" onSubmit={handleFathomSubmit}>
                <label className="clients-field">
                  <span>Título *</span>
                  <input
                    value={fathomForm.titulo}
                    onChange={(e) => setFathomForm((p) => ({ ...p, titulo: e.target.value }))}
                    required
                    disabled={fathomSaving}
                  />
                </label>
                <label className="clients-field">
                  <span>URL de grabación</span>
                  <input
                    value={fathomForm.recording_url}
                    onChange={(e) => setFathomForm((p) => ({ ...p, recording_url: e.target.value }))}
                    disabled={fathomSaving}
                  />
                </label>
                <label className="clients-field">
                  <span>Fecha y hora de la llamada</span>
                  <input
                    type="datetime-local"
                    value={fathomForm.occurred_at}
                    onChange={(e) => setFathomForm((p) => ({ ...p, occurred_at: e.target.value }))}
                    disabled={fathomSaving}
                  />
                </label>
                <label className="clients-field clients-field--full">
                  <span>Contenido del transcript</span>
                  <textarea
                    rows={8}
                    value={fathomForm.contenido}
                    onChange={(e) => setFathomForm((p) => ({ ...p, contenido: e.target.value }))}
                    disabled={fathomSaving}
                  />
                </label>
                <div className="clients-modal-actions">
                  <button type="submit" className="login-submit" disabled={fathomSaving}>
                    {fathomSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="clients-secondary"
                    disabled={fathomSaving}
                    onClick={() => setFathomModal(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {clienteKnowledgeSubView === 'fathom' && fathomModal === 'read' && selectedFathom ? (
          <div
            className="clients-modal-overlay"
            role="presentation"
            onClick={() => setFathomModal(null)}
          >
            <div
              className="clients-modal clients-modal--read"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{selectedFathom.titulo}</h3>
              {selectedFathom.recording_url ? (
                <p className="clients-modal-link">
                  <a href={selectedFathom.recording_url} target="_blank" rel="noreferrer">
                    Ver grabación
                  </a>
                </p>
              ) : null}
              <dl className="clients-modal-dl">
                <dt>Fecha llamada</dt>
                <dd>{selectedFathom.occurred_at ? formatFathomCardDate(selectedFathom.occurred_at) : '—'}</dd>
                <dt>Creado</dt>
                <dd>{formatFathomCardDate(selectedFathom.created_at)}</dd>
              </dl>
              <div className="clients-modal-body-scroll">
                <pre className="clients-modal-pre">{selectedFathom.contenido || 'Sin contenido cargado.'}</pre>
              </div>
              <button type="button" className="login-submit" onClick={() => setFathomModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  function renderProgramaClientesView(title, relatedClients, relatedTitle, showSearch = false) {
    return (
      <>
        <header className="clients-content__header">
          <h2>{title}</h2>
        </header>

        <section className="clients-list clients-panel" aria-live="polite">
          {relatedTitle ? <h3 className="clients-list__title">{relatedTitle}</h3> : null}
          {showSearch ? (
            <div className="clients-search-wrap">
              <input
                className="clients-search-input"
                placeholder="Buscar por nombre..."
                value={boostSearch}
                onChange={(e) => setBoostSearch(e.target.value)}
              />
            </div>
          ) : null}
          {loading ? <p className="module-lead">Cargando clientes…</p> : null}
          {!loading && relatedClients.length === 0 ? (
            <p className="module-lead">Todavía no hay clientes en esta sección.</p>
          ) : null}
          {!loading && relatedClients.length > 0 ? (
            <div className="clients-folder-grid">
              {relatedClients.map((cliente) => (
                <article key={cliente.id} className="clients-folder-card">
                  <button
                    type="button"
                    className="clients-folder-card__main"
                    onClick={() => openClienteKnowledge(cliente)}
                    aria-label={`Abrir carpeta de ${cliente.nombre}${cliente.apellido ? ` ${cliente.apellido}` : ''} (ID ${cliente.codigo_publico ?? '—'})`}
                  >
                    <span className="clients-folder-card__title-row">
                      <span className="clients-folder-card__title">
                        {cliente.nombre}
                        {cliente.apellido ? ` ${cliente.apellido}` : ''}
                      </span>
                      <span
                        className="clients-folder-card__id"
                        title={cliente.codigo_publico != null ? `ID ${cliente.codigo_publico}` : String(cliente.id)}
                      >
                        {cliente.codigo_publico != null ? `#${cliente.codigo_publico}` : String(cliente.id).split('-')[0]}
                      </span>
                    </span>
                  </button>
                  <div className="clients-folder-card__menu" data-cliente-menu-root>
                    <button
                      type="button"
                      className="clients-folder-menu-btn"
                      onClick={() => toggleClienteMenu(cliente.id)}
                      aria-label={`Acciones para ${cliente.nombre}`}
                    >
                      ⋮
                    </button>
                    {menuClienteId === cliente.id ? (
                      <div className="clients-folder-menu-popover">
                        <button
                          type="button"
                          className="clients-folder-menu-item clients-folder-menu-item--danger"
                          onClick={() => handleDeleteFromMenu(cliente)}
                        >
                          Eliminar cliente
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </>
    )
  }

  function renderClientesView() {
    return (
      <>
        <header className="clients-content__header">
          <h2>CRM de clientes</h2>
          <p className="module-lead">Alta y gestión de clientes asociados a Boost o Mentoría Avanzada.</p>
        </header>

        <div className="clients-panel">
          <form className="clients-form" onSubmit={handleSubmitCliente}>
            <div className="clients-grid">
              <label className="clients-field">
                <span>Nombre *</span>
                <input
                  name="nombre"
                  value={clienteForm.nombre}
                  onChange={handleClienteChange}
                  required
                  disabled={saving}
                />
              </label>
              <label className="clients-field">
                <span>Apellido</span>
                <input
                  name="apellido"
                  value={clienteForm.apellido}
                  onChange={handleClienteChange}
                  disabled={saving}
                />
              </label>
              <label className="clients-field">
                <span>Teléfono</span>
                <input
                  name="telefono"
                  value={clienteForm.telefono}
                  onChange={handleClienteChange}
                  disabled={saving}
                />
              </label>
              <label className="clients-field">
                <span>Instagram</span>
                <input
                  name="instagram"
                  value={clienteForm.instagram}
                  onChange={handleClienteChange}
                  disabled={saving}
                />
              </label>
              <label className="clients-field">
                <span>Estado</span>
                <select
                  name="estado"
                  value={clienteForm.estado}
                  onChange={handleClienteChange}
                  disabled={saving}
                >
                  <option value="activo">activo</option>
                  <option value="inactivo">inactivo</option>
                  <option value="potencial">potencial</option>
                </select>
              </label>
              <label className="clients-field">
                <span>Programa</span>
                <select
                  name="programa"
                  value={clienteForm.programa}
                  onChange={handleClienteChange}
                  disabled={saving}
                >
                  <option value="boost">Boost</option>
                  <option value="mentoria_avanzada">Mentoría Avanzada</option>
                </select>
              </label>
              <label className="clients-field clients-field--full">
                <span>Notas</span>
                <textarea
                  name="notas"
                  value={clienteForm.notas}
                  onChange={handleClienteChange}
                  rows={3}
                  disabled={saving}
                />
              </label>
            </div>
            <div className="clients-actions">
              <button type="submit" className="login-submit" disabled={saving}>
                {saving ? 'Guardando…' : isClienteEditMode ? 'Actualizar cliente' : 'Crear cliente'}
              </button>
              {isClienteEditMode ? (
                <button
                  type="button"
                  className="clients-secondary"
                  onClick={resetClienteForm}
                  disabled={saving}
                >
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </>
    )
  }

  return (
    <div className="atv-shell">
      <main className={`clients-dashboard${sidebarOpen ? '' : ' clients-dashboard--collapsed'}`}>
        <aside className={`clients-sidebar${sidebarOpen ? '' : ' clients-sidebar--collapsed'}`}>
          <div className="clients-sidebar__brand">
            <button
              type="button"
              className="clients-sidebar__logo-btn"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? 'Ocultar menú de navegación' : 'Mostrar menú de navegación'}
            >
              <img src="/ATVLogin.png" alt="ATV" width={46} height={46} />
            </button>
            <div className="clients-sidebar__brand-main">
              <h1>ATV Clients</h1>
            </div>
          </div>

          <nav className="clients-sidebar__nav" aria-label="Navegación ATV Clients">
            <button
              type="button"
              className={`clients-sidebar__item${activeView === 'dashboard' ? ' clients-sidebar__item--active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`clients-sidebar__item${activeView === 'boost' ? ' clients-sidebar__item--active' : ''}`}
              onClick={() => setActiveView('boost')}
            >
              Boost
            </button>
            <button
              type="button"
              className={`clients-sidebar__item${activeView === 'mentoria' ? ' clients-sidebar__item--active' : ''}`}
              onClick={() => setActiveView('mentoria')}
            >
              Mentoria
            </button>
            <button
              type="button"
              className={`clients-sidebar__item${activeView === 'crear-cliente' ? ' clients-sidebar__item--active' : ''}`}
              onClick={() => setActiveView('crear-cliente')}
            >
              Crear cliente
            </button>
            <button
              type="button"
              className={`clients-sidebar__item${activeView === 'entregables' ? ' clients-sidebar__item--active' : ''}`}
              onClick={() => setActiveView('entregables')}
            >
              Entregables
            </button>
            <button
              type="button"
              className={`clients-sidebar__item${activeView === 'ia' ? ' clients-sidebar__item--active' : ''}`}
              onClick={() => setActiveView('ia')}
            >
              Claude ATV
            </button>
          </nav>

          <div className="clients-sidebar__footer">
            <button
              type="button"
              className={`clients-sidebar__item${activeView === 'ia-config' ? ' clients-sidebar__item--active' : ''}`}
              onClick={() => setActiveView('ia-config')}
            >
              Configuración
            </button>
            <Link to="/dashboard" className="clients-sidebar__back">
              ← Volver al panel
            </Link>
          </div>
        </aside>

        <section className="clients-content">
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          {activeView === 'dashboard'
            ? renderDashboardView()
            : activeView === 'boost'
            ? renderProgramaClientesView('Boost', clientesBoostFiltered, '', true)
            : activeView === 'mentoria'
            ? renderProgramaClientesView('Mentoria', clientesMentoria, 'Clientes Mentoria')
            : activeView === 'cliente-knowledge'
            ? renderClienteKnowledgeView()
            : activeView === 'crear-cliente'
            ? renderClientesView()
            : activeView === 'entregables'
            ? <EntregablesPlantillaEditor />
            : activeView === 'ia-config'
            ? renderIaConfigView()
            : activeView === 'ia'
            ? (
                <>
                  <header className="clients-content__header">
                    <h2>IA</h2>
                  </header>
                  <section className="clients-panel clients-panel--ia">
                    <div className="clients-ia-layout">
                      <aside className="clients-ia-params" aria-label="Parámetros y contexto de la IA">
                        <h3 className="clients-ia-params__title">Contexto activo</h3>
                        <p className="clients-ia-params__hint">
                          Acá vas a elegir qué información ve la IA antes de responder.
                        </p>

                        <div className="clients-ia-section">
                          <h4>Cliente objetivo</h4>
                          <div
                            ref={iaClienteComboRef}
                            className="clients-ia-combobox"
                            role="combobox"
                            aria-expanded={iaClienteListOpen && iaClienteSearch.trim().length > 0}
                            aria-haspopup="listbox"
                          >
                            <input
                              id="ia-cliente-search"
                              type="search"
                              autoComplete="off"
                              spellCheck="false"
                              className="clients-ia-combobox__input"
                              aria-label="Buscar o elegir cliente"
                              placeholder="Nombre, programa, estado, código…"
                              value={iaClienteSearch}
                              onChange={handleIaClienteSearchChange}
                              onFocus={() => setIaClienteListOpen(true)}
                              aria-controls="ia-cliente-listbox"
                              aria-autocomplete="list"
                            />
                            {iaClienteListOpen && iaClienteSearch.trim() ? (
                              <ul
                                id="ia-cliente-listbox"
                                className="clients-ia-combobox__list"
                                role="listbox"
                                aria-label="Clientes que coinciden"
                              >
                                {iaClientesFiltered.length ? (
                                  iaClientesFiltered.map((c) => (
                                    <li key={String(c.id)} role="none">
                                      <button
                                        type="button"
                                        role="option"
                                        aria-selected={String(c.id) === String(iaClienteId)}
                                        className="clients-ia-combobox__option"
                                        onMouseDown={(ev) => ev.preventDefault()}
                                        onClick={() => handlePickIaCliente(c)}
                                      >
                                        <span className="clients-ia-combobox__option-name">
                                          {clientDisplayName(c)}
                                        </span>
                                        <span className="clients-ia-combobox__option-meta">
                                          {[c.programa, c.estado].filter(Boolean).join(' · ')}
                                          {c.codigo_publico != null ? ` · #${c.codigo_publico}` : ''}
                                        </span>
                                      </button>
                                    </li>
                                  ))
                                ) : (
                                  <li className="clients-ia-combobox__empty" role="presentation">
                                    No hay coincidencias.
                                  </li>
                                )}
                              </ul>
                            ) : null}
                          </div>
                          {iaClienteId ? (
                            <p className="clients-ia-params__hint clients-ia-params__hint--scope clients-ia-combobox__selected">
                              Cliente seleccionado: <strong>{iaClienteSeleccionLabel}</strong>
                            </p>
                          ) : null}
                        </div>

                        <div className="clients-ia-section">
                          <h4>Área / rol</h4>
                          <label className="clients-ia-select-wrap">
                            <span className="visually-hidden">Área ATV para instrucciones de sistema</span>
                            <select
                              className="clients-ia-select"
                              value={iaArea}
                              onChange={(e) => setIaArea(e.target.value)}
                            >
                              <option value="cliente">Área Cliente (éxito / operación)</option>
                              <option value="venta">Área Venta</option>
                              <option value="marketing">Área Marketing</option>
                            </select>
                          </label>
                          <p className="clients-ia-params__hint clients-ia-params__hint--scope">
                            Cambia el system prompt: foco comercial, éxito de cliente o marketing según elijas.
                          </p>
                        </div>

                        <div className="clients-ia-section">
                          <h4>Fuentes</h4>
                          <div className="clients-ia-switch-row">
                            <label className="clients-ia-switch">
                              <input
                                type="checkbox"
                                checked={iaIncludeFathom}
                                onChange={(e) => setIaIncludeFathom(e.target.checked)}
                              />
                              <span>Transcripts Fathom</span>
                            </label>
                            <label className="clients-ia-switch">
                              <input
                                type="checkbox"
                                checked={iaIncludeDiscord}
                                onChange={(e) => setIaIncludeDiscord(e.target.checked)}
                              />
                              <span>Documento Discord</span>
                            </label>
                            <label className="clients-ia-switch">
                              <input
                                type="checkbox"
                                checked={iaIncludeOnboarding}
                                onChange={(e) => setIaIncludeOnboarding(e.target.checked)}
                              />
                              <span>Entregables / Onboarding</span>
                            </label>
                          </div>
                        </div>

                        <div className="clients-ia-section clients-ia-section--system">
                          <h4>Instrucciones del sistema</h4>
                          <p className="clients-ia-params__system">
                            {iaSystemInstruction}
                          </p>
                        </div>
                      </aside>

                      <div className="clients-ia-chat" aria-label="Conversación con la IA">
                        <div className="clients-ia-chat-thread">
                          {iaMessages.map((msg) => (
                            <article
                              key={msg.id}
                              className={`clients-ia-msg clients-ia-msg--${msg.role}`}
                            >
                              <div className="clients-ia-msg__avatar">
                                {msg.role === 'assistant' ? 'IA' : 'Tú'}
                              </div>
                              <div className="clients-ia-msg__bubble">
                                <div className="clients-ia-msg__role">
                                  {msg.role === 'assistant' ? 'Claude ATV' : 'Usuario'}
                                </div>
                                {msg.thinking ? (
                                  <div className="clients-ia-thinking" aria-live="polite" aria-label="Claude pensando respuesta">
                                    <span className="clients-ia-thinking__dot" />
                                    <span className="clients-ia-thinking__dot" />
                                    <span className="clients-ia-thinking__dot" />
                                  </div>
                                ) : msg.streaming ? (
                                  <div className="clients-ia-msg__content clients-ia-msg__content--stream">
                                    {msg.content}
                                  </div>
                                ) : (
                                  <div className="clients-ia-msg__content">{renderIaContent(msg.content)}</div>
                                )}
                                {msg.role === 'assistant' && msg.usage ? (
                                  <div className="clients-ia-msg__usage">
                                    Consumo: entrada {msg.usage.inputTokens ?? '—'} / salida{' '}
                                    {msg.usage.outputTokens ?? '—'} / total{' '}
                                    {msg.usage.totalTokens ?? '—'} tokens · costo aprox USD{' '}
                                    {Number(msg.usage.costUsd || 0).toFixed(4)}
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>

                        <form className="clients-ia-input-row" onSubmit={handleIaSubmit}>
                          <label className="clients-ia-input-wrap">
                            <span className="visually-hidden">Escribí tu mensaje para la IA</span>
                            <textarea
                              rows={2}
                              value={iaInput}
                              onChange={(e) => setIaInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  if (iaInput.trim() && iaClienteId && !iaSending) {
                                    handleIaSubmit(e)
                                  }
                                }
                              }}
                              placeholder="Preguntale a la IA… Ej: “Dame un resumen de los últimos transcripts Fathom de este cliente.”"
                            />
                          </label>
                          <button
                            type="submit"
                            className="login-submit clients-ia-send"
                            disabled={!iaInput.trim() || !iaClienteId || iaSending}
                          >
                            {iaSending ? 'Consultando…' : 'Enviar'}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                </>
              )
            : null}
        </section>
      </main>
    </div>
  )
}
