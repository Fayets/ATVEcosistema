import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteOnboarding, getOnboardingPlantilla } from '../api.js'
import { ONBOARDING_FIELDS } from '../onboardingQuestions.js'

function slugifyFilename(name) {
  return String(name || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'cliente'
}

function formatSubmittedAt(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return null
  }
}

function formatSubmittedAtLong(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return null
  }
}

function saveCanvasAsPdf(canvas, fileBase) {
  return import('jspdf').then(({ default: jsPDF }) => {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    const usableH = pageHeight - margin * 2
    const imgW = pageWidth - margin * 2
    const imgH = (canvas.height * imgW) / canvas.width

    if (imgH <= usableH) {
      const imgData = canvas.toDataURL('image/png', 1.0)
      pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH)
      pdf.save(`${fileBase}.pdf`)
      return
    }

    const sliceCanvas = document.createElement('canvas')
    const ctx = sliceCanvas.getContext('2d')
    if (!ctx) {
      pdf.save(`${fileBase}.pdf`)
      return
    }

    const pw = canvas.width
    const slicePx = Math.max(1, Math.floor((usableH / imgH) * canvas.height))
    let y = 0
    let first = true

    while (y < canvas.height) {
      const h = Math.min(slicePx, canvas.height - y)
      sliceCanvas.width = pw
      sliceCanvas.height = h
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pw, h)
      ctx.drawImage(canvas, 0, y, pw, h, 0, 0, pw, h)
      const sliceData = sliceCanvas.toDataURL('image/png', 1.0)
      const sliceH_mm = (h * imgW) / pw
      if (!first) pdf.addPage()
      pdf.addImage(sliceData, 'PNG', margin, margin, imgW, sliceH_mm)
      first = false
      y += h
    }

    pdf.save(`${fileBase}.pdf`)
  })
}

function OnboardingToolbar({ search, onSearchChange, onPdf, pdfLoading, idPrefix }) {
  return (
    <div className={`clients-fathom-toolbar onboarding-fathom-toolbar ${idPrefix ? 'onboarding-toolbar--' + idPrefix : ''}`}>
      <input
        type="search"
        className="clients-search-input clients-fathom-toolbar__search"
        placeholder="Buscar en onboarding…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Buscar en onboarding"
        id={idPrefix ? `onboarding-search-${idPrefix}` : undefined}
      />
      <div className="clients-fathom-toolbar__crud" role="group" aria-label="Acciones onboarding">
        <button
          type="button"
          className="clients-crud-btn onboarding-fathom-toolbar__pdf"
          onClick={onPdf}
          disabled={pdfLoading}
        >
          {pdfLoading ? 'Generando PDF…' : 'Descargar PDF'}
        </button>
      </div>
    </div>
  )
}

export default function OnboardingViewer({
  respuestas,
  clienteNombre,
  submittedAt,
  clienteId,
  onDeleted,
  fields: fieldsProp,
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [layoutFields, setLayoutFields] = useState(null)
  const pdfRef = useRef(null)

  useEffect(() => {
    if (Array.isArray(fieldsProp) && fieldsProp.length > 0) {
      setLayoutFields(fieldsProp)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const d = await getOnboardingPlantilla()
        if (!cancelled) setLayoutFields(d.campos)
      } catch {
        if (!cancelled) setLayoutFields(ONBOARDING_FIELDS)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fieldsProp])

  const fields = layoutFields ?? ONBOARDING_FIELDS

  const dateLabel = formatSubmittedAt(submittedAt)
  const dateLabelLong = formatSubmittedAtLong(submittedAt)

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fields
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.question.toLowerCase().includes(q) ||
        String(respuestas[f.key] ?? '')
          .toLowerCase()
          .includes(q),
    )
  }, [search, respuestas, fields])

  useEffect(() => {
    if (!detailOpen) return
    function onKey(e) {
      if (e.key === 'Escape') setDetailOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailOpen])

  useEffect(() => {
    if (!detailOpen) setDeleteError('')
  }, [detailOpen])

  const handleDeleteEntregable = useCallback(async () => {
    if (!clienteId || deleteLoading) return
    if (
      !window.confirm(
        '¿Eliminar el entregable de onboarding de este cliente? Esta acción no se puede deshacer.',
      )
    ) {
      return
    }
    setDeleteError('')
    setDeleteLoading(true)
    try {
      await deleteOnboarding(clienteId)
      setDetailOpen(false)
      onDeleted?.()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    } finally {
      setDeleteLoading(false)
    }
  }, [clienteId, deleteLoading, onDeleted])

  const handlePdf = useCallback(async () => {
    if (!pdfRef.current || pdfLoading) return
    setPdfLoading(true)
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const html2canvas = (await import('html2canvas')).default
      const el = pdfRef.current
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      })
      const base = `onboarding-${slugifyFilename(clienteNombre)}`
      await saveCanvasAsPdf(canvas, base)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfLoading(false)
    }
  }, [pdfLoading, clienteNombre])

  const formBody =
    filteredFields.length === 0 ? (
      <p className="onboarding-fathom-empty onboarding-fathom-empty--in-modal">
        No hay coincidencias con la búsqueda.
      </p>
    ) : (
      filteredFields.map(({ key, label, question }) => {
        const raw = respuestas[key]
        const value = raw != null && String(raw).trim() !== '' ? String(respuestas[key]) : ''
        return (
          <section key={key} className="onboarding-full-block">
            <h4 className="onboarding-full-block__label">{label}</h4>
            <p className="onboarding-full-block__question">{question}</p>
            <div className="onboarding-full-block__answer">
              {value || <span className="onboarding-full-block__empty">— Sin respuesta</span>}
            </div>
          </section>
        )
      })
    )

  if (!respuestas || typeof respuestas !== 'object') return null

  return (
    <div className="onboarding-viewer-fathom">
      <div ref={pdfRef} className="onboarding-pdf-capture" aria-hidden>
        <header className="onboarding-pdf-capture__hero">
          <img src="/ATVLogin.png" alt="" className="onboarding-pdf-capture__logo" />
          <div>
            <h1 className="onboarding-pdf-capture__title">Onboarding ATV</h1>
            {clienteNombre ? <p className="onboarding-pdf-capture__client">{clienteNombre}</p> : null}
            {dateLabelLong ? <p className="onboarding-pdf-capture__date">{dateLabelLong}</p> : null}
          </div>
        </header>
        <div className="onboarding-pdf-capture__body">
          {fields.map(({ key, label, question }) => {
            const raw = respuestas[key]
            const value = raw != null && String(raw).trim() !== '' ? String(raw) : ''
            return (
              <section key={key} className="onboarding-pdf-capture__block">
                <h2 className="onboarding-pdf-capture__h2">{label}</h2>
                <p className="onboarding-pdf-capture__q">{question}</p>
                <div className="onboarding-pdf-capture__a">{value || '— Sin respuesta'}</div>
              </section>
            )
          })}
        </div>
      </div>

      {!detailOpen ? (
        <>
          <OnboardingToolbar
            search={search}
            onSearchChange={setSearch}
            onPdf={handlePdf}
            pdfLoading={pdfLoading}
            idPrefix="main"
          />
          <div className="onboarding-entregable-wrap">
            <div
              className="onboarding-fathom-card onboarding-fathom-card--deliverable"
              aria-labelledby="onboarding-entregable-title"
            >
              <div className="onboarding-fathom-card__top">
                <span className="onboarding-fathom-card__brand">ATV</span>
              </div>
              <div className="onboarding-fathom-card__bottom">
                <span id="onboarding-entregable-title" className="onboarding-fathom-card__title">
                  Onboarding
                </span>
                <span className="onboarding-fathom-card__meta">Entregable · Formulario completo</span>
                <span className="onboarding-fathom-card__time">{dateLabelLong || dateLabel || '—'}</span>
                <button type="button" className="onboarding-fathom-card__ver" onClick={() => setDetailOpen(true)}>
                  Ver
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {detailOpen ? (
        <div
          className="clients-modal-overlay"
          role="presentation"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="clients-modal clients-modal--read onboarding-full-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-full-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="onboarding-full-title">Onboarding ATV</h3>
            {clienteNombre ? (
              <p className="onboarding-full-modal__subtitle">{clienteNombre}</p>
            ) : null}
            {dateLabelLong ? (
              <p className="onboarding-full-modal__meta">{dateLabelLong}</p>
            ) : null}

            <OnboardingToolbar
              search={search}
              onSearchChange={setSearch}
              onPdf={handlePdf}
              pdfLoading={pdfLoading}
              idPrefix="modal"
            />

            <div className="clients-modal-body-scroll onboarding-full-modal__body">{formBody}</div>

            {deleteError ? (
              <p className="onboarding-delete-error" role="alert">
                {deleteError}
              </p>
            ) : null}

            <div className="clients-modal-actions clients-modal-actions--onboarding">
              <button
                type="button"
                className="clients-crud-btn clients-crud-btn--danger"
                onClick={handleDeleteEntregable}
                disabled={deleteLoading || !clienteId}
              >
                {deleteLoading ? 'Eliminando…' : 'Eliminar entregable'}
              </button>
              <button type="button" className="login-submit" onClick={() => setDetailOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
