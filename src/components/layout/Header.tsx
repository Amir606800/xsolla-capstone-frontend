import { memo, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { Icon } from '../Icon'

interface HeaderProps {
  onMenuClick: () => void
}

function HeaderBase({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
        <span className="header__logo" aria-label="Xsolla">
          XSOLLA
        </span>
        <span className="header__divider" aria-hidden="true" />
        <span className="header__org">
          <span className="header__org-name">School Baku</span>
          <span className="header__org-sub">LMS</span>
        </span>
      </div>

      <div className="header__actions">
        <button
          type="button"
          className="header__icon-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>

        <button type="button" className="header__icon-btn" aria-label="Notifications">
          <Icon name="bell" />
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
            <span className="header__user-name">{user?.name}</span>
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
    </header>
  )
}

export const Header = memo(HeaderBase)
