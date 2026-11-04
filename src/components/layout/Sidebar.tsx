import { memo } from 'react'
import { NavLink } from 'react-router'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

interface NavItem {
  to: string
  label: string
  icon: IconName
}

interface NavGroup {
  heading?: string
  items: NavItem[]
}

// Static data: defined once at module level, never re-created on render.
const STUDENT_NAV: NavGroup[] = [
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

interface SidebarProps {
  /** Mobile drawer state. */
  open: boolean
  onClose: () => void
  /** Desktop icon-only rail. Ignored on small screens, where the drawer is always full width. */
  collapsed: boolean
  onToggleCollapsed: () => void
}

function SidebarBase({ open, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <>
      <div
        className={`sidebar-backdrop${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="app-sidebar"
        className={`sidebar${open ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}
        aria-label="Sidebar"
      >
        <button type="button" className="sidebar__close" onClick={onClose} aria-label="Close navigation">
          <Icon name="close" />
        </button>

        <nav aria-label="Main navigation">
          {STUDENT_NAV.map((group, i) => (
            <div className="sidebar__group" key={group.heading ?? i}>
              {group.heading && <p className="sidebar__heading">{group.heading}</p>}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onClose}
                      // the visible text is hidden when collapsed, so keep an explicit name
                      aria-label={item.label}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
                    >
                      <Icon name={item.icon} />
                      <span className="sidebar__text">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} />
          <span className="sidebar__text">Collapse</span>
        </button>
      </aside>
    </>
  )
}

export const Sidebar = memo(SidebarBase)
