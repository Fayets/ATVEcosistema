import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_ONBOARDING_FIELDS, emptyRespuestasFromFields } from '../onboardingQuestions.js'
import { getOnboardingPlantilla, submitOnboarding, validateOnboardingCliente } from '../api.js'

/** Textarea que crece en altura según el contenido (sustituye input de una línea y textarea fijo). */
function OnboardingGrowField({
  value,
  onChange,
  disabled,
  className,
  'aria-invalid': ariaInvalid,
  minHeightPx,
}) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(minHeightPx, el.scrollHeight)}px`
  }, [value, minHeightPx])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      aria-invalid={ariaInvalid}
    />
  )
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [clienteIdInput, setClienteIdInput] = useState('')
  const [validated, setValidated] = useState(null)
  const [plantillaFields, setPlantillaFields] = useState(DEFAULT_ONBOARDING_FIELDS)
  const [respuestas, setRespuestas] = useState(() => emptyRespuestasFromFields(DEFAULT_ONBOARDING_FIELDS))
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getOnboardingPlantilla()
      .then((d) => setPlantillaFields(d.campos))
      .catch(() => {})
  }, [])

  const clienteIdTrimmed = useMemo(() => clienteIdInput.trim(), [clienteIdInput])

  async function handleVerificar(e) {
    e.preventDefault()
    setError('')
    if (!clienteIdTrimmed) {
      setError('Ingresá el número de cliente o el ID que te enviaron.')
      return
    }
    setLoading(true)
    try {
      const data = await validateOnboardingCliente(clienteIdTrimmed)
      let campos = plantillaFields
      try {
        const p = await getOnboardingPlantilla()
        campos = p.campos
        setPlantillaFields(p.campos)
      } catch {
        campos = DEFAULT_ONBOARDING_FIELDS
      }
      setValidated(data)
      setRespuestas(emptyRespuestasFromFields(campos))
      setFieldErrors({})
      setStep(2)
    } catch {
      setError('Cliente no encontrado. Verificá el número o el ID que te enviaron.')
    } finally {
      setLoading(false)
    }
  }

  function setField(key, value) {
    setRespuestas((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function validateForm() {
    const next = {}
    for (const f of plantillaFields) {
      if (f.optional) continue
      if (!String(respuestas[f.key] ?? '').trim()) {
        next[f.key] = true
      }
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validateForm()) {
      setError('Completá todos los campos obligatorios (marcados con *).')
      return
    }
    if (!validated?.cliente_id) return
    setLoading(true)
    try {
      await submitOnboarding({ cliente_id: validated.cliente_id, respuestas })
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el formulario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboarding-page">
      <main className="onboarding-main">
        <div className="onboarding-card">
          <header className="onboarding-header">
            <img src="/ATVLogin.png" alt="" className="onboarding-brand" decoding="async" />
            <h1 className="onboarding-title">FORMULARIO DE ONBOARDING ATV</h1>
          </header>

          {step === 1 ? (
            <>
              <p className="onboarding-lead">
                Necesitamos validar tu identidad con el <strong>número de cliente (ID)</strong> que te
                envió el equipo. Si te pasaron el UUID completo, también podés usarlo. Después vas a
                poder completar el cuestionario con el mayor nivel de detalle posible.
              </p>
              <form className="onboarding-form" onSubmit={handleVerificar}>
                {error ? (
                  <p className="onboarding-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <label className="onboarding-field">
                  <span>
                    Número de cliente o ID <span className="onboarding-req">*</span>
                  </span>
                  <input
                    type="text"
                    className="onboarding-input"
                    value={clienteIdInput}
                    onChange={(e) => setClienteIdInput(e.target.value)}
                    placeholder="ej. 1024"
                    disabled={loading}
                    autoComplete="off"
                  />
                </label>
                <button type="submit" className="login-submit" disabled={loading}>
                  {loading ? 'Verificando…' : 'Verificar y continuar'}
                </button>
              </form>
            </>
          ) : null}

          {step === 2 && validated ? (
            <form className="onboarding-form onboarding-form--long" onSubmit={handleSubmit}>
              <div className="onboarding-intro">
                <p>
                  Necesitamos que completes este formulario con el <strong>mayor nivel de detalle</strong>{' '}
                  posible. No es un trámite más: es literalmente la base para definir tu roadmap. Si esto
                  está mal hecho, todo lo que armemos arriba se va a desmoronar.
                </p>
                <p>
                  Si hay algo que no sabés cómo completar, no te lo guardes: preguntanos por chat o fijate
                  en el ejemplo de cada pregunta. Pero no te quedes trabado.
                </p>
                <p>
                  Si hay alguna <strong>métrica o proceso</strong> que te pedimos y no lo tenés, tranquilo:
                  es normal. Dejá ese campo vacío y seguimos desde ahí. Esto no es para ver cuánto sabés,
                  es para saber desde dónde empezamos.
                </p>
                <p className="onboarding-intro__signoff">
                  Desde ya muchas gracias,
                  <br />
                  Team ATV
                </p>
                <p className="onboarding-intro__legend">
                  <span className="onboarding-req">*</span> Indica que la pregunta es obligatoria. Sin
                  asterisco, podés dejarlo vacío si no tenés el dato.
                </p>
              </div>

              <p className="onboarding-ok" role="status">
                ✓ Hola, <strong>{validated.nombre}</strong>
                {validated.apellido ? ` ${validated.apellido}` : ''}. Completá las respuestas abajo.
              </p>
              {error ? (
                <p className="onboarding-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="onboarding-fields">
                {plantillaFields.map(({ key, question, example, long, optional }) => (
                  <label key={key} className="onboarding-field">
                    <span className="onboarding-field__q">
                      {question}{' '}
                      {optional ? (
                        <span className="onboarding-opt">(opcional si no tenés el dato)</span>
                      ) : (
                        <span className="onboarding-req">*</span>
                      )}
                    </span>
                    <span className="onboarding-field__example">{example}</span>
                    <OnboardingGrowField
                      minHeightPx={long ? 100 : 44}
                      className={`onboarding-textarea onboarding-textarea--autogrow${long ? ' onboarding-textarea--grow-long' : ' onboarding-textarea--grow-short'}${fieldErrors[key] ? ' onboarding-input--error' : ''}`}
                      value={respuestas[key] ?? ''}
                      onChange={(e) => setField(key, e.target.value)}
                      disabled={loading}
                      aria-invalid={fieldErrors[key] ? 'true' : undefined}
                    />
                  </label>
                ))}
              </div>
              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar formulario'}
              </button>
            </form>
          ) : null}

          {step === 3 ? (
            <div className="onboarding-success">
              <p className="onboarding-success__text">
                ¡Formulario enviado correctamente! El equipo ATV revisará tu información.
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
