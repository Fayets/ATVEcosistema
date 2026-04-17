import { Link, useNavigate } from 'react-router-dom'
import { dashboardTiles } from '../modules/registry.js'

export default function DashboardPage() {
  const navigate = useNavigate()

  function handleLogout() {
    sessionStorage.removeItem('atv_token')
    sessionStorage.removeItem('atv_user')
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
            const to = `/m/${tile.path}`
            const isPlaceholder = tile.type === 'placeholder'
            return (
              <Link
                key={tile.id}
                to={to}
                className={`dashboard-tile${isPlaceholder ? ' dashboard-tile--placeholder' : ''}`}
              >
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
              </Link>
            )
          })}
        </nav>
      </main>
    </div>
  )
}
