import type { IconName } from '../components/Icon'
import type { User } from '../types/user'
import { canAuthor, canMentor, isStaff } from '../utils/roles'

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

/**
 * Staff navigation, built from what the person can do: every staff member gets the dashboard and
 * the calendar, lecturers add Course content, mentors add their team and grading.
 */
function staffNav(user: Pick<User, 'roles'>): NavGroup[] {
  const main: NavItem[] = [{ to: '/dashboard', label: 'Dashboard', icon: 'dashboard' }]
  if (canAuthor(user)) main.push({ to: '/courses', label: 'Course content', icon: 'courses' })
  main.push({ to: '/calendar', label: 'Calendar', icon: 'calendar' })
  const groups: NavGroup[] = [{ items: main }]
  if (canMentor(user)) {
    groups.push({
      heading: 'MENTORING',
      items: [
        { to: '/team', label: 'My team', icon: 'team' },
        { to: '/grading', label: 'Grading', icon: 'grades' },
      ],
    })
  }
  return groups
}

export function navFor(user: Pick<User, 'roles'> | null | undefined): NavGroup[] {
  return user && isStaff(user) ? staffNav(user) : STUDENT_NAV
}
