import { useEffect, useState } from 'react'
import { listAreas, listStaff } from '../../api.js'

export default function DiscordSettings() {
  const [copied, setCopied] = useState(false)
  const [areas, setAreas] = useState([])
  const [staff, setStaff] = useState([])
  const [error, setError] = useState('')

  // no hay endpoint de webhook aún; dejamos placeholder
  const webhook = 'https://discord.com/api/webhooks/…'

  useEffect(() => {
    let alive = true
    Promise.all([listAreas(), listStaff()])
      .then(([a, s]) => {
        if (!alive) return
        setAreas(a || [])
        setStaff(s || [])
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar configuración.')
      })
    return () => {
      alive = false
    }
  }, [])

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhook)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <header className="dsc-page-head">
        <h2>Configuración</h2>
        <p>Usuarios/staff, áreas y webhook de Discord.</p>
      </header>

      <div className="dsc-settings-grid">
        <section className="dsc-panel">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Usuarios / staff</h3>
          <div className="dsc-table-wrap">
            <table className="dsc-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Área asignada</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id}>
                    <td className="dsc-up">{u.username}</td>
                    <td className="dsc-mono">{u.user_id}</td>
                    <td className="dsc-up">{u.area_nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: 'rgba(242,240,247,0.55)' }}>
            La edición de usuarios se conectará al backend más adelante.
          </p>
        </section>

        <section className="dsc-panel">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Áreas</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text)' }}>
            {areas.map((a) => (
              <li key={a.id} style={{ marginBottom: '0.35rem' }}>
                <span className="dsc-up">{a.nombre}</span>{' '}
                {a.color ? <span className="dsc-mono" style={{ color: 'var(--muted)' }}>{a.color}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="dsc-panel" style={{ marginTop: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Webhook URL de Discord</h3>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
          URL para integración (pendiente de endpoint de configuración).
        </p>
        <div className="dsc-webhook-box">
          <input className="dsc-input" readOnly value={webhook} aria-label="Webhook URL" />
          <button type="button" className="dsc-btn dsc-btn--secondary" onClick={copyWebhook}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </section>

      {error ? (
        <section className="dsc-panel" style={{ marginTop: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--muted)' }}>{error}</p>
        </section>
      ) : null}
    </>
  )
}
