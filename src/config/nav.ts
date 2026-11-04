import type { IconName } from '../components/Icon'

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
      { to: '/grades', label: 'Grades', icon: 'grades' },
    ],
  },
  {
    heading: 'COMMUNITY',
    items: [{ to: '/team', label: 'My team', icon: 'team' }],
  },
]
