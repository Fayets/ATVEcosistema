import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import OnboardingEmbedPage from './pages/OnboardingEmbedPage.jsx'

const ClientsHome = lazy(() => import('./modules/clients/ClientsHome.jsx'))
const FinanzasHome = lazy(() => import('./modules/finanzas/FinanzasHome.jsx'))
const ProductoHome = lazy(() => import('./modules/producto/ProductoHome.jsx'))
const VentasHome = lazy(() => import('./modules/ventas/VentasHome.jsx'))
const MarketingHome = lazy(() => import('./modules/marketing/MarketingHome.jsx'))
const DiscordShell = lazy(() => import('./modules/discord/DiscordShell.jsx'))
const DiscordDashboard = lazy(() => import('./modules/discord/DiscordDashboard.jsx'))
const DiscordTickets = lazy(() => import('./modules/discord/DiscordTickets.jsx'))
const DiscordTicketDetail = lazy(() => import('./modules/discord/DiscordTicketDetail.jsx'))
const DiscordMetrics = lazy(() => import('./modules/discord/DiscordMetrics.jsx'))
const DiscordSettings = lazy(() => import('./modules/discord/DiscordSettings.jsx'))
const OnboardingHome = lazy(() => import('./modules/onboarding/OnboardingHome.jsx'))
const DocsHome = lazy(() => import('./modules/docs/DocsHome.jsx'))

function RouteFallback() {
  return (
    <div className="atv-shell">
      <main className="dashboard-main">
        <p className="module-lead" style={{ textAlign: 'center' }}>
          Cargando módulo…
        </p>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingEmbedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/clientes"
            element={
              <ProtectedRoute>
                <ClientsHome />
              </ProtectedRoute>
            }
          />
          <Route path="/m/entregables" element={<Navigate to="/m/clientes" replace />} />
          <Route
            path="/m/finanzas"
            element={
              <ProtectedRoute>
                <FinanzasHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/producto"
            element={
              <ProtectedRoute>
                <ProductoHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/ventas"
            element={
              <ProtectedRoute>
                <VentasHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/marketing"
            element={
              <ProtectedRoute>
                <MarketingHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/discord"
            element={
              <ProtectedRoute>
                <DiscordShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DiscordDashboard />} />
            <Route path="tickets" element={<DiscordTickets />} />
            <Route path="tickets/:id" element={<DiscordTicketDetail />} />
            <Route path="metrics" element={<DiscordMetrics />} />
            <Route path="settings" element={<DiscordSettings />} />
          </Route>
          <Route
            path="/m/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/docs"
            element={
              <ProtectedRoute>
                <DocsHome />
              </ProtectedRoute>
            }
          />
          <Route path="/m/proximo/1" element={<Navigate to="/m/onboarding" replace />} />
          <Route path="/m/proximo/2" element={<Navigate to="/m/docs" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
