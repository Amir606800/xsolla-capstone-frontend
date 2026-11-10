import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { isAdmin } from '../utils/roles'

/** Layout route for the LMS pages: signed-in users only. Admins work in their own section. */
export default function ProtectedRoute() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  // Google sends everyone back to /settings (?google=connected); an admin's settings live in their own section
  if (isAdmin(user)) return <Navigate to={location.pathname === '/settings' ? `/admin/settings${location.search}` : '/admin'} replace />
  return <Outlet />
}
