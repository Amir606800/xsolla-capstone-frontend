import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import officePhoto from '../assets/images/CrescentOfficesPhoto.webp'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { isValidEmail, isValidName, isValidPassword, passwordsMatch } from '../utils/validation'
import './AuthPage.css'

type Mode = 'signin' | 'signup'

export default function AuthPage() {
  const { isAuthenticated, signIn, signUp } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const isSignup = mode === 'signup'
  const nameOk = !isSignup || isValidName(name)
  const emailOk = isValidEmail(email)
  const passwordOk = isValidPassword(password, isSignup)
  const confirmOk = !isSignup || passwordsMatch(password, confirm)
  const valid = nameOk && emailOk && passwordOk && confirmOk

  function switchMode(next: Mode) {
    setMode(next)
    setTouched(false)
    setFormError('')
    setPassword('')
    setConfirm('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid || submitting) return
    setSubmitting(true)
    setFormError('')
    try {
      if (isSignup) await signUp(email, name.trim(), password)
      else await signIn(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  function handleGoogle() {
    // TODO: Google OAuth
  }

  return (
    <div className="auth">
      <aside className="auth__hero" style={{ ['--hero-img' as string]: `url(${officePhoto})` }}>
        <div className="auth__brand">
          <span className="auth__logo" aria-label="Xsolla">
            XSOLLA
          </span>
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

          <div className="auth__tabs" role="tablist">
            <button
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? 'is-active' : ''}
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? 'is-active' : ''}
              onClick={() => switchMode('signup')}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {isSignup && (
              <>
                <label className="auth__label" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  className="auth__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {touched && !nameOk && <p className="auth__error">Enter your name</p>}
              </>
            )}

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
            />
            {touched && !emailOk && <p className="auth__error">Enter a valid email address</p>}

            <label className="auth__label" htmlFor="password">
              Password
            </label>
            <div className="auth__pw">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                className="auth__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth__eye"
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
            {touched && !passwordOk && (
              <p className="auth__error">
                {isSignup ? 'Password must be at least 8 characters' : 'Enter your password'}
              </p>
            )}

            {isSignup && (
              <>
                <label className="auth__label" htmlFor="confirm">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="auth__input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {touched && !confirmOk && <p className="auth__error">Passwords do not match</p>}
              </>
            )}

            {formError && (
              <p className="auth__error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit" className="auth__submit" disabled={!valid || submitting}>
              {isSignup ? 'Sign up' : 'Sign in'}
            </button>
          </form>

          {!isSignup && (
            <a href="#" className="auth__link">
              Forgot password?
            </a>
          )}

          <div className="auth__or">
            <span>OR</span>
          </div>

          <button
            type="button"
            className="auth__google"
            onClick={handleGoogle}
            aria-label="Continue with Google"
          >
            <svg width="36" height="36" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z"
              />
              <path
                fill="#FBBC05"
                d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
              />
            </svg>
          </button>

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
