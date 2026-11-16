import { NavLink } from 'react-router'
import { Icon } from '../../../components/Icon'
import type { IconName } from '../../../components/Icon'

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/admin/analytics', label: 'Overview', icon: 'activity', end: true },
  { to: '/admin/analytics/students', label: 'Students', icon: 'student' },
  { to: '/admin/analytics/mentors', label: 'Mentors', icon: 'mentor' },
  { to: '/admin/analytics/lecturers', label: 'Lecturers', icon: 'lecturer' },
]

/** The four parts of Analytics, on every analytics page. A person's page keeps the tab of their role lit. */
export function AnalyticsTabs() {
  return (
    <nav className="analytics-tabs" aria-label="Analytics sections">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="analytics-tabs__tab">
          <Icon name={t.icon} size={16} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
