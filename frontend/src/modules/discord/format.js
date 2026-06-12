export function fmtHours(h) {
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${h.toFixed(1)} h`
}

/**
 * El API suele devolver datetimes UTC sin zona (Pony `utcnow`).
 * Sin `Z`, `Date` los interpreta como hora local y el diff queda en 0 o fijo.
 */
export function atBackendUtcMs(iso) {
  if (iso == null || iso === '') return NaN
  let s = String(iso).trim()
  if (!s) return NaN
  const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s)
  if (!hasTz) {
    if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T')
    if (!/[zZ]$/.test(s)) s = `${s}Z`
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? NaN : t
}

/** Horas transcurridas desde `iso` (UTC backend) hasta `nowMs`. */
export function hoursSinceUtc(iso, nowMs = Date.now()) {
  const start = atBackendUtcMs(iso)
  if (Number.isNaN(start)) return 0
  return Math.max(0, nowMs - start) / 3600_000
}

/** Cronómetro en vivo: segundos si &lt; 1 min; min + seg; luego horas como fmtHours. */
export function fmtElapsedLive(h) {
  if (h < 0) h = 0
  const totalSec = Math.min(Math.floor(h * 3600 + 1e-6), 86400 * 365)
  if (totalSec < 60) return `${totalSec} s`
  if (h < 1) {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return s === 0 ? `${m} min` : `${m} min ${s} s`
  }
  return `${h.toFixed(1)} h`
}

/** "Hace" con granularidad por segundo durante el primer minuto. */
export function fmtAgoLive(iso, nowMs = Date.now()) {
  try {
    const start = atBackendUtcMs(iso)
    if (Number.isNaN(start)) return 'hace —'
    const diff = Math.max(0, nowMs - start)
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return sec <= 0 ? 'recién' : `hace ${sec} s`
    const totalMin = Math.floor(diff / 60_000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    if (h <= 0) return `hace ${m} min`
    return `hace ${h} h ${String(m).padStart(2, '0')} min`
  } catch {
    return 'hace —'
  }
}

export function fmtDateTime(iso) {
  try {
    const t = atBackendUtcMs(iso)
    if (Number.isNaN(t)) return String(iso)
    const d = new Date(t)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

export function fmtAgo(iso, nowMs = Date.now()) {
  try {
    const start = atBackendUtcMs(iso)
    if (Number.isNaN(start)) return 'hace —'
    const diff = Math.max(0, nowMs - start)
    const totalMin = Math.floor(diff / 60_000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    if (h <= 0 && m <= 0) return 'recién'
    if (h <= 0) return `hace ${m}min`
    return `hace ${h}h ${String(m).padStart(2, '0')}min`
  } catch {
    return 'hace —'
  }
}

/** Discord message text uses raw mention tokens; strip/replace for human-readable UI. */
export function stripDiscordMarkup(text) {
  if (text == null) return ''
  return String(text)
    .replace(/<@!?(\d+)>/g, '@usuario')
    .replace(/<@&(\d+)>/g, '@rol')
    .replace(/<#(\d+)>/g, '#canal')
}

/**
 * Normaliza menciones Discord; el placeholder @rol (mención a rol) se reemplaza por
 * el autor del ticket (`discord_autor`) seguido de " - " y el resto de la consulta.
 */
export function formatTicketPregunta(text, discordAutor) {
  let s = stripDiscordMarkup(text)
  const name = discordAutor != null && String(discordAutor).trim()
  if (name) {
    s = s.replace(/@rol\b/gi, `${name} - `)
  }
  return s
}
