import { Link } from 'react-router-dom'

export default function ModuleLayout({ title, children }) {
  return (
    <div className="atv-shell">
      <main className="module-main">
        <header className="module-header">
          <Link to="/dashboard" className="module-back">
            ← Volver al panel
          </Link>
          <h1 className="module-title">{title}</h1>
        </header>
        <div className="module-body">{children}</div>
      </main>
    </div>
  )
}
