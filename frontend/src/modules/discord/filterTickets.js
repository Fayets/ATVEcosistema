export function filterTickets(rows, filters) {
  return rows.filter((t) => {
    if (filters.area !== 'Todos' && t.area !== filters.area) return false
    if (filters.status !== 'Todos' && t.status !== filters.status) return false
    if (filters.priority !== 'Todos' && t.priorityBand !== filters.priority) return false
    return true
  })
}
