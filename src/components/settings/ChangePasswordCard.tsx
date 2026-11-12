import { useId, useState } from 'react'
import { changeOwnPassword } from '../../api/password'
import { useAuth } from '../../hooks/useAuth'
import { passwordError } from '../../utils/credentials'
import { Icon } from '../Icon'
import './settings.css'

/** Everyone (student, mentor, lecturer, admin): change your own password. The current one is asked for first. */
export function ChangePasswordCard({ variant = 'lms' }: { variant?: 'lms' | 'admin' }) {
  const { user } = useAuth()
  const id = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [done, setDone] = useState(false)

  const errors = {
    current: current ? '' : 'Enter your current password.',
    next: next ? (next === current ? 'Choose a password different from the current one.' : passwordError(next, user ?? {})) : 'Enter a new password.',
    again: again === next ? '' : 'The two new passwords are not the same.',
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
      await changeOwnPassword(user.id, current, next)
      setCurrent('')
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

  const field = (key: 'current' | 'next' | 'again', label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div className="pw-card__field">
      <label className="field__label" htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        className="field__input"
        type={type}
        value={value}
        autoComplete={autoComplete}
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
          <p className="pw-card__lead">Pick a new password for your own account. You stay signed in on this device.</p>
        </div>
      </header>

      <form className="pw-card__form" onSubmit={save} noValidate>
        {field('current', 'Current password', current, setCurrent, 'current-password')}
        {field('next', 'New password', next, setNext, 'new-password')}
        <p className="pw-card__hint">10 to 72 characters, with a lowercase letter, an uppercase letter and a number, and no spaces.</p>
        {field('again', 'New password again', again, setAgain, 'new-password')}

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
