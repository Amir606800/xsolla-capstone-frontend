import { memo, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { isStaff } from '../../utils/roles'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardLayout } from '../../hooks/useDashboardLayout'
import { useNotifications } from '../../hooks/useNotifications'
import { useTheme } from '../../hooks/useTheme'
import { Icon } from '../Icon'
import { XsollaLogo } from '../XsollaLogo'
import { NotificationsModal } from '../notifications/NotificationsModal'
import { CommandPalette } from '../search/CommandPalette'
import { CurrentModuleChip } from './CurrentModuleChip'

interface HeaderProps {
  onMenuClick: () => void
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const SHORTCUT = isMac ? '⌘ K' : 'Ctrl K'

function HeaderBase({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isShown } = useDashboardLayout()
  // the dashboard's own "Current task" widget shows the same thing, so the header chip steps aside there
  // (lecturers have their own dashboard without that widget)
  const showChip = isStaff(user) || !(pathname === '/dashboard' && isShown('current-task'))
  const { unreadCount } = useNotifications()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Ctrl/Cmd + K opens the search from anywhere
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault() // don't let the browser focus its own search bar
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close the user menu on outside click / Escape (listeners only while open)
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="header">
      <button
        type="button"
        className="header__icon-btn header__menu-btn"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Icon name="menu" />
      </button>

      <div className="header__brand">
        <XsollaLogo className="header__logo" />
        <span className="header__divider" aria-hidden="true" />
        <span className="header__org">
          <span className="header__org-name">School Baku</span>
          <span className="header__org-sub">LMS</span>
        </span>
      </div>

      {/* centre column: truly centred in the header, so the bar looks balanced */}
      <div className="header__center">
        <button
          type="button"
          className="search-trigger"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        >
          <Icon name="search" size={18} />
          <span className="search-trigger__text">Search courses, tasks, pages…</span>
          <kbd aria-hidden="true">{SHORTCUT}</kbd>
        </button>
      </div>

      <div className="header__actions">
        {showChip && <CurrentModuleChip />}

        <button
          type="button"
          className="header__icon-btn header__search-btn"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          aria-haspopup="dialog"
        >
          <Icon name="search" />
        </button>

        <button
          type="button"
          className="header__icon-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>

        <button
          type="button"
          className="header__icon-btn bell"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-haspopup="dialog"
          onClick={() => setNotifOpen(true)}
        >
          <Icon name="bell" />
          {unreadCount > 0 && (
            <span className="bell__badge" aria-hidden="true">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="header__user" ref={menuRef}>
          <button
            type="button"
            className="header__user-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <Icon name="user" />
            <span className="header__user-name" title={user?.name}>{user?.name}</span>
            <Icon name="chevron" size={16} />
          </button>

          {menuOpen && (
            <div className="header__menu" role="menu">
              <div className="header__menu-info">
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
              </div>
              <button type="button" role="menuitem" onClick={handleSignOut}>
                <Icon name="logout" size={18} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <NotificationsModal open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}

export const Header = memo(HeaderBase)
