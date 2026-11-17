import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../../components/Icon'
import type { SchoolUser } from '../../../types/admin'
import { generatePassword } from '../../../utils/adminPeople'
import { passwordError } from '../../../utils/credentials'
import { PasswordChecklist } from './PasswordChecklist'
import { PasswordHandover } from './PasswordHandover'

/**
 * Admin: set a new password for someone who cannot sign in. Type one or generate one, save, then the
 * dialog shows it once more with a Copy button so it can be handed over. The old password stops working.
 */
export function ResetPasswordForm({
  user,
  onSave,
  onDone,
}: {
  user: SchoolUser
  onSave: (password: string) => Promise<void>
  /** Closes the dialog (Cancel before saving, Done after). */
  onDone: (saved: boolean) => void
}) {
  const id = useId()
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const invalid = passwordError(password, user)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (invalid || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(password)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The password could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    return (
      <PasswordHandover
        name={user.name}
        label="New password"
        headline={`${user.name}’s password has been changed.`}
        hint="Give it to them in person or in a private message. Their old password no longer works. This is the last time it is shown."
        password={password}
        onDone={() => onDone(true)}
      />
    )
  }

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label={`Reset the password of ${user.name}`}>
      <p className="admin-muted">
        A new password for <strong>{user.name}</strong> ({user.email}). Their old password stops working and they are signed out
        everywhere.
      </p>
      <div className="admin-field">
        <label className="admin-field__label" htmlFor={`${id}-password`}>
          New password
        </label>
        <div className="admin-pw-row">
          <div className="admin-field__pw">
            <input
              id={`${id}-password`}
              type={showPw ? 'text' : 'password'}
              className="admin-field__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-invalid={touched && !!invalid}
              aria-describedby={`${id}-hint ${id}-rules${touched && invalid ? ` ${id}-error` : ''}`}
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
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setPassword(generatePassword(12, undefined, user))
              setShowPw(true)
            }}
          >
            Generate
          </button>
        </div>
        <span id={`${id}-hint`} className="admin-hint">
          You will see it again after saving, to copy it.
        </span>
        <PasswordChecklist id={`${id}-rules`} password={password} owner={user} />
        {touched && invalid && (
          <span id={`${id}-error`} className="admin-field__error">
            {invalid}
          </span>
        )}
      </div>

      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn" onClick={() => onDone(false)} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </div>
    </form>
  )
}
