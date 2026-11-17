import { memo, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router'
import { LINKS } from '../../config/links'
import { navFor } from '../../config/nav'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useFoldableNav } from '../../hooks/useFoldableNav'
import { isModuleLocked } from '../../utils/progress'
import { GitLabLogo, SlackLogo } from '../BrandLogos'
import { Icon } from '../Icon'
import { FoldBody, FoldHeading } from '../nav/Fold'

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
  const { status, modules, now } = useCourses({ passive: true })
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

/** Slack and GitLab, one click away. They open in a new tab; collapsed, only the logos show. */
function TeamTools({ collapsed }: { collapsed: boolean }) {
  const tools = [
    { name: 'Slack', href: LINKS.slack, logo: <SlackLogo /> },
    { name: 'GitLab', href: LINKS.gitlab, logo: <GitLabLogo /> },
  ]
  return (
    <div className="sidebar__apps" role="group" aria-label="Team tools">
      {tools.map((t) => (
        <a
          key={t.name}
          className="sidebar__app"
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t.name} (opens in a new tab)`}
          title={collapsed ? t.name : `Open ${t.name}`}
        >
          {t.logo}
          <span className="sidebar__text">{t.name}</span>
          <span className="sidebar__app-ext sidebar__text" aria-hidden="true">
            <Icon name="external" size={13} />
          </span>
        </a>
      ))}
    </div>
  )
}

function SidebarBase({ open, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const nav = navFor(useAuth().user)
  const { pathname } = useLocation()
  // the groups with a heading fold only when the menu is taller than the sidebar; on the icon rail nothing folds
  const groups = useMemo(
    () => nav.flatMap((g) => (g.heading ? [{ id: g.heading, paths: g.items.map((i) => i.to) }] : [])),
    [nav],
  )
  const [asideRef, fold] = useFoldableNav({ storageKey: 'sidebar_fold', groups, pathname, enabled: !collapsed })
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
        ref={asideRef}
      >
        <button type="button" className="sidebar__close" onClick={onClose} aria-label="Close navigation">
          <Icon name="close" />
        </button>

        <nav aria-label="Main navigation">
          {nav.map((group, i) => {
            const list = (
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
            )
            const heading = group.heading
            return (
              <div className="sidebar__group" key={heading ?? i}>
                {heading ? (
                  <>
                    <FoldHeading
                      id={`sidebar-group-${i}`}
                      label={heading}
                      className="sidebar__heading"
                      foldable={fold.foldable}
                      open={fold.isOpen(heading)}
                      onToggle={() => fold.toggle(heading)}
                      bodyId={`sidebar-group-body-${i}`}
                    />
                    <FoldBody id={`sidebar-group-body-${i}`} open={fold.isOpen(heading)}>
                      {list}
                    </FoldBody>
                  </>
                ) : (
                  list
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar__bottom">
          <TeamTools collapsed={collapsed} />
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
