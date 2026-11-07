import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { isAdmin } from '../utils/roles'

/** Layout route for the admin section: guests go to the admin sign-in, other accounts to the LMS. */
export default function AdminRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  if (!isAdmin(user)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
