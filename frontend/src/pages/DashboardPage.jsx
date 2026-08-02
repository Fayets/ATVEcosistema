import { Link, useNavigate } from 'react-router-dom'
import { logoutRequest } from '../api.js'
import { dashboardTiles } from '../modules/registry.js'

function tileHref(tile) {
  if (tile.hubPath) return tile.hubPath
  return `/m/${tile.path}`
}

function DashboardTile({ tile }) {
  const to = tileHref(tile)
  const isPending = tile.status === 'por_construir'
  const className = `dashboard-tile${isPending ? ' dashboard-tile--pending' : ''}`
  const ariaLabel = isPending ? `${tile.label} (por construir)` : tile.label

  const content = (
    <>
      <span className="dashboard-tile__icon" aria-hidden="true">
        <img src={tile.image} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="dashboard-tile__label">{tile.label}</span>
    </>
  )

  if (to.startsWith('http')) {
    return (
      <a href={to} className={className} aria-label={ariaLabel}>
        {content}
      </a>
    )
  }

  return (
    <Link to={to} className={className} aria-label={ariaLabel}>
      {content}
    </Link>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logoutRequest()
    } catch {
      /* cookie puede estar ya ausente */
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <img
          src="/AumentaTuValorLogo.png"
          alt="Aumenta Tu Valor"
          className="dashboard-brand-logo"
          width={112}
          height={36}
        />
      </header>

      <main className="dashboard-main">
        <nav className="dashboard-grid" aria-label="Módulos ATV">
          {dashboardTiles.map((tile) => (
            <DashboardTile key={tile.id} tile={tile} />
          ))}
        </nav>

        <button type="button" className="dashboard-logout btn-secondary" onClick={handleLogout}>
          Salir
        </button>
      </main>
    </div>
  )
}
