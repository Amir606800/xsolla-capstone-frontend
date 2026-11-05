import { memo } from 'react'
import { NavLink } from 'react-router'
import { navFor } from '../../config/nav'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { isModuleLocked } from '../../utils/progress'
import { Icon } from '../Icon'

interface SidebarProps {
  /** Mobile drawer state. */
  open: boolean
  onClose: () => void
  /** Desktop icon-only rail. Ignored on small screens, where the drawer is always full width. */
  collapsed: boolean
  onToggleCollapsed: () => void
}

/** "Week 6 of 12": how far into the program we are (modules that have opened so far). */
function ProgramProgress() {
  const { status, modules, now } = useCourses()
  if (status !== 'ready' || modules.length === 0) return null

  const opened = modules.filter((m) => !isModuleLocked(m, now)).length
  const pct = Math.round((opened / modules.length) * 100)

  return (
    <div className="sidebar__progress">
      <div className="sidebar__progress-head">
        <span>Program</span>
        <strong>
          Week {opened} of {modules.length}
        </strong>
      </div>
      <div
        className="sidebar__progress-bar"
        role="progressbar"
        aria-label="Program progress"
        aria-valuemin={0}
        aria-valuemax={modules.length}
        aria-valuenow={opened}
        aria-valuetext={`Week ${opened} of ${modules.length}`}
      >
        <div className="sidebar__progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SidebarBase({ open, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const nav = navFor(useAuth().user?.role)
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
          {nav.map((group, i) => (
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
                      <span className="sidebar__icon">
                        <Icon name={item.icon} size={20} />
                      </span>
                      <span className="sidebar__text">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <ProgramProgress />

          <button
            type="button"
            className="sidebar__toggle"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="sidebar__icon">
              <Icon name={collapsed ? 'expand' : 'collapse'} size={20} />
            </span>
            <span className="sidebar__text">Collapse</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export const Sidebar = memo(SidebarBase)
