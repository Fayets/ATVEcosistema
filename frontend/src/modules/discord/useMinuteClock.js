import { useEffect, useState } from 'react'

/** ms until the next local wall-clock minute */
function msUntilNextLocalMinute() {
  const now = new Date()
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds())
}

/**
 * Calls onTick on mount (optional) and on every local minute rollover.
 * @returns {() => void} unsubscribe
 */
export function subscribeEveryLocalMinute(onTick, { leading = true } = {}) {
  if (leading) onTick()
  let intervalId = null
  const timeoutId = window.setTimeout(() => {
    onTick()
    intervalId = window.setInterval(onTick, 60_000)
  }, msUntilNextLocalMinute())
  return () => {
    window.clearTimeout(timeoutId)
    if (intervalId != null) window.clearInterval(intervalId)
  }
}

/** Timestamp en ms; actualiza cada `intervalMs` (p. ej. 1000 para cronómetro). */
export function useNowMsEveryInterval(intervalMs) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNowMs(Date.now())
    const t0 = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, intervalMs)
    return () => {
      window.clearTimeout(t0)
      window.clearInterval(id)
    }
  }, [intervalMs])
  return nowMs
}

/**
 * Igual que useNowMsEveryInterval pero solo corre cuando `active` (ahorra renders si el panel está cerrado).
 */
export function useNowMsWhile(active, intervalMs = 1000) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const tick = () => setNowMs(Date.now())
    const t0 = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, intervalMs)
    return () => {
      window.clearTimeout(t0)
      window.clearInterval(id)
    }
  }, [active, intervalMs])
  return nowMs
}

/** Timestamp en ms; una vez por minuto local (métricas agregadas). */
export function useNowMsEveryLocalMinute() {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => subscribeEveryLocalMinute(() => setNowMs(Date.now())), [])
  return nowMs
}
