import { useMemo, useState } from 'react'
import { hoursToPriorityBand } from '../priority.js'
import { fmtAgoLive, formatTicketPregunta, hoursSinceUtc } from '../format.js'
import { useNowMsEveryInterval } from '../useMinuteClock.js'
import TicketDrawer from './TicketDrawer.jsx'

const AREA_META = [
  { area: 'Ventas', color: '#d6a11d' },
  { area: 'Marketing', color: '#f6d84e' },
  { area: 'Producto', color: '#4285F4' },
  { area: 'Sistemas', color: '#ff8a1f' },
  { area: 'ADS', color: '#c06bff' },
]

function calcPriorityBand(createdAtIso, nowMs) {
  const h = hoursSinceUtc(createdAtIso, nowMs)
  return hoursToPriorityBand(h)
}

function ticketTooltip(t, nowMs) {
  const q = formatTicketPregunta(String(t.pregunta || '').trim(), t.discord_autor)
    .split(/\s+/)
    .slice(0, 9)
    .join(' ')
  const band = calcPriorityBand(t.created_at, nowMs)
  return `${String(t.canal_discord || '').toUpperCase()} — ${q}… | Prioridad: ${band.toUpperCase()}`
}

function TicketCard({ t, onOpen, nowMs }) {
  const band = calcPriorityBand(t.created_at, nowMs)
  return (
    <button
      type="button"
      className={`dsc-ticket dsc-ticket--${band}`}
      onClick={() => onOpen(t.id)}
      title={ticketTooltip(t, nowMs)}
    >
      <div className="dsc-ticket__top">
        <p className="dsc-ticket__client">{t.canal_discord}</p>
        <span className="dsc-ticket__num dsc-mono">#{t.id}</span>
      </div>
      <div className="dsc-ticket__foot">
        <span className="dsc-ticket__ago dsc-mono">{fmtAgoLive(t.created_at, nowMs)}</span>
      </div>

      <div className="dsc-ticket__hover">
        <p className="dsc-ticket__q">{formatTicketPregunta(t.pregunta, t.discord_autor)}</p>
      </div>
    </button>
  )
}

export default function TicketsKanban({ tickets, areas, onMutate }) {
  const open = tickets.filter((t) => t.estado !== 'resuelto' && t.estado !== 'cerrado')
  const [selectedId, setSelectedId] = useState(null)
  const nowMs = useNowMsEveryInterval(1000)

  const areaById = useMemo(() => new Map((areas || []).map((a) => [a.id, a])), [areas])
  const grouped = useMemo(() => {
    const byName = new Map()
    for (const t of open) {
      const a = areaById.get(t.area_id)
      const name = a?.nombre || t.area_nombre || String(t.area_id)
      const color = a?.color || null
      if (!byName.has(name)) byName.set(name, { area: name, color, tickets: [] })
      byName.get(name).tickets.push(t)
    }
    return Array.from(byName.values()).sort((a, b) => String(a.area).localeCompare(String(b.area)))
  }, [open, areaById])

  return (
    <>
      <div className="dsc-kanban" role="list">
        {grouped.map((col) => (
          <section key={col.area} className="dsc-col" aria-label={col.area}>
            <header className="dsc-col__head">
              <div className="dsc-col__title">
                <span className="dsc-col__dot" style={{ background: col.color || '#999' }} />
                <strong>{col.area}</strong>
              </div>
              <span className="dsc-col__count">{String(col.tickets.length).padStart(2, '0')}</span>
            </header>
            <div className="dsc-col__body">
              {col.tickets.length === 0 ? (
                <p style={{ margin: 0, color: 'rgba(242,240,247,0.5)', fontSize: '0.82rem' }}>Sin tickets.</p>
              ) : (
                col.tickets.map((t) => <TicketCard key={t.id} t={t} onOpen={setSelectedId} nowMs={nowMs} />)
              )}
            </div>
          </section>
        ))}
      </div>

      <TicketDrawer
        key={selectedId || 'none'}
        open={Boolean(selectedId)}
        ticketId={selectedId}
        areas={areas}
        onMutate={onMutate}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}

