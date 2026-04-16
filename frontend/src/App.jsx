import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'

const ClientsHome = lazy(() => import('./modules/clients/ClientsHome.jsx'))
const FinanzasHome = lazy(() => import('./modules/finanzas/FinanzasHome.jsx'))
const ProductoHome = lazy(() => import('./modules/producto/ProductoHome.jsx'))
const VentasHome = lazy(() => import('./modules/ventas/VentasHome.jsx'))
const MarketingHome = lazy(() => import('./modules/marketing/MarketingHome.jsx'))
const ProximoModulo = lazy(() => import('./modules/placeholder/ProximoModulo.jsx'))

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
          <Route path="/onboarding" element={<OnboardingPage />} />
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
            path="/m/proximo/:slot"
            element={
              <ProtectedRoute>
                <ProximoModulo />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
