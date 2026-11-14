import { Suspense } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { PageLoader } from '../../components/loading/PageLoader'
import { Avatar } from '../../components/profile/Avatar'
import { useProfile } from '../../hooks/useProfile'
import { AdminAlertsProvider } from '../../context/AdminAlertsProvider'
import { useAdminAlerts } from '../../hooks/useAdminAlerts'
import { GitLabLogo, SlackLogo } from '../../components/BrandLogos'
import { Icon } from '../../components/Icon'
import { LINKS } from '../../config/links'
import { XsollaLogo } from '../../components/XsollaLogo'
import { ADMIN_NAV } from '../../config/adminNav'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import '../../styles/ui.css'
import './admin.css'

const linkClass = ({ isActive }: { isActive: boolean }) => `admin-nav__link${isActive ? ' is-active' : ''}`

/** Slack and GitLab, at the bottom of the section list. They open in a new tab. */
const TOOLS = [
  { name: 'Slack', href: LINKS.slack, logo: <SlackLogo /> },
  { name: 'GitLab', href: LINKS.gitlab, logo: <GitLabLogo /> },
]

/** The admin section's frame: a plain top bar, the section list on the left, the page on the right. */
export default function AdminLayout() {
  return (
    <AdminAlertsProvider>
      <AdminFrame />
    </AdminAlertsProvider>
  )
}

function AdminFrame() {
  const { user, signOut } = useAuth()
  const { attention } = useAdminAlerts()
  const { theme } = useTheme()
  const { profile, savePrefs } = useProfile()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin-brand">
          <XsollaLogo className="admin-brand__logo" />
          <span className="admin-brand__tag">Admin</span>
        </div>
        <div className="admin__account">
          {/* the name opens the admin's profile */}
          <Link to="/admin/profile" className="admin__who" title={user?.email} aria-label={`${user?.name ?? user?.email ?? 'My'} profile`}>
            <Avatar name={user?.name ?? user?.email ?? ''} url={profile.avatarUrl} size={24} />
            <span>{user?.name || user?.email}</span>
          </Link>
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => savePrefs({ theme: theme === 'dark' ? 'light' : 'dark' }).catch(() => undefined)}
            aria-label="Toggle theme"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          <button type="button" className="admin-btn" onClick={handleSignOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      </header>

      <div className="admin__body">
        <nav className="admin-nav" aria-label="Admin sections">
          <NavLink to="/admin" end className={linkClass}>
            <Icon name="dashboard" size={18} /> Overview
          </NavLink>
          {ADMIN_NAV.map((group) => (
            <div key={group.label} className="admin-nav__group" role="group" aria-labelledby={`admin-nav-${group.label}`}>
              <p id={`admin-nav-${group.label}`} className="admin-nav__heading">
                {group.label}
              </p>
              {group.sections.map((s) => (
                <NavLink key={s.key} to={s.path} className={linkClass}>
                  <Icon name={s.icon} size={18} /> {s.label}
                  {s.key === 'notifications' && attention > 0 && (
                    <span className="admin-nav__badge" aria-label={`${attention} need attention`}>
                      {attention > 9 ? '9+' : attention}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="admin-nav__group" role="group" aria-labelledby="admin-nav-community">
            <p id="admin-nav-community" className="admin-nav__heading">
              Community
            </p>
            <NavLink to="/admin/office-tour" className={linkClass}>
              <Icon name="tour" size={18} /> Office tour
            </NavLink>
          </div>

          <div className="admin-nav__group admin-nav__tools" role="group" aria-label="Team tools">
            {TOOLS.map((t) => (
              <a
                key={t.name}
                className="admin-nav__link admin-nav__tool"
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t.name} (opens in a new tab)`}
              >
                {t.logo} {t.name}
                <span className="admin-nav__ext" aria-hidden="true">
                  <Icon name="external" size={13} />
                </span>
              </a>
            ))}
          </div>
        </nav>

        <main className="admin__main">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
