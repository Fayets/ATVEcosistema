const AREAS = ['Todos', 'Ventas', 'Marketing', 'Producto', 'Sistemas', 'ADS']
const STATUSES = ['Todos', 'Abierto', 'En curso', 'Resuelto']
const PRIOS = ['Todos', 'green', 'yellow', 'orange', 'red']

const PRIO_LABEL = {
  Todos: 'Todas',
  green: '< 4 h',
  yellow: '4–8 h',
  orange: '8–24 h',
  red: '+24 h',
}

export function TicketFilters({ value, onChange }) {
  return (
    <div className="dsc-filters">
      <label className="dsc-field">
        <span>Área</span>
        <select
          className="dsc-select"
          value={value.area}
          onChange={(e) => onChange({ ...value, area: e.target.value })}
        >
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="dsc-field">
        <span>Estado</span>
        <select
          className="dsc-select"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="dsc-field">
        <span>Prioridad</span>
        <select
          className="dsc-select"
          value={value.priority}
          onChange={(e) => onChange({ ...value, priority: e.target.value })}
        >
          {PRIOS.map((p) => (
            <option key={p} value={p}>
              {PRIO_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
