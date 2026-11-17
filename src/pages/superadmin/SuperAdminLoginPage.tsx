import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { XsollaLogo } from '../../components/XsollaLogo'
import { useTheme } from '../../hooks/useTheme'
import '../../styles/ui.css'
import '../admin/admin.css'
import { DEMO_PASSWORD, DEMO_USERNAME, isSuperAdminSignedIn, signInSuperAdmin } from './superAdminSession'

/** The sign-in of the Super Admin demo (/super-admin/login). The only account is the demo one, shown on the page. */
export default function SuperAdminLoginPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')

  if (isSuperAdminSignedIn()) return <Navigate to="/super-admin" replace />

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError('')
    if (!username.trim() || !password) return
    if (!signInSuperAdmin(username, password)) {
      setError('Wrong username or password.')
      setPassword('')
      return
    }
    navigate('/super-admin', { replace: true })
  }

  return (
    <div className="admin-auth">
      <button type="button" className="admin-icon-btn admin-auth__theme" onClick={toggleTheme} aria-label="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>

      <main className="admin-auth__card">
        <div className="admin-brand">
          <XsollaLogo className="admin-brand__logo" />
          <span className="admin-brand__tag">Super admin</span>
        </div>

        <h1 className="admin-auth__title">Sign in as super admin</h1>
        <p className="admin-auth__lead">For the people who run all the Xsolla schools: the cohorts and their coordinators.</p>

        <p className="admin-auth__demo" role="note">
          Demo account: username <strong>{DEMO_USERNAME}</strong>, password <strong>{DEMO_PASSWORD}</strong>.
        </p>

        <form onSubmit={submit} noValidate>
          <label className="admin-field__label" htmlFor="sa-username">
            Username
          </label>
          <input
            id="sa-username"
            type="text"
            autoComplete="username"
            className="admin-field__input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={touched && !username.trim()}
          />
          {touched && !username.trim() && <p className="admin-field__error">Enter your username</p>}

          <label className="admin-field__label" htmlFor="sa-password">
            Password
          </label>
          <div className="admin-field__pw">
            <input
              id="sa-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              className="admin-field__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={touched && !password}
            />
            <button
              type="button"
              className="admin-field__eye"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <Icon name="eye" size={18} />
            </button>
          </div>
          {touched && !password && <p className="admin-field__error">Enter your password</p>}

          {error && (
            <p className="admin-field__error admin-auth__alert" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="admin-btn admin-btn--primary admin-auth__submit">
            Sign in
          </button>
        </form>
      </main>
    </div>
  )
}
