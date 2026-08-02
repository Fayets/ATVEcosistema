import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, loginRequest } from '../api.js'

function LoginSpinner() {
  return <span className="login-spinner" aria-hidden="true" />
}

function IconEye({ hidden }) {
  if (hidden) {
    return (
      <svg className="login-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15c.17-.52.26-1.07.26-1.62 0-2.76-2.24-5-5-5-.55 0-1.1.09-1.62.26z"
        />
      </svg>
    )
  }

  return (
    <svg className="login-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
      />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const usernameRef = useRef(null)
  const passwordRef = useRef(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSession()
      .then(() => {
        if (!cancelled) navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (!checkingSession) {
      usernameRef.current?.focus()
    }
  }, [checkingSession])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginRequest(username.trim(), password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  function handleUsernameKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      passwordRef.current?.focus()
    }
  }

  return (
    <div className="login-page">
      <main className="login-main">
        <div className={`login-panel${checkingSession ? ' login-panel--loading' : ''}`}>
          <div className="login-hero">
            {checkingSession ? (
              <>
                <h1 className="login-hero__title">
                  Verificando
                  <strong>sesión</strong>
                </h1>
                <p className="login-hero__lead">
                  Un momento mientras comprobamos tu acceso.
                </p>
              </>
            ) : (
              <img
                src="/AumentaTuValorLogo.png"
                alt="Aumenta Tu Valor"
                className="login-hero__logo"
                width={176}
                height={56}
              />
            )}
          </div>

          {checkingSession ? (
            <div className="login-panel__status">
              <LoginSpinner />
            </div>
          ) : (
            <form
              className={`login-form${error ? ' login-form--error' : ''}`}
              onSubmit={handleSubmit}
            >
              {error ? (
                <p className="login-error" role="alert">
                  {error}
                </p>
              ) : null}

              <label className="login-field">
                <span className="login-field__label">Usuario</span>
                <span className="login-input">
                  <input
                    ref={usernameRef}
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleUsernameKeyDown}
                    disabled={loading}
                  />
                </span>
              </label>

              <label className="login-field">
                <span className="login-field__label">Contraseña</span>
                <span className="login-input">
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    disabled={loading}
                  >
                    <IconEye hidden={showPassword} />
                  </button>
                </span>
              </label>

              <button type="submit" className="login-submit btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <LoginSpinner />
                    Ingresando…
                  </>
                ) : (
                  'Ingresar'
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
