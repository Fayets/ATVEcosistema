import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { PriorityBadge } from './components/PriorityBadge.jsx'
import { TransferModal } from './components/TransferModal.jsx'
import { fmtDateTime, fmtHours, formatTicketPregunta } from './format.js'
import { getMockTicket } from './mockData.js'

export default function DiscordTicketDetail() {
  const { id } = useParams()
  const ticket = getMockTicket(id)
  const [reply, setReply] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [toast, setToast] = useState(null)

  if (!ticket) {
    return (
      <>
        <header className="dsc-page-head">
          <Link to="/m/discord/tickets" className="dsc-back">
            ← Volver a tickets
          </Link>
          <h2>Ticket no encontrado</h2>
        </header>
      </>
    )
  }

  function showToast(msg) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  return (
    <>
      <header className="dsc-page-head">
        <Link to="/m/discord/tickets" className="dsc-back">
          ← Volver a tickets
        </Link>
        <h2>
          Ticket #{ticket.num} <PriorityBadge band={ticket.priorityBand} />
        </h2>
        <p>{ticket.client}</p>
      </header>

      {toast ? (
        <div className="dsc-panel" style={{ borderColor: 'rgba(100,200,140,0.45)' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#9fe8c3' }}>{toast}</p>
        </div>
      ) : null}

      <div className="dsc-detail-grid">
        <section className="dsc-panel">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#f2f0f7' }}>Información</h3>
          <dl className="dsc-dl">
            <dt>Cliente</dt>
            <dd>{ticket.client}</dd>
            <dt>Área actual</dt>
            <dd>{ticket.area}</dd>
            <dt>Estado</dt>
            <dd>{ticket.status}</dd>
            <dt>Creado</dt>
            <dd>{fmtDateTime(ticket.createdAt)}</dd>
            <dt>Última actividad</dt>
            <dd>{fmtDateTime(ticket.updatedAt)}</dd>
            <dt>Tiempo total</dt>
            <dd>{fmtHours(ticket.totalHoursOpen)}</dd>
            <dt>Tiempo en esta área</dt>
            <dd>{fmtHours(ticket.hoursInArea)}</dd>
          </dl>
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: 'rgba(242,240,247,0.75)' }}>
              Pregunta
            </h4>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: 'rgba(242,240,247,0.92)' }}>
              {formatTicketPregunta(ticket.question, ticket.discord_autor)}
            </p>
          </div>
        </section>

        <section className="dsc-panel">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#f2f0f7' }}>
            Historial de transferencias
          </h3>
          {ticket.transfers.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'rgba(242,240,247,0.6)' }}>
              Sin transferencias registradas.
            </p>
          ) : (
            <ul className="dsc-timeline">
              {ticket.transfers.map((tr) => (
                <li key={tr.id}>
                  <time dateTime={tr.at}>{fmtDateTime(tr.at)}</time>
                  <p>
                    <strong>{tr.by}</strong>: {tr.fromArea} → {tr.toArea}
                  </p>
                  <p className="dsc-note">{tr.note}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="dsc-panel">
        <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem', color: '#f2f0f7' }}>Responder</h3>
        <textarea
          className="dsc-textarea"
          placeholder="Respuesta al cliente (mock)…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
        />
        <div className="dsc-actions-row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="dsc-btn dsc-btn--primary"
            onClick={() => {
              if (!reply.trim()) {
                showToast('Escribí un mensaje para simular el envío.')
                return
              }
              showToast('Respuesta guardada (demo).')
              setReply('')
            }}
          >
            Enviar respuesta
          </button>
          <button type="button" className="dsc-btn dsc-btn--secondary" onClick={() => setTransferOpen(true)}>
            Transferir
          </button>
          <button type="button" className="dsc-btn dsc-btn--danger" onClick={() => showToast('Ticket cerrado (demo).')}>
            Cerrar ticket
          </button>
        </div>
      </section>

      <TransferModal
        open={transferOpen}
        currentArea={ticket.area}
        onClose={() => setTransferOpen(false)}
        onConfirm={(area, note) => {
          showToast(note ? `Transferencia simulada a ${area}.` : `Transferencia simulada a ${area} (sin nota).`)
        }}
      />
    </>
  )
}
