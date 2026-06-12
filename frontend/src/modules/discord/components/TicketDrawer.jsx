import { useEffect, useMemo, useState } from 'react'
import { cerrarTicket, getTicketDetail, responderTicket, transferirTicket } from '../../../api.js'
import { fmtAgoLive, fmtDateTime, fmtElapsedLive, formatTicketPregunta, hoursSinceUtc } from '../format.js'
import { useNowMsEveryInterval } from '../useMinuteClock.js'
import { TransferModal } from './TransferModal.jsx'

function useEscClose(open, onClose) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
}

function computeHoursInArea(detail, nowMs) {
  const ticket = detail?.ticket
  if (!ticket) return 0
  const transfers = detail.transferencias || []
  if (transfers.length === 0) return hoursSinceUtc(ticket.created_at, nowMs)
  const last = transfers[transfers.length - 1]
  return hoursSinceUtc(last.created_at, nowMs)
}

export default function TicketDrawer({ open, ticketId, areas, onMutate, onClose }) {
  const [reply, setReply] = useState('')
  const [toast, setToast] = useState(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const nowMs = useNowMsEveryInterval(1000)

  useEscClose(open, onClose)

  const transfers = useMemo(() => detail?.transferencias || [], [detail])
  const ticket = detail?.ticket || null
  const hoursTotal = ticket ? hoursSinceUtc(ticket.created_at, nowMs) : 0
  const hoursInArea = detail ? computeHoursInArea(detail, nowMs) : 0

  function showToast(msg) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => {
    if (!open || !ticketId) return
    let alive = true
    getTicketDetail(ticketId)
      .then((d) => {
        if (!alive) return
        setDetail(d)
      })
      .catch((e) => {
        if (!alive) return
        showToast(e instanceof Error ? e.message : 'No se pudo cargar el ticket.')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, ticketId])

  if (!open) return null

  return (
    <>
      <div
        className="dsc-drawer-overlay"
        role="presentation"
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) onClose()
        }}
      >
        <aside className="dsc-drawer" role="dialog" aria-modal="true" aria-label={`Ticket ${ticketId}`}>
          <header className="dsc-drawer__head">
            <div>
              <p className="dsc-drawer__kicker dsc-mono">TICKET #{ticketId}</p>
              <h3 className="dsc-drawer__title dsc-up">{ticket?.area_nombre || '—'}</h3>
              <p className="dsc-drawer__client dsc-up">
                {(ticket?.discord_autor && String(ticket.discord_autor).trim()) ||
                  ticket?.canal_discord ||
                  '—'}
              </p>
            </div>
            <button type="button" className="dsc-drawer__close" onClick={onClose} aria-label="Cerrar panel">
              ×
            </button>
          </header>

          {toast ? (
            <div className="dsc-drawer__toast" role="status">
              {toast}
            </div>
          ) : null}

          {loading ? (
            <section className="dsc-drawer__section">
              <p className="dsc-drawer__p dsc-drawer__muted">Cargando…</p>
            </section>
          ) : null}

          {ticket ? (
            <section className="dsc-drawer__section">
              <h4 className="dsc-drawer__h4 dsc-mono">Pregunta</h4>
              <p className="dsc-drawer__p">{formatTicketPregunta(ticket.pregunta, ticket.discord_autor)}</p>
            </section>
          ) : null}

          {ticket ? (
          <section className="dsc-drawer__section dsc-drawer__meta">
            <div className="dsc-drawer__metaItem">
              <span className="dsc-drawer__metaK dsc-mono">Tiempo total</span>
              <strong className="dsc-drawer__metaV">{fmtElapsedLive(hoursTotal)}</strong>
            </div>
            <div className="dsc-drawer__metaItem">
              <span className="dsc-drawer__metaK dsc-mono">Tiempo en área</span>
              <strong className="dsc-drawer__metaV">{fmtElapsedLive(hoursInArea)}</strong>
            </div>
            <div className="dsc-drawer__metaItem">
              <span className="dsc-drawer__metaK dsc-mono">Hace</span>
              <strong className="dsc-drawer__metaV">{fmtAgoLive(ticket.created_at, nowMs)}</strong>
            </div>
          </section>
          ) : null}

          <section className="dsc-drawer__section">
            <h4 className="dsc-drawer__h4 dsc-mono">Transferencias</h4>
            {transfers.length === 0 ? (
              <p className="dsc-drawer__p dsc-drawer__muted">Sin transferencias registradas.</p>
            ) : (
              <ul className="dsc-drawer__timeline">
                {transfers.map((tr) => (
                  <li key={tr.id}>
                    <time className="dsc-mono" dateTime={tr.created_at}>
                      {fmtDateTime(tr.created_at)}
                    </time>
                    <p className="dsc-drawer__p">
                      {tr.area_origen} → {tr.area_destino}
                    </p>
                    {tr.nota ? <p className="dsc-drawer__p dsc-drawer__muted">{tr.nota}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dsc-drawer__section">
            <h4 className="dsc-drawer__h4 dsc-mono">Responder</h4>
            <textarea
              className="dsc-textarea"
              placeholder="Escribí una respuesta…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
            />
            <div className="dsc-actions-row" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="dsc-btn dsc-btn--primary"
                onClick={async () => {
                  if (!reply.trim()) {
                    showToast('Escribí un mensaje para responder.')
                    return
                  }
                  try {
                    await responderTicket(ticketId, reply.trim())
                    setReply('')
                    showToast('Respuesta enviada.')
                    const d = await getTicketDetail(ticketId)
                    setDetail(d)
                    onMutate?.()
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : 'No se pudo responder.')
                  }
                }}
              >
                Responder
              </button>
              <button type="button" className="dsc-btn dsc-btn--secondary" onClick={() => setTransferOpen(true)}>
                Transferir
              </button>
              <button
                type="button"
                className="dsc-btn dsc-btn--danger"
                onClick={async () => {
                  try {
                    await cerrarTicket(ticketId)
                    showToast('Ticket cerrado.')
                    const d = await getTicketDetail(ticketId)
                    setDetail(d)
                    onMutate?.()
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : 'No se pudo cerrar.')
                  }
                }}
              >
                Cerrar ticket
              </button>
            </div>
          </section>
        </aside>
      </div>

      <TransferModal
        open={transferOpen}
        currentAreaId={ticket?.area_id}
        areas={areas || []}
        onClose={() => setTransferOpen(false)}
        onConfirm={async (areaId, note) => {
          try {
            await transferirTicket(ticketId, areaId, note || null)
            showToast('Ticket transferido.')
            const d = await getTicketDetail(ticketId)
            setDetail(d)
            onMutate?.()
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'No se pudo transferir.')
          }
        }}
      />
    </>
  )
}

