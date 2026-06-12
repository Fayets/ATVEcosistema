import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { DiscordLogo } from './DiscordLogo.jsx'
import './discord.css'

const NAV = [
  { to: '/m/discord/dashboard', label: 'Dashboard', end: true },
  { to: '/m/discord/tickets', label: 'Tickets', end: false },
  { to: '/m/discord/metrics', label: 'Métricas', end: true },
  { to: '/m/discord/settings', label: 'Configuración', end: true },
]

export default function DiscordShell() {
  const [theme, setTheme] = useState(() => {
    const stored = window.localStorage.getItem('atv_tickets_theme')
    return stored === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    window.localStorage.setItem('atv_tickets_theme', theme)
  }, [theme])

  return (
    <div className="atv-shell dsc-app" data-theme={theme}>
      <aside className="dsc-sidebar">
        <div className="dsc-sidebar__brand">
          <span className="dsc-logo-wrap">
            <DiscordLogo size={40} />
          </span>
          <div>
            <h1>ATV Discord</h1>
            <p>Soporte</p>
          </div>
          <button
            type="button"
            className="dsc-theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
        </div>
        <nav className="dsc-sidebar__nav" aria-label="Principal">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `dsc-nav-link${isActive ? ' dsc-nav-link--active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="dsc-sidebar__footer">
          <NavLink to="/dashboard" className="dsc-back-hub">
            ← Volver al panel ATV
          </NavLink>
        </div>
      </aside>
      <div className="dsc-main">
        <Outlet />
      </div>
    </div>
  )
}
