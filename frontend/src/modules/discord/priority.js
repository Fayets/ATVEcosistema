/** SLA por horas abiertas: <4 verde, 4–12 amarillo, 12–24 naranja, +24 rojo */
export function hoursToPriorityBand(hours) {
  if (hours < 4) return 'green'
  if (hours < 12) return 'yellow'
  if (hours < 24) return 'orange'
  return 'red'
}

export function priorityLabel(band) {
  switch (band) {
    case 'green':
      return '< 4 h'
    case 'yellow':
      return '4–12 h'
    case 'orange':
      return '12–24 h'
    case 'red':
      return '+24 h'
    default:
      return band
  }
}
