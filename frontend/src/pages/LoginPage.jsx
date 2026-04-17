import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRequest } from '../api.js'
import { GIT_COMMIT_SHORT } from '../buildInfo.js'

function IconUser() {
  return (
    <svg className="login-input__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      />
    </svg>
  )
}

function IconLock() {
  return (
    <svg className="login-input__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"
      />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginRequest(username.trim(), password)
      sessionStorage.setItem('atv_token', data.access_token)
      if (data.user) {
        sessionStorage.setItem('atv_user', JSON.stringify(data.user))
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <main className="login-main">
        <div className="login-card">
          <img
            src="/ATVLogin.png"
            alt="ATV"
            className="login-card__logo"
            width={88}
            height={88}
          />

          <form className="login-form" onSubmit={handleSubmit}>
            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}

            <label className="login-field">
              <span className="visually-hidden">Usuario</span>
              <span className="login-input">
                <IconUser />
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </span>
            </label>

            <label className="login-field">
              <span className="visually-hidden">Contraseña</span>
              <span className="login-input">
                <IconLock />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="········"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </span>
            </label>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </main>

      <footer className="login-version" title={`Commit ${GIT_COMMIT_SHORT}`}>
        {GIT_COMMIT_SHORT}
      </footer>
    </div>
  )
}
