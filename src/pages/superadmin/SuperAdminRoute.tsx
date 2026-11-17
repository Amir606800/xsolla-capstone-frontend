import { Navigate, Outlet } from 'react-router'
import { isSuperAdminSignedIn } from './superAdminSession'

/** The Super Admin pages need the demo sign-in. */
export default function SuperAdminRoute() {
  return isSuperAdminSignedIn() ? <Outlet /> : <Navigate to="/super-admin/login" replace />
}
