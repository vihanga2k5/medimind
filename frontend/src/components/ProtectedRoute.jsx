import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />
  if (!allowedRoles.includes(user.role)) return <Navigate to={`/${user.role}/dashboard`} replace />
  return children
}
