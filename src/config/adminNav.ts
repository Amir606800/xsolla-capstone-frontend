import type { IconName } from '../components/Icon'

/** The admin section's pages, in sidebar order. The routes in App.tsx are made from this list. */
export type AdminSectionKey = 'modules' | 'calendar' | 'students' | 'mentors' | 'lecturers' | 'teams' | 'notifications'

export interface AdminSection {
  key: AdminSectionKey
  path: string
  label: string
  icon: IconName
  /** One line under the page title. */
  summary: string
}

export interface AdminNavGroup {
  label: string
  sections: AdminSection[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Course',
    sections: [
      { key: 'modules', path: '/admin/modules', label: 'Modules', icon: 'courses', summary: 'Every module and its tasks, resources and quizzes.' },
      { key: 'calendar', path: '/admin/calendar', label: 'Calendar', icon: 'calendar', summary: 'Lectures, meetings and other events for everyone.' },
    ],
  },
  {
    label: 'People',
    sections: [
      { key: 'students', path: '/admin/students', label: 'Students', icon: 'student', summary: 'Student accounts.' },
      { key: 'mentors', path: '/admin/mentors', label: 'Mentors', icon: 'mentor', summary: 'Mentors and their roles.' },
      { key: 'lecturers', path: '/admin/lecturers', label: 'Lecturers', icon: 'lecturer', summary: 'Lecturers and their roles.' },
      { key: 'teams', path: '/admin/teams', label: 'Teams', icon: 'team', summary: 'Teams, their mentors and students.' },
    ],
  },
  {
    label: 'Messages',
    sections: [
      { key: 'notifications', path: '/admin/notifications', label: 'Notifications', icon: 'bell', summary: 'Announcements everyone sees.' },
    ],
  },
]

export const ADMIN_SECTIONS: AdminSection[] = ADMIN_NAV.flatMap((g) => g.sections)

export const adminSection = (key: AdminSectionKey): AdminSection => ADMIN_SECTIONS.find((s) => s.key === key)!
