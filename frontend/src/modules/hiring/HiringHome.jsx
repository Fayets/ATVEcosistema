import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteHiringApplication,
  getHiringMetrics,
  listHiringApplications,
  updateHiringApplication,
} from '../../api.js'
import './hiring.css'

const STATUSES = ['nueva', 'revisando', 'entrevista', 'contratado', 'descartado']

/* Las preguntas viven en hiring-main/frontend/src/config/config.ts; acá solo
   se traducen las claves del JSON `answers` a un texto legible. */
const QUESTION_LABELS = {
  instagram: 'Usuario de Instagram',
  video_presentacion: 'Video de presentación',
  experiencia_laboral: 'Experiencia laboral',
  disponibilidad_full: '¿5-6 días por semana, 8 hs diarias?',
  otros_proyectos: 'Otros proyectos o emprendimientos',
  inicio: '¿Cuándo puede empezar?',
  experiencia_setting: 'Experiencia como setter',
  experiencia_closing: 'Experiencia cerrando high ticket',
  ticket_promedio: 'Ticket promedio cerrado',
  mejor_mes_cerrado: 'Facturación cerrada en su mejor mes (USD)',
  mejor_mes_reuniones: 'Reuniones agendadas en su mejor mes',
  tasa_cierre: 'Tasa de cierre',
  ingles: 'Nivel de inglés',
  video: 'Grabación / video de presentación',
  disponibilidad: 'Disponibilidad',
  canales: 'Canales que domina',
  perfil: 'Instagram o LinkedIn',
  anios_liderando: 'Años liderando equipos',
  equipo_mas_grande: 'Equipo más grande que lideró',
  facturacion_equipo: 'Facturación mensual del equipo (USD)',
  pipeline: 'Cómo estructura un pipeline',
  linkedin: 'LinkedIn',
  experiencia_marketing: 'Años en marketing digital',
  presupuesto_pauta: 'Mayor presupuesto mensual de pauta (USD)',
  caso_exito: 'Caso de éxito con números',
  portfolio: 'Portfolio',
  experiencia_edicion: 'Años editando video',
  software: 'Software',
  referencias: 'Referencias / estilos que lo inspiran',
  experiencia_diseno: 'Años en diseño',
  herramientas: 'Herramientas',
  thumbnails: 'Experiencia en thumbnails / piezas para ads',
  experiencia_dev: 'Años programando',
  stack: 'Stack principal',
  github: 'GitHub / portfolio',
  proyecto: 'Proyecto del que está orgulloso',
  ia: 'Uso de IA para programar',
  por_que_atv: '¿Por qué ATV?',
  como_nos_conociste: 'Cómo llegó a ATV',
}

const QUESTION_ORDER = Object.keys(QUESTION_LABELS)

function labelFor(key) {
  if (QUESTION_LABELS[key]) return QUESTION_LABELS[key]
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function isUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v)
}

function Value({ value }) {
  if (isUrl(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer">
        {value}
      </a>
    )
  }
  return value === '' || value == null ? '—' : String(value)
}

function StatusBadge({ status }) {
  return <span className={`hr-badge hr-badge--${status}`}>{status}</span>
}

function ApplicationDrawer({ app, onClose, onSaved, onDeleted }) {
  const [status, setStatus] = useState(app.status)
  const [notes, setNotes] = useState(app.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setStatus(app.status)
    setNotes(app.notes ?? '')
    setToast('')
    setError('')
  }, [app])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dirty = status !== app.status || notes !== (app.notes ?? '')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const updated = await updateHiringApplication(app.id, { status, notes })
      onSaved(updated)
      setToast('Guardado.')
      window.setTimeout(() => setToast(''), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar la postulación de ${app.name}? No se puede deshacer.`)) return
    try {
      await deleteHiringApplication(app.id)
      onDeleted(app.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    }
  }

  // jsonb no conserva el orden de inserción: se ordena según QUESTION_LABELS (orden del formulario)
  const answers = Object.entries(app.answers || {}).sort(([a], [b]) => {
    const ia = QUESTION_ORDER.indexOf(a)
    const ib = QUESTION_ORDER.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  const wa = app.phone ? `https://wa.me/${app.phone.replace(/\D/g, '')}` : null

  return (
    <div className="hr-drawer-overlay" onClick={onClose} role="presentation">
      <aside
        className="hr-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Postulación de ${app.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hr-drawer__head">
          <div>
            <p className="hr-drawer__kicker">{app.role_label}</p>
            <h2 className="hr-drawer__title">{app.name}</h2>
          </div>
          <button type="button" className="hr-drawer__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="hr-drawer__section">
          <h4 className="hr-drawer__h4">Contacto</h4>
          <div className="hr-meta">
            <div className="hr-meta__item">
              <span className="hr-meta__k">Email</span>
              <span className="hr-meta__v">
                <a href={`mailto:${app.email}`}>{app.email}</a>
              </span>
            </div>
            <div className="hr-meta__item">
              <span className="hr-meta__k">WhatsApp</span>
              <span className="hr-meta__v">
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    {app.phone}
                  </a>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="hr-meta__item">
              <span className="hr-meta__k">País</span>
              <span className="hr-meta__v">{app.country || '—'}</span>
            </div>
            <div className="hr-meta__item">
              <span className="hr-meta__k">Recibida</span>
              <span className="hr-meta__v">{fmtDate(app.created_at)}</span>
            </div>
            <div className="hr-meta__item">
              <span className="hr-meta__k">Origen</span>
              <span className="hr-meta__v">
                {app.source || '—'}
                {app.campaign ? ` · ${app.campaign}` : ''}
              </span>
            </div>
            <div className="hr-meta__item">
              <span className="hr-meta__k">Estado</span>
              <span className="hr-meta__v">
                <StatusBadge status={app.status} />
              </span>
            </div>
          </div>
        </div>

        <div className="hr-drawer__section">
          <h4 className="hr-drawer__h4">Respuestas</h4>
          {answers.length === 0 ? (
            <p className="hr-empty">Sin respuestas adicionales.</p>
          ) : (
            <div className="hr-answers">
              {answers.map(([k, v]) => (
                <div key={k}>
                  <p className="hr-answer__q">{labelFor(k)}</p>
                  <p className="hr-answer__a">
                    <Value value={v} />
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hr-drawer__section">
          <h4 className="hr-drawer__h4">Gestión</h4>
          <div className="hr-manage">
            <label className="hr-field">
              <span>Estado</span>
              <select className="hr-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="hr-field">
              <span>Notas internas</span>
              <textarea
                className="hr-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Qué te pareció, próximos pasos, fecha de entrevista…"
              />
            </label>
            {app.reviewed_by && (
              <p className="hr-reviewed">
                Última gestión: {app.reviewed_by} · {fmtDate(app.updated_at)}
              </p>
            )}
            {error && <p className="hr-error">{error}</p>}
            <div className="hr-manage__actions">
              <button type="button" className="btn-primary hr-btn" onClick={save} disabled={saving || !dirty}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              {toast && <p className="hr-toast">{toast}</p>}
              <button type="button" className="hr-btn--danger" onClick={remove}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default function HiringHome() {
  const [apps, setApps] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  async function refresh() {
    const [list, m] = await Promise.all([listHiringApplications(), getHiringMetrics()])
    setApps(list || [])
    setMetrics(m || null)
  }

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'No se pudieron cargar las postulaciones.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const roles = useMemo(() => {
    const map = new Map()
    apps.forEach((a) => map.set(a.role_slug, a.role_label))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [apps])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter((a) => {
      if (role && a.role_slug !== role) return false
      if (status && a.status !== status) return false
      if (q && !`${a.name} ${a.email} ${a.country ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [apps, role, status, search])

  const selected = apps.find((a) => a.id === selectedId) || null

  function onSaved(updated) {
    setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    getHiringMetrics().then(setMetrics).catch(() => {})
  }

  function onDeleted(id) {
    setApps((prev) => prev.filter((a) => a.id !== id))
    setSelectedId(null)
    getHiringMetrics().then(setMetrics).catch(() => {})
  }

  const byStatus = metrics?.by_status ?? {}

  return (
    <div className="atv-shell">
      <main className="hr-main">
        <header className="hr-head">
          <Link to="/dashboard" className="module-back">
            ← Volver al panel
          </Link>
          <div className="hr-head__row">
            <div>
              <h1 className="hr-title">ATV Hiring</h1>
              <p className="hr-lead">Postulaciones recibidas desde la bolsa de trabajo. Click en una fila para ver el detalle.</p>
            </div>
            <a className="hr-link-out" href="https://hiring.atvos.io" target="_blank" rel="noopener noreferrer">
              Abrir la bolsa de trabajo ↗
            </a>
          </div>
        </header>

        <section className="hr-kpis" aria-label="Resumen">
          <div className="hr-kpi hr-kpi--accent">
            <span>Nuevas</span>
            <strong>{byStatus.nueva ?? 0}</strong>
          </div>
          <div className="hr-kpi">
            <span>Últimos 7 días</span>
            <strong>{metrics?.last_7d ?? 0}</strong>
          </div>
          <div className="hr-kpi">
            <span>En entrevista</span>
            <strong>{byStatus.entrevista ?? 0}</strong>
          </div>
          <div className="hr-kpi">
            <span>Contratados</span>
            <strong>{byStatus.contratado ?? 0}</strong>
          </div>
          <div className="hr-kpi">
            <span>Total</span>
            <strong>{metrics?.total ?? 0}</strong>
          </div>
        </section>

        <section className="hr-panel">
          <div className="hr-toolbar">
            <label className="hr-field">
              <span>Rol</span>
              <select className="hr-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Todos</option>
                {roles.map(([slug, label]) => (
                  <option key={slug} value={slug}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="hr-field">
              <span>Estado</span>
              <select className="hr-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="hr-field">
              <span>Buscar</span>
              <input
                className="hr-input"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, email o país"
              />
            </label>
            <p className="hr-count">{loading ? 'Cargando…' : `${rows.length} de ${apps.length}`}</p>
          </div>

          {error && <p className="hr-error">{error}</p>}

          <div className="hr-table-wrap">
            <table className="hr-table" aria-label="Postulaciones">
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Rol</th>
                  <th>País</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Recibida</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <p className="hr-empty">
                        {apps.length === 0 ? 'Todavía no hay postulaciones.' : 'Nada coincide con esos filtros.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((a) => (
                    <tr
                      key={a.id}
                      className={a.id === selectedId ? 'is-active' : ''}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <td>
                        <span className="hr-name">{a.name}</span>
                        <span className="hr-sub">{a.email}</span>
                      </td>
                      <td>{a.role_label}</td>
                      <td className="hr-td-muted">{a.country || '—'}</td>
                      <td className="hr-td-muted">{a.source || '—'}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="hr-td-muted">{fmtDate(a.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selected && (
        <ApplicationDrawer
          app={selected}
          onClose={() => setSelectedId(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}
