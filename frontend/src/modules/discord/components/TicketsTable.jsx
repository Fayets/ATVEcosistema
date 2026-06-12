import { Link } from 'react-router-dom'
import { fmtHours, formatTicketPregunta } from '../format.js'
import { PriorityBadge } from './PriorityBadge.jsx'

export function TicketsTable({ tickets }) {
  if (tickets.length === 0) {
    return (
      <p style={{ margin: 0, color: 'rgba(242,240,247,0.65)', fontSize: '0.9rem' }}>
        No hay tickets con estos filtros.
      </p>
    )
  }

  return (
    <div className="dsc-table-wrap">
      <table className="dsc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Área</th>
            <th>Pregunta</th>
            <th>Tiempo total</th>
            <th>Tiempo en área</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((row) => (
            <tr key={row.id}>
              <td>{row.num}</td>
              <td>{row.client}</td>
              <td>{row.area}</td>
              <td>
                <span className="dsc-truncate" title={formatTicketPregunta(row.question, row.discord_autor)}>
                  {formatTicketPregunta(row.question, row.discord_autor)}
                </span>
              </td>
              <td>{fmtHours(row.totalHoursOpen)}</td>
              <td>{fmtHours(row.hoursInArea)}</td>
              <td>
                <PriorityBadge band={row.priorityBand} />
              </td>
              <td>
                <span className="dsc-status">{row.status}</span>
              </td>
              <td>
                <Link to={`/m/discord/tickets/${row.id}`} className="dsc-link-btn">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
