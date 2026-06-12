import { useEffect, useMemo, useState } from 'react'
import TicketDrawer from './components/TicketDrawer.jsx'
import { fmtAgoLive, fmtDateTime, formatTicketPregunta, atBackendUtcMs, hoursSinceUtc } from './format.js'
import { listAreas, listTickets } from '../../api.js'
import { hoursToPriorityBand } from './priority.js'
import { useNowMsEveryInterval } from './useMinuteClock.js'

function toDateKey(iso) {
  const t = atBackendUtcMs(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfTodayKey() {
  return toDateKey(new Date().toISOString())
}

const PRIO_LABEL = {
  green: '≤ 4h',
  yellow: '4–12h',
  orange: '12–24h',
  red: '+24h',
}

export default function DiscordTickets() {
  const [selectedId, setSelectedId] = useState(null)
  const [day, setDay] = useState(() => startOfTodayKey())
  const nowMs = useNowMsEveryInterval(1000)
  const [areas, setAreas] = useState([])
  const [tickets, setTickets] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const [a, t] = await Promise.all([listAreas(), listTickets()])
    setAreas(a || [])
    setTickets(t || [])
  }

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los tickets.')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const rows = useMemo(() => {
    const filtered = tickets.filter((t) => toDateKey(t.created_at) === day)
    return filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }, [day, tickets])

  function priorityBand(createdAtIso) {
    const h = hoursSinceUtc(createdAtIso, nowMs)
    return hoursToPriorityBand(h)
  }

  return (
    <>
      <header className="dsc-page-head">
        <h2 className="dsc-up">Historial</h2>
        <p>Tickets por día en formato tabla. Click en una fila para abrir el panel lateral.</p>
      </header>

      <section className="dsc-panel">
        <div className="dsc-history-toolbar">
          <label className="dsc-field">
            <span>Día</span>
            <input
              className="dsc-input"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <div className="dsc-history-quick">
            <button type="button" className="dsc-btn dsc-btn--secondary" onClick={() => setDay(startOfTodayKey())}>
              Hoy
            </button>
            <button
              type="button"
              className="dsc-btn dsc-btn--secondary"
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 1)
                setDay(toDateKey(d.toISOString()))
              }}
            >
              Ayer
            </button>
          </div>
          <p className="dsc-history-count dsc-mono">{loading ? 'Cargando…' : `${rows.length} tickets`}</p>
        </div>

        <div className="dsc-table-wrap">
          <table className="dsc-table" aria-label="Historial de tickets">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente / canal</th>
                <th>Área</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Creado</th>
                <th>Hace</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '0.85rem 0.65rem', color: 'var(--muted)' }}>
                    No hay tickets para este día.
                  </td>
                </tr>
              ) : (
                rows.map((t) => {
                  const band = priorityBand(t.created_at)
                  const label = PRIO_LABEL[band] || band
                  return (
                    <tr
                      key={t.id}
                      className={`dsc-row dsc-row--${band}`}
                      onClick={() => setSelectedId(t.id)}
                      title={formatTicketPregunta(t.pregunta, t.discord_autor)}
                      role="button"
                    >
                      <td className="dsc-mono">#{t.id}</td>
                      <td className="dsc-up">{t.canal_discord}</td>
                      <td className="dsc-up">{t.area_nombre}</td>
                      <td className="dsc-up">{t.estado}</td>
                      <td className="dsc-mono">{label}</td>
                      <td className="dsc-mono">{fmtDateTime(t.created_at)}</td>
                      <td className="dsc-mono">{fmtAgoLive(t.created_at, nowMs)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {error ? <p style={{ margin: '0.85rem 0 0', color: 'var(--muted)' }}>{error}</p> : null}
      </section>

      <TicketDrawer
        key={selectedId || 'none'}
        open={Boolean(selectedId)}
        ticketId={selectedId}
        areas={areas}
        onMutate={refresh}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}
