import { useEffect, useMemo, useState } from 'react'
import { fmtHours, atBackendUtcMs } from './format.js'
import { listStaff, listTickets } from '../../api.js'
import { hoursToPriorityBand } from './priority.js'
import { useNowMsEveryLocalMinute } from './useMinuteClock.js'

function isOpenStatus(estado) {
  return estado !== 'resuelto' && estado !== 'cerrado'
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function avg(list) {
  if (list.length === 0) return 0
  return list.reduce((a, b) => a + b, 0) / list.length
}

function pct(n, d) {
  if (!d) return '0%'
  return `${Math.round((n / d) * 100)}%`
}

export default function DiscordMetrics() {
  const [tickets, setTickets] = useState([])
  const [staff, setStaff] = useState([])
  const [error, setError] = useState('')
  const nowMs = useNowMsEveryLocalMinute()

  useEffect(() => {
    let alive = true
    Promise.all([listTickets(), listStaff()])
      .then(([t, s]) => {
        if (!alive) return
        setTickets(t || [])
        setStaff(s || [])
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudieron cargar métricas.')
      })
    return () => {
      alive = false
    }
  }, [])

  const computed = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => isOpenStatus(t.estado))
    const resolved = tickets.filter((t) => t.estado === 'resuelto')

    const durationHours = (startIso, endIso) => {
      const a = atBackendUtcMs(startIso)
      const b = atBackendUtcMs(endIso)
      if (Number.isNaN(a) || Number.isNaN(b)) return 0
      return Math.max(0, b - a) / 3600_000
    }

    // “Tiempo total de respuesta”: desde created_at hasta now (si abierto) o updated_at (si resuelto/cerrado)
    const nowIso = new Date(nowMs).toISOString()
    const totalHours = tickets.map((t) =>
      isOpenStatus(t.estado) ? durationHours(t.created_at, nowIso) : durationHours(t.created_at, t.updated_at),
    )
    const avgTotalAll = avg(totalHours)

    // “Tiempo en área”: aproximación = tiempo desde último updated_at (actividad en área actual)
    const areaHours = open.map((t) => durationHours(t.updated_at, nowIso))
    const avgAreaAll = avg(areaHours)

    const breaches = {
      red: 0,
      orange: 0,
      yellow: 0,
      green: 0,
    }

    for (const t of open) {
      const h = durationHours(t.created_at, nowIso)
      const band = hoursToPriorityBand(h)
      breaches[band] += 1
    }

    const areasSet = new Set(tickets.map((t) => t.area_nombre).filter(Boolean))
    const areas = Array.from(areasSet).sort((a, b) => String(a).localeCompare(String(b)))

    const byArea = areas.map((area) => {
      const rows = tickets.filter((t) => t.area_nombre === area)
      const openCount = rows.filter((t) => isOpenStatus(t.estado)).length
      const resolvedCount = rows.filter((t) => t.estado === 'resuelto').length
      const avgTotal = avg(
        rows.map((t) =>
          isOpenStatus(t.estado)
            ? durationHours(t.created_at, nowIso)
            : durationHours(t.created_at, t.updated_at),
        ),
      )
      const avgInArea = avg(rows.filter((t) => isOpenStatus(t.estado)).map((t) => durationHours(t.updated_at, nowIso)))
      const redCount = rows.filter((t) => {
        if (!isOpenStatus(t.estado)) return false
        const h = durationHours(t.created_at, nowIso)
        return hoursToPriorityBand(h) === 'red'
      }).length
      return { area, total: rows.length, open: openCount, resolved: resolvedCount, avgTotal, avgInArea, red: redCount }
    })

    const maxAreaTotal = Math.max(1, ...byArea.map((x) => x.total))
    const maxAvgTotal = Math.max(1, ...byArea.map((x) => x.avgTotal))
    const maxAvgInArea = Math.max(1, ...byArea.map((x) => x.avgInArea))

    return {
      total,
      open: open.length,
      resolved: resolved.length,
      avgTotalAll,
      avgAreaAll,
      breaches,
      byArea,
      maxAreaTotal,
      maxAvgTotal,
      maxAvgInArea,
    }
  }, [tickets, nowMs])

  function exportCsv() {
    const header = 'staff,area,resueltos,primera_respuesta_min,transferencias_salida'
    const lines = staff.map(
      (s) =>
        `${JSON.stringify(s.username)},${JSON.stringify(s.area_nombre)},0,0,0`,
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atv-discord-metricas-${new Date().toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header className="dsc-page-head">
        <h2 className="dsc-up">Métricas</h2>
        <p>Lo importante: tiempos de respuesta y volumen de tickets por área.</p>
      </header>

      <section className="dsc-panel">
        <div className="dsc-metrics-hero">
          <div className="dsc-metrics-kpis">
            <div className="dsc-metrics-kpi">
              <span className="dsc-mono">Tickets</span>
              <strong>{computed.total}</strong>
              <small className="dsc-mono">{computed.open} abiertos · {computed.resolved} resueltos</small>
            </div>
            <div className="dsc-metrics-kpi dsc-metrics-kpi--time">
              <span className="dsc-mono">Tiempo total promedio</span>
              <strong>{fmtHours(computed.avgTotalAll)}</strong>
              <small className="dsc-mono">Desde que el cliente pregunta</small>
            </div>
            <div className="dsc-metrics-kpi dsc-metrics-kpi--time">
              <span className="dsc-mono">Tiempo promedio en área</span>
              <strong>{fmtHours(computed.avgAreaAll)}</strong>
              <small className="dsc-mono">Bottleneck actual</small>
            </div>
            <div className="dsc-metrics-kpi dsc-metrics-kpi--sla">
              <span className="dsc-mono">SLA</span>
              <strong>{computed.breaches.red}</strong>
              <small className="dsc-mono">tickets en rojo (+24h)</small>
            </div>
          </div>

          <div className="dsc-metrics-sla">
            <h3 className="dsc-up">Distribución por prioridad</h3>
            <div className="dsc-sla-bar" aria-label="Prioridad">
              {(['green', 'yellow', 'orange', 'red']).map((k) => {
                const n = computed.breaches[k]
                const w = clamp01(n / Math.max(1, computed.total)) * 100
                return <span key={k} className={`dsc-sla-seg dsc-sla-seg--${k}`} style={{ width: `${w}%` }} />
              })}
            </div>
            <div className="dsc-sla-legend dsc-mono">
              <span className="dsc-sla-pill dsc-sla-pill--green">VERDE {computed.breaches.green} ({pct(computed.breaches.green, computed.total)})</span>
              <span className="dsc-sla-pill dsc-sla-pill--yellow">AMARILLO {computed.breaches.yellow} ({pct(computed.breaches.yellow, computed.total)})</span>
              <span className="dsc-sla-pill dsc-sla-pill--orange">NARANJA {computed.breaches.orange} ({pct(computed.breaches.orange, computed.total)})</span>
              <span className="dsc-sla-pill dsc-sla-pill--red">ROJO {computed.breaches.red} ({pct(computed.breaches.red, computed.total)})</span>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="dsc-panel">
          <p style={{ margin: 0, color: 'var(--muted)' }}>{error}</p>
        </section>
      ) : null}

      <section className="dsc-panel">
        <h3 className="dsc-up">Por área</h3>
        <p style={{ margin: '0.35rem 0 0.85rem', color: 'var(--muted)' }}>
          Volumen (tickets) y tiempos promedio (total vs en área). Útil para detectar cuellos de botella.
        </p>
        <div className="dsc-area-metrics">
          {computed.byArea.map((a) => (
            <div key={a.area} className="dsc-area-card">
              <div className="dsc-area-card__head">
                <strong className="dsc-up">{a.area}</strong>
                <span className="dsc-mono">{a.total} tickets</span>
              </div>
              <div className="dsc-area-card__grid">
                <div className="dsc-area-stat">
                  <span className="dsc-mono">Abiertos</span>
                  <strong>{a.open}</strong>
                </div>
                <div className="dsc-area-stat">
                  <span className="dsc-mono">Rojos</span>
                  <strong>{a.red}</strong>
                </div>
              </div>

              <div className="dsc-area-bars">
                <div className="dsc-area-barRow">
                  <span className="dsc-mono">Volumen</span>
                  <div className="dsc-area-track">
                    <span
                      className="dsc-area-fill dsc-area-fill--vol"
                      style={{ width: `${(a.total / computed.maxAreaTotal) * 100}%` }}
                    />
                  </div>
                  <span className="dsc-mono">{a.total}</span>
                </div>
                <div className="dsc-area-barRow">
                  <span className="dsc-mono">Tiempo total</span>
                  <div className="dsc-area-track">
                    <span
                      className="dsc-area-fill dsc-area-fill--t"
                      style={{ width: `${(a.avgTotal / computed.maxAvgTotal) * 100}%` }}
                    />
                  </div>
                  <span className="dsc-mono">{fmtHours(a.avgTotal)}</span>
                </div>
                <div className="dsc-area-barRow">
                  <span className="dsc-mono">En área</span>
                  <div className="dsc-area-track">
                    <span
                      className="dsc-area-fill dsc-area-fill--a"
                      style={{ width: `${(a.avgInArea / computed.maxAvgInArea) * 100}%` }}
                    />
                  </div>
                  <span className="dsc-mono">{fmtHours(a.avgInArea)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dsc-panel">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <h3 className="dsc-up" style={{ margin: 0, fontSize: '1rem' }}>
            Performance por staff
          </h3>
          <button type="button" className="dsc-btn dsc-btn--secondary" onClick={exportCsv}>
            Exportar CSV del mes
          </button>
        </div>
        <div className="dsc-table-wrap">
          <table className="dsc-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Área</th>
                <th>Resueltos</th>
                <th>1ª resp. (min)</th>
                <th>Transferencias salida</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="dsc-up">{s.username}</td>
                  <td className="dsc-up">{s.area_nombre}</td>
                  <td className="dsc-mono">—</td>
                  <td className="dsc-mono">—</td>
                  <td className="dsc-mono">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
