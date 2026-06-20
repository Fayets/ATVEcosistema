import { Link, useNavigate } from 'react-router-dom'
import { logoutRequest } from '../api.js'
import { dashboardTiles } from '../modules/registry.js'

function tileHref(tile) {
  if (tile.hubPath) return tile.hubPath
  return `/m/${tile.path}`
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
    <div className="atv-shell">
      <main className="dashboard-main">
        <div className="dashboard-logout-bar">
          <button type="button" className="dashboard-logout" onClick={handleLogout}>
            Salir
          </button>
        </div>

        <header className="dashboard-header">
          <img
            src="/ATVLogin.png"
            alt="ATV"
            className="dashboard-header__logo"
            width={88}
            height={88}
          />
        </header>

        <nav className="dashboard-grid" aria-label="Módulos ATV">
          {dashboardTiles.map((tile) => {
            const to = tileHref(tile)
            const isPending = tile.status === 'por_construir'
            const className = `dashboard-tile${isPending ? ' dashboard-tile--pending' : ''}`
            const ariaLabel = isPending ? `${tile.label} (por construir)` : tile.label
            const content = (
              <>
                <div className="dashboard-tile__media">
                  {tile.image ? (
                    <img
                      src={tile.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                </div>
                <span className="dashboard-tile__label">{tile.label}</span>
              </>
            )

            if (to.startsWith('http')) {
              return (
                <a
                  key={tile.id}
                  href={to}
                  className={className}
                  aria-label={ariaLabel}
                >
                  {content}
                </a>
              )
            }

            return (
              <Link key={tile.id} to={to} className={className} aria-label={ariaLabel}>
                {content}
              </Link>
            )
          })}
        </nav>
      </main>
    </div>
  )
}
