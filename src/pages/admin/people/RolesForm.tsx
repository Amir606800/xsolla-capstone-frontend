import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Role, User } from '../../../types/user'
import { dayInput, daysLeft, endOfDay } from '../../../utils/adminRoles'
import { formatShortDate } from '../../../utils/date'

type LecturerChoice = 'no' | 'until' | 'always'

/**
 * Admin: a staff member's roles. Mentor on or off; Lecturer off, until a date (it then ends by
 * itself) or with no end date. At least one role stays.
 */
export function RolesForm({
  user,
  teamName,
  now,
  onSave,
  onCancel,
}: {
  user: User
  /** The team they mentor now, if any (losing the mentor role ends that). */
  teamName?: string
  now: Date
  onSave: (roles: Role[], until: Partial<Record<Role, string>>) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const currentUntil = user.roleUntil?.lecturer
  const [mentor, setMentor] = useState(user.roles.includes('mentor'))
  const [lecturer, setLecturer] = useState<LecturerChoice>(!user.roles.includes('lecturer') ? 'no' : currentUntil ? 'until' : 'always')
  const [until, setUntil] = useState(currentUntil ? dayInput(new Date(currentUntil)) : dayInput(now, 30))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const untilIso = lecturer === 'until' ? endOfDay(until) : null
  const errors = {
    none: !mentor && lecturer === 'no' ? 'Keep at least one role.' : '',
    until: lecturer === 'until' && (!untilIso || new Date(untilIso) <= now) ? 'Pick a day from today on.' : '',
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (errors.none || errors.until || busy) return
    const roles: Role[] = [...(mentor ? (['mentor'] as const) : []), ...(lecturer !== 'no' ? (['lecturer'] as const) : [])]
    setBusy(true)
    setError('')
    try {
      await onSave(roles, untilIso ? { lecturer: untilIso } : {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The roles could not be saved.')
      setBusy(false)
    }
  }

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label={`Roles of ${user.name}`}>
      <fieldset className="admin-roles">
        <legend className="admin-field__label">Mentor</legend>
        <label className="admin-check">
          <input type="checkbox" checked={mentor} onChange={(e) => setMentor(e.target.checked)} />
          <span>
            Mentor
            <span className="admin-hint">Looks after one team: team page, 1:1 times, weekly grades.</span>
          </span>
        </label>
        {!mentor && teamName && user.roles.includes('mentor') && <p className="admin-hint admin-hint--warn">They will stop mentoring {teamName}.</p>}
      </fieldset>

      <fieldset className="admin-roles">
        <legend className="admin-field__label">Lecturer</legend>
        {currentUntil && (
          <p className="admin-hint">
            Now: lecturer until {formatShortDate(currentUntil)} ({daysLeft(currentUntil, now)} days left).
          </p>
        )}
        <label className="admin-check">
          <input type="radio" name={`${id}-lecturer`} checked={lecturer === 'no'} onChange={() => setLecturer('no')} />
          <span>Not a lecturer</span>
        </label>
        <label className="admin-check">
          <input type="radio" name={`${id}-lecturer`} checked={lecturer === 'until'} onChange={() => setLecturer('until')} />
          <span>
            Lecturer for a while
            <span className="admin-hint">The role ends by itself after the last day.</span>
          </span>
        </label>
        {lecturer === 'until' && (
          <div className="admin-field admin-roles__until">
            <label className="admin-field__label" htmlFor={`${id}-until`}>
              Last day
            </label>
            <input
              id={`${id}-until`}
              type="date"
              className="admin-field__input"
              value={until}
              min={dayInput(now)}
              onChange={(e) => setUntil(e.target.value)}
              aria-invalid={touched && !!errors.until}
            />
            <div className="admin-actions" role="group" aria-label="Quick periods">
              {[
                [7, '1 week'],
                [30, '1 month'],
                [90, '3 months'],
              ].map(([days, label]) => (
                <button key={label} type="button" className="admin-btn admin-btn--small" onClick={() => setUntil(dayInput(now, days as number))}>
                  {label}
                </button>
              ))}
            </div>
            {touched && errors.until && <span className="admin-field__error">{errors.until}</span>}
          </div>
        )}
        <label className="admin-check">
          <input type="radio" name={`${id}-lecturer`} checked={lecturer === 'always'} onChange={() => setLecturer('always')} />
          <span>Lecturer, no end date</span>
        </label>
      </fieldset>

      {touched && errors.none && (
        <p className="admin-field__error" role="alert">
          {errors.none}
        </p>
      )}
      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save roles'}
        </button>
      </div>
    </form>
  )
}
