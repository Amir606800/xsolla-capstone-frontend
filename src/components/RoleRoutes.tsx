import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import type { User } from '../types/user'
import { isStaff } from '../utils/roles'

/** Layout route for student-only pages (Tasks, My grades): staff go to their dashboard. */
export function StudentOnly() {
  const { user } = useAuth()
  if (isStaff(user)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

/** Shows the staff version of a page to staff, the student's one to everyone else. */
export function ByRole({ student, staff }: { student: ReactNode; staff: ReactNode }) {
  const { user } = useAuth()
  return <>{isStaff(user) ? staff : student}</>
}

/** Only for people who pass `allow` (e.g. `canAuthor`); everyone else goes back to the dashboard. */
export function Allow({ when, children }: { when: (user: User | null) => boolean; children: ReactNode }) {
  const { user } = useAuth()
  return when(user) ? <>{children}</> : <Navigate to="/dashboard" replace />
}
