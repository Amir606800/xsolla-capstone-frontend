import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { DEMO_ADMIN } from '../../api/auth.mock'
import { hasBackend } from '../../api/http'
import { Icon } from '../../components/Icon'
import { XsollaLogo } from '../../components/XsollaLogo'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { takeLoginNotice } from '../../utils/loginNotice'
import { isAdmin } from '../../utils/roles'
import { isValidEmail, isValidPassword } from '../../utils/validation'
import './admin.css'

/**
 * The admin section's own sign-in (/admin/login): e-mail and password only, no sign-up.
 * It uses the same POST /auth/login as the LMS, then refuses any account without the admin role.
 */
export default function AdminLoginPage() {
  const { user, signInAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  // set when the admin was signed out (read once)
  const [notice] = useState(takeLoginNotice)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  if (isAdmin(user)) return <Navigate to="/admin" replace />

  const emailOk = isValidEmail(email)
  const passwordOk = isValidPassword(password, false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!emailOk || !passwordOk || submitting) return
    setSubmitting(true)
    setFormError('')
    try {
      await signInAdmin(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-auth">
      <button type="button" className="admin-icon-btn admin-auth__theme" onClick={toggleTheme} aria-label="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>

      <main className="admin-auth__card">
        <div className="admin-brand">
          <XsollaLogo className="admin-brand__logo" />
          <span className="admin-brand__tag">Admin</span>
        </div>

        <h1 className="admin-auth__title">Sign in to the admin panel</h1>
        <p className="admin-auth__lead">For the people who run the school. Students and staff sign in on the LMS page.</p>

        {notice && (
          <p className="admin-auth__demo" role="status">
            {notice}
          </p>
        )}

        {!hasBackend() && (
          <p className="admin-auth__demo">
            Offline demo:{' '}
            <button
              type="button"
              className="admin-link"
              onClick={() => {
                setEmail(DEMO_ADMIN.email)
                setPassword('demo')
                setFormError('')
              }}
            >
              use the demo admin account
            </button>
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label className="admin-field__label" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            className="admin-field__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={touched && !emailOk}
          />
          {touched && !emailOk && <p className="admin-field__error">Enter a valid email address</p>}

          <label className="admin-field__label" htmlFor="admin-password">
            Password
          </label>
          <div className="admin-field__pw">
            <input
              id="admin-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              className="admin-field__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={touched && !passwordOk}
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
          {touched && !passwordOk && <p className="admin-field__error">Enter your password</p>}

          {formError && (
            <p className="admin-field__error admin-auth__alert" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className="admin-btn admin-btn--primary admin-auth__submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <Link to="/login" className="admin-link admin-auth__back">
          Not an admin? Go to the LMS sign-in
        </Link>
      </main>
    </div>
  )
}
