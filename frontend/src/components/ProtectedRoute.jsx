import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  if (!sessionStorage.getItem('atv_token')) {
    return <Navigate to="/" replace />
  }
  return children
}
