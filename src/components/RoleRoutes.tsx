import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import { isStaff } from '../config/nav'
import { useAuth } from '../hooks/useAuth'

/** Layout route for student-only pages (Tasks, My grades, My team): lecturers go to their dashboard. */
export function StudentOnly() {
  const { user } = useAuth()
  if (isStaff(user?.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

/** Shows the lecturer's version of a page to teachers and admins, the student's one to everyone else. */
export function ByRole({ student, staff }: { student: ReactNode; staff: ReactNode }) {
  const { user } = useAuth()
  return <>{isStaff(user?.role) ? staff : student}</>
}
