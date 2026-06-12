import { useEffect, useMemo, useState } from 'react'
import { listAreas, listTickets } from '../../api.js'
import TicketsKanban from './components/TicketsKanban.jsx'

export default function DiscordDashboard() {
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

  const kpis = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.estado !== 'resuelto' && t.estado !== 'cerrado').length
    const resolvedToday = tickets.filter((t) => {
      if (t.estado !== 'resuelto') return false
      const d = new Date(t.updated_at)
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    }).length
    return { total, open, resolvedToday }
  }, [tickets])

  return (
    <>
      <header className="dsc-page-head">
        <h2 className="dsc-up">Dashboard</h2>
        <p>Kanban de tickets real (según tu área; ADMIN ve todo).</p>
      </header>

      <section className="dsc-panel">
        <div className="dsc-kpi-grid">
          <div className="dsc-kpi">
            <span>Total tickets</span>
            <strong>{kpis.total}</strong>
          </div>
          <div className="dsc-kpi">
            <span>Abiertos</span>
            <strong>{kpis.open}</strong>
          </div>
          <div className="dsc-kpi">
            <span>Resueltos hoy</span>
            <strong>{kpis.resolvedToday}</strong>
          </div>
          <div className="dsc-kpi">
            <span>Estado</span>
            <strong>{loading ? 'Cargando…' : error ? 'Error' : 'OK'}</strong>
          </div>
        </div>
        {error ? (
          <p style={{ margin: '0.85rem 0 0', color: 'var(--muted)' }}>{error}</p>
        ) : null}
      </section>

      <section className="dsc-panel">
        <TicketsKanban tickets={tickets} areas={areas} onMutate={refresh} />
      </section>
    </>
  )
}
