import { useId, useState } from 'react'
import { hasBackend } from '../../api/http'
import { changeOwnPassword } from '../../api/password'
import { useAuth } from '../../hooks/useAuth'
import { passwordError } from '../../utils/credentials'
import { setLoginNotice } from '../../utils/loginNotice'
import { isAdmin } from '../../utils/roles'
import { Icon } from '../Icon'
import './settings.css'

/**
 * Everyone (student, mentor, lecturer, admin): set a new password for your own account. Neither the current password
 * nor an e-mail confirmation is needed (there is no e-mail reset yet), so a person who forgot it can still get in.
 */
export function ChangePasswordCard({ variant = 'lms' }: { variant?: 'lms' | 'admin' }) {
  const { user, signOut } = useAuth()
  const id = useId()
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [done, setDone] = useState(false)

  const errors = {
    next: next ? passwordError(next, user ?? {}) : 'Enter a new password.',
    again: again === next ? '' : 'The two passwords are not the same.',
  }
  const invalid = Object.values(errors).some(Boolean)
  const type = show ? 'text' : 'password'

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    setDone(false)
    if (invalid || busy || !user) return
    setBusy(true)
    setFailed('')
    try {
      const admin = isAdmin(user)
      await changeOwnPassword(user.id, next, { admin })
      // the server ends every session of an admin whose password changed: sign in again with the new one
      if (admin && hasBackend()) {
        setLoginNotice('Your password is changed. Sign in with the new one.')
        await signOut() // the admin pages then send them to the admin sign-in, which shows the notice
        return
      }
      setNext('')
      setAgain('')
      setTouched(false)
      setDone(true)
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Could not change the password. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const field = (key: 'next' | 'again', label: string, value: string, set: (v: string) => void) => (
    <div className="pw-card__field">
      <label className="field__label" htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        className="field__input"
        type={type}
        value={value}
        autoComplete="new-password"
        aria-invalid={touched && !!errors[key]}
        aria-describedby={touched && errors[key] ? `${id}-${key}-error` : undefined}
        onChange={(e) => set(e.target.value)}
      />
      {touched && errors[key] && (
        <p id={`${id}-${key}-error`} className="field__error">
          {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <section className={`pw-card pw-card--${variant}`} aria-labelledby={`${id}-title`}>
      <header className="pw-card__head">
        <span className="pw-card__icon" aria-hidden="true">
          <Icon name="key" size={22} />
        </span>
        <div>
          <h2 id={`${id}-title`} className="pw-card__title">
            Change password
          </h2>
          <p className="pw-card__lead">Set a new password for your own account. You do not need the current one.</p>
        </div>
      </header>

      <form className="pw-card__form" onSubmit={save} noValidate>
        {field('next', 'New password', next, setNext)}
        <p className="pw-card__hint">10 to 72 characters, with a lowercase letter, an uppercase letter and a number, and no spaces.</p>
        {field('again', 'New password again', again, setAgain)}

        <label className="pw-card__show">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show the passwords
        </label>

        {failed && (
          <p className="field__error" role="alert">
            {failed}
          </p>
        )}
        {done && (
          <p className="pw-card__ok" role="status">
            Your password is changed. Use the new one the next time you sign in.
          </p>
        )}
        <div>
          <button type="submit" className={variant === 'admin' ? 'admin-btn admin-btn--primary' : 'btn'} disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </section>
  )
}
