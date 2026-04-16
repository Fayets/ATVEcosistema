import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ENTREGABLE_SLUG_ONBOARDING,
  getEntregablePlantilla,
  listEntregablePlantillas,
  patchEntregablePlantillaMeta,
  postEntregablePlantilla,
  putEntregablePlantilla,
} from '../../api.js'
import { DEFAULT_ONBOARDING_FIELDS } from '../../onboardingQuestions.js'

function cloneCampos(list) {
  return list.map((c) => ({ ...c }))
}

function newEmptyField() {
  return {
    key: 'campo',
    label: 'Nuevo campo',
    question: 'Redactá la pregunta que verá el cliente.',
    example: 'Ejemplo de respuesta esperada.',
    long: true,
    optional: false,
  }
}

const FOLDER_VARIANTS = [
  'clients-knowledge-folder--entregables',
  'clients-knowledge-folder--fathom',
  'clients-knowledge-folder--discord',
]

const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/
const CAMPO_KEY_RE = /^[a-z][a-z0-9_]*$/

/** snake_case válido para API (misma regla que el backend). */
function slugifyLabelToKey(rawLabel) {
  let s = String(rawLabel ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!s) s = 'campo'
  if (!/^[a-z]/.test(s)) s = `k_${s}`.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')
  s = s.slice(0, 80).replace(/_+$/g, '')
  if (!s || !CAMPO_KEY_RE.test(s)) s = 'campo'
  return s.slice(0, 80)
}

function allocateUniqueKey(base, forbidden) {
  let candidate = base.slice(0, 80)
  let n = 2
  while (forbidden.has(candidate)) {
    const suffix = `_${n}`
    const room = 80 - suffix.length
    candidate = (base.slice(0, Math.max(1, room)) + suffix).replace(/_+$/g, '')
    n += 1
  }
  return candidate
}

/**
 * Entregables dentro de ATV Clients: hub con buscador, alta y cartas; editor por slug.
 */
export default function EntregablesPlantillaEditor() {
  const [mode, setMode] = useState('hub')
  const [editingSlug, setEditingSlug] = useState('')

  const [plantillas, setPlantillas] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createSlug, setCreateSlug] = useState('')
  const [createNombre, setCreateNombre] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  const [metaOpen, setMetaOpen] = useState(false)
  const [metaSlug, setMetaSlug] = useState('')
  const [metaNombre, setMetaNombre] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaError, setMetaError] = useState('')

  const [campos, setCampos] = useState([])
  const [plantillaMeta, setPlantillaMeta] = useState({ slug: '', nombre: null })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const fetchList = useCallback(async () => {
    setListError('')
    setListLoading(true)
    try {
      const rows = await listEntregablePlantillas()
      setPlantillas(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setPlantillas([])
      setListError(e instanceof Error ? e.message : 'No se pudo cargar el listado.')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'hub') return
    fetchList()
  }, [mode, fetchList])

  useEffect(() => {
    if (mode !== 'editor' || !editingSlug) return
    let cancelled = false
    setError('')
    setLoading(true)
    ;(async () => {
      try {
        const data = await getEntregablePlantilla(editingSlug)
        if (cancelled) return
        setCampos(cloneCampos(data.campos))
        setPlantillaMeta({ slug: data.slug ?? editingSlug, nombre: data.nombre ?? null })
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar la plantilla.')
          if (editingSlug === ENTREGABLE_SLUG_ONBOARDING) {
            setCampos(cloneCampos(DEFAULT_ONBOARDING_FIELDS))
          } else {
            setCampos([])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, editingSlug])

  const filteredPlantillas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return plantillas
    return plantillas.filter((p) => {
      const slug = String(p.slug ?? '').toLowerCase()
      const nombre = String(p.nombre ?? '').toLowerCase()
      return slug.includes(q) || nombre.includes(q)
    })
  }, [plantillas, search])

  function openEditor(slug) {
    setEditingSlug(slug)
    setMode('editor')
    setSavedMsg('')
    setError('')
  }

  function openMetaModal(item) {
    setMetaSlug(item.slug)
    setMetaNombre(item.nombre ?? '')
    setMetaError('')
    setMetaOpen(true)
  }

  async function submitMeta() {
    setMetaError('')
    setMetaSaving(true)
    try {
      await patchEntregablePlantillaMeta(metaSlug, { nombre: metaNombre.trim() || null })
      setMetaOpen(false)
      await fetchList()
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setMetaSaving(false)
    }
  }

  async function submitCreate() {
    setCreateError('')
    const slug = createSlug.trim().toLowerCase()
    if (!slug || !SLUG_PATTERN.test(slug)) {
      setCreateError('Slug inválido: solo minúsculas, números y guión bajo; debe empezar con letra.')
      return
    }
    if (slug === ENTREGABLE_SLUG_ONBOARDING) {
      setCreateError('«onboarding» está reservado para el formulario público.')
      return
    }
    setCreateSaving(true)
    try {
      await postEntregablePlantilla({
        slug,
        nombre: createNombre.trim() || null,
      })
      setCreateOpen(false)
      setCreateSlug('')
      setCreateNombre('')
      await fetchList()
      openEditor(slug)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'No se pudo crear.')
    } finally {
      setCreateSaving(false)
    }
  }

  function updateField(index, patch) {
    setCampos((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  function updateFieldLabel(index, rawLabel) {
    const label = String(rawLabel ?? '')
    setCampos((prev) => {
      const forbidden = new Set(
        prev
          .map((c, j) => (j === index ? null : String(c.key ?? '').trim()))
          .filter((k) => k && CAMPO_KEY_RE.test(k)),
      )
      const base = slugifyLabelToKey(label)
      const key = allocateUniqueKey(base, forbidden)
      const next = [...prev]
      next[index] = { ...next[index], label, key }
      return next
    })
  }

  function appendEmptyField() {
    setCampos((prev) => {
      const forbidden = new Set(
        prev.map((c) => String(c.key ?? '').trim()).filter((k) => k && CAMPO_KEY_RE.test(k)),
      )
      const base = slugifyLabelToKey('Nuevo campo')
      const key = allocateUniqueKey(base, forbidden)
      return [...prev, { ...newEmptyField(), key }]
    })
  }

  function moveField(index, delta) {
    const j = index + delta
    if (j < 0 || j >= campos.length) return
    setCampos((prev) => {
      const next = [...prev]
      const t = next[index]
      next[index] = next[j]
      next[j] = t
      return next
    })
  }

  function removeField(index) {
    if (!window.confirm('¿Eliminar esta pregunta de la plantilla?')) return
    setCampos((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!editingSlug) return
    setError('')
    setSavedMsg('')
    setSaving(true)
    try {
      const keysSeen = new Set()
      const payload = {
        campos: campos.map((c) => {
          const label = String(c.label ?? '').trim()
          let key = String(c.key ?? '').trim()
          if (!CAMPO_KEY_RE.test(key)) {
            key = allocateUniqueKey(slugifyLabelToKey(label), keysSeen)
          } else if (keysSeen.has(key)) {
            key = allocateUniqueKey(slugifyLabelToKey(label), keysSeen)
          }
          keysSeen.add(key)
          return {
            key,
            label,
            question: String(c.question ?? '').trim(),
            example: String(c.example ?? '').trim(),
            long: Boolean(c.long),
            optional: Boolean(c.optional),
          }
        }),
      }
      const data = await putEntregablePlantilla(editingSlug, payload)
      setCampos(cloneCampos(data.campos))
      setPlantillaMeta({ slug: data.slug ?? editingSlug, nombre: data.nombre ?? null })
      setSavedMsg('Cambios guardados.')
      await fetchList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  function handleRestoreDefault() {
    if (editingSlug !== ENTREGABLE_SLUG_ONBOARDING) return
    if (
      !window.confirm(
        '¿Restaurar la plantilla por defecto del repositorio? Se perderán los cambios no guardados en pantalla.',
      )
    ) {
      return
    }
    setCampos(cloneCampos(DEFAULT_ONBOARDING_FIELDS))
    setSavedMsg('')
    setError('')
  }

  if (mode === 'hub') {
    return (
      <>
        <header className="clients-content__header">
          <h2>Entregables</h2>
        </header>

        <div className="clients-entregables-hub-toolbar">
          <input
            type="search"
            className="clients-search-input clients-entregables-hub-toolbar__search"
            placeholder="Buscar por nombre o slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar entregables"
          />
          <button type="button" className="clients-crud-btn clients-entregables-hub-toolbar__new" onClick={() => {
            setCreateError('')
            setCreateSlug('')
            setCreateNombre('')
            setCreateOpen(true)
          }}>
            + Nuevo entregable
          </button>
        </div>

        {listError ? (
          <p className="login-error" role="alert">
            {listError}
          </p>
        ) : null}

        {listLoading ? <p className="module-lead">Cargando entregables…</p> : null}

        {!listLoading && !listError ? (
          <section className="clients-panel clients-panel--knowledge-overview">
            {filteredPlantillas.length === 0 ? (
              <p className="module-lead">No hay coincidencias. Probá otro término o creá un entregable nuevo.</p>
            ) : (
              <div className="clients-knowledge-folders-grid" role="navigation" aria-label="Plantillas de entregables">
                {filteredPlantillas.map((item, index) => {
                  const variant = FOLDER_VARIANTS[index % FOLDER_VARIANTS.length]
                  const title = item.nombre || item.slug
                  const hint = item.nombre ? `Slug: ${item.slug}` : 'Plantilla de formulario'
                  return (
                    <article key={item.slug} className="clients-entregables-card-wrap">
                      <button
                        type="button"
                        className={`clients-knowledge-folder ${variant}`}
                        onClick={() => openEditor(item.slug)}
                      >
                        <div className="clients-knowledge-folder__preview" aria-hidden="true" />
                        <span className="clients-knowledge-folder__label">{title}</span>
                        <span className="clients-knowledge-folder__hint">{hint}</span>
                      </button>
                      <button
                        type="button"
                        className="clients-entregables-card-meta"
                        onClick={() => openMetaModal(item)}
                        aria-label={`Editar nombre de ${item.slug}`}
                      >
                        ✎
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        ) : null}

        {createOpen ? (
          <div
            className="clients-modal-overlay"
            role="presentation"
            onClick={() => !createSaving && setCreateOpen(false)}
          >
            <div
              className="clients-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="entregables-create-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="entregables-create-title">Nuevo entregable</h3>
              <p className="module-lead" style={{ marginTop: '0.35rem' }}>
                Slug único (snake_case). No podés usar «onboarding». Se crea con un campo de ejemplo editable.
              </p>
              <label className="entregables-label" style={{ marginTop: '0.75rem' }}>
                <span>Slug</span>
                <input
                  className="onboarding-input"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  placeholder="ej. checklist_semanal"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={createSaving}
                />
              </label>
              <label className="entregables-label">
                <span>Nombre visible (opcional)</span>
                <input
                  className="onboarding-input"
                  value={createNombre}
                  onChange={(e) => setCreateNombre(e.target.value)}
                  placeholder="Ej. Checklist semanal"
                  disabled={createSaving}
                />
              </label>
              {createError ? (
                <p className="login-error" role="alert">
                  {createError}
                </p>
              ) : null}
              <div className="clients-modal-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="clients-secondary" onClick={() => !createSaving && setCreateOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className="login-submit" onClick={submitCreate} disabled={createSaving}>
                  {createSaving ? 'Creando…' : 'Crear y editar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {metaOpen ? (
          <div
            className="clients-modal-overlay"
            role="presentation"
            onClick={() => !metaSaving && setMetaOpen(false)}
          >
            <div
              className="clients-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="entregables-meta-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="entregables-meta-title">Editar nombre</h3>
              <p className="module-lead" style={{ marginTop: '0.35rem' }}>
                Slug: <strong>{metaSlug}</strong>
              </p>
              <label className="entregables-label" style={{ marginTop: '0.75rem' }}>
                <span>Nombre visible</span>
                <input
                  className="onboarding-input"
                  value={metaNombre}
                  onChange={(e) => setMetaNombre(e.target.value)}
                  placeholder="Nombre en las cartas"
                  disabled={metaSaving}
                />
              </label>
              {metaError ? (
                <p className="login-error" role="alert">
                  {metaError}
                </p>
              ) : null}
              <div className="clients-modal-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="clients-secondary" onClick={() => !metaSaving && setMetaOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className="login-submit" onClick={submitMeta} disabled={metaSaving}>
                  {metaSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  const editorTitle = plantillaMeta.nombre || plantillaMeta.slug || editingSlug

  return (
    <div className="entregables-editor-layout">
      <header className="clients-content__header clients-knowledge-head">
        <div className="clients-knowledge-head__top">
          <button
            type="button"
            className="clients-secondary clients-knowledge-back"
            onClick={() => {
              setMode('hub')
              setEditingSlug('')
              setSavedMsg('')
              setError('')
              fetchList()
            }}
          >
            ← Volver
          </button>
          <h2 className="clients-knowledge-head__title">{editorTitle}</h2>
        </div>
      </header>

      <div className="entregables-page entregables-page--editor">
        <section className="entregables-section" aria-label="Editor de plantilla">
          {loading ? <p className="module-lead">Cargando plantilla…</p> : null}

          {!loading && error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && campos.length > 0 ? (
            <>
              {savedMsg ? (
                <p className="onboarding-ok" role="status">
                  {savedMsg}
                </p>
              ) : null}

              <div className="entregables-toolbar">
                <button type="button" className="clients-secondary" onClick={appendEmptyField}>
                  + Agregar pregunta
                </button>
                {editingSlug === ENTREGABLE_SLUG_ONBOARDING ? (
                  <button type="button" className="clients-secondary" onClick={handleRestoreDefault}>
                    Restaurar por defecto
                  </button>
                ) : null}
                <button type="button" className="login-submit" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar en servidor'}
                </button>
              </div>

              <ol className="entregables-field-list">
                {campos.map((field, index) => (
                  <li key={index} className="entregables-field-card">
                    <div className="entregables-field-card__toolbar">
                      <span className="entregables-field-card__index">{index + 1}</span>
                      <button
                        type="button"
                        className="clients-secondary entregables-field-card__move"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                        aria-label="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="clients-secondary entregables-field-card__move"
                        onClick={() => moveField(index, 1)}
                        disabled={index === campos.length - 1}
                        aria-label="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="clients-crud-btn clients-crud-btn--danger entregables-field-card__remove"
                        onClick={() => removeField(index)}
                      >
                        Eliminar
                      </button>
                    </div>
                    <label className="entregables-label">
                      <span>Etiqueta corta</span>
                      <input
                        type="text"
                        className="onboarding-input"
                        value={field.label}
                        onChange={(e) => updateFieldLabel(index, e.target.value)}
                      />
                    </label>
                    <label className="entregables-label">
                      <span>Pregunta</span>
                      <textarea
                        className="onboarding-textarea onboarding-textarea--grow-long"
                        rows={3}
                        value={field.question}
                        onChange={(e) => updateField(index, { question: e.target.value })}
                      />
                    </label>
                    <label className="entregables-label">
                      <span>Texto de ejemplo</span>
                      <textarea
                        className="onboarding-textarea onboarding-textarea--grow-long"
                        rows={2}
                        value={field.example}
                        onChange={(e) => updateField(index, { example: e.target.value })}
                      />
                    </label>
                    <div className="entregables-checks">
                      <label className="entregables-check">
                        <input
                          type="checkbox"
                          checked={Boolean(field.long)}
                          onChange={(e) => updateField(index, { long: e.target.checked })}
                        />
                        Textarea alta (mucho texto)
                      </label>
                      <label className="entregables-check">
                        <input
                          type="checkbox"
                          checked={Boolean(field.optional)}
                          onChange={(e) => updateField(index, { optional: e.target.checked })}
                        />
                        Opcional (puede enviarse vacío)
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
