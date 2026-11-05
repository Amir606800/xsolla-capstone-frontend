import type { IconName } from '../components/Icon'
import type { Role } from '../types/user'

export interface NavItem {
  to: string
  label: string
  icon: IconName
}

export interface NavGroup {
  heading?: string
  items: NavItem[]
}

/** Main navigation for students. Shared by the sidebar and the search palette. */
export const STUDENT_NAV: NavGroup[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/courses', label: 'My courses', icon: 'courses' },
      { to: '/tasks', label: 'Tasks', icon: 'tasks' },
      { to: '/calendar', label: 'Calendar', icon: 'calendar' },
      { to: '/grades', label: 'My grades', icon: 'grades' },
    ],
  },
  {
    heading: 'COMMUNITY',
    items: [{ to: '/team', label: 'My team', icon: 'team' }],
  },
]

/** Lecturers (and admins) run the course: no student pages like Tasks, My grades or My team. */
export const LECTURER_NAV: NavGroup[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/courses', label: 'Course content', icon: 'courses' },
      { to: '/calendar', label: 'Calendar', icon: 'calendar' },
    ],
  },
]

export const isStaff = (role: Role | undefined) => role === 'teacher' || role === 'admin'

export function navFor(role: Role | undefined): NavGroup[] {
  return isStaff(role) ? LECTURER_NAV : STUDENT_NAV
}
