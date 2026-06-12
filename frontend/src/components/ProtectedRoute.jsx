import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getSession } from '../api.js'

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    getSession()
      .then(() => {
        if (!cancelled) setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('denied')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="atv-shell">
        <main className="dashboard-main">
          <p className="module-lead" style={{ textAlign: 'center' }}>
            Verificando sesión…
          </p>
        </main>
      </div>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/" replace />
  }

  return children
}
