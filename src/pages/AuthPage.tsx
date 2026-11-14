import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { DEMO_ACCOUNTS } from '../api/auth.mock'
import { hasBackend } from '../api/http'
import { roleLabel } from '../utils/roles'
import { goTo } from '../utils/teleport'
import officePhoto from '../assets/images/CrescentOfficesPhoto.webp'
import { XsollaLogo } from '../components/XsollaLogo'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { isValidEmail, isValidPassword } from '../utils/validation'
import './AuthPage.css'

export default function AuthPage() {
  const { isAuthenticated, signIn } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (isAuthenticated && returnTo) {
      goTo(returnTo)
    }
  }, [isAuthenticated, returnTo])

  if (isAuthenticated) {
    if (returnTo) return null
    return <Navigate to="/dashboard" replace />
  }

  const emailOk = isValidEmail(email)
  const passwordOk = isValidPassword(password, false)
  const valid = emailOk && passwordOk

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!valid || submitting) return
    setSubmitting(true)
    setFormError('')
    try {
      await signIn(email, password)
      if (returnTo) {
        goTo(returnTo)
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth__hero" style={{ ['--hero-img' as string]: `url(${officePhoto})` }}>
        <div className="auth__brand">
          <XsollaLogo className="auth__logo" />
          <span className="auth__school">SCHOOL BAKU</span>
        </div>
      </aside>

      <button
        type="button"
        className="auth__theme"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <main className="auth__main">
        <div className="auth__card">
          <h1 className="auth__title">Welcome</h1>

          {!hasBackend() && (
            <div className="auth__demo" role="group" aria-label="Demo accounts">
              <span>Offline demo, sign in as:</span>
              {Object.values(DEMO_ACCOUNTS).map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className="auth__demo-btn"
                  onClick={() => {
                    setEmail(a.email)
                    setPassword('demo')
                    setFormError('')
                  }}
                >
                  {roleLabel(a)}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <label className="auth__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="auth__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={touched.email && !emailOk}
              aria-describedby={touched.email && !emailOk ? 'email-error' : undefined}
            />
            {touched.email && !emailOk && (
              <p id="email-error" className="auth__error">
                Enter a valid email address
              </p>
            )}

            <label className="auth__label" htmlFor="password">
              Password
            </label>
            <div className="auth__pw">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className="auth__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // clicking the eye button (inside the same box) is not leaving the field
                onBlur={(e) => {
                  if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) setTouched((t) => ({ ...t, password: true }))
                }}
                aria-invalid={touched.password && !passwordOk}
                aria-describedby={touched.password && !passwordOk ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="auth__eye"
                // pressing it must not take the focus out of the password field (that would count as leaving it)
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {!showPw && <path d="M3 3l18 18" />}
                </svg>
              </button>
            </div>
            {touched.password && !passwordOk && (
              <p id="password-error" className="auth__error">
                Enter your password
              </p>
            )}

            {formError && (
              <p className="auth__error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit" className="auth__submit" disabled={!valid || submitting}>
              Sign in
            </button>
          </form>

          <Link to="/forgot-password" className="auth__link">
            Forgot password?
          </Link>

          <p className="auth__support">
            Are you a gamer with a payment issue?
            <br />
            <a href="#" className="auth__link">
              Contact gamer support
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
