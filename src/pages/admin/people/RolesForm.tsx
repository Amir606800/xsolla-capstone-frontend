import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../../components/Icon'
import type { SchoolUser } from '../../../types/admin'
import type { Role } from '../../../types/user'
import { dayInput, daysLeft, endOfDay, otherStaffRole, ROLE_NAMES, rolesWithExtra } from '../../../utils/adminRoles'
import type { StaffRole } from '../../../utils/adminRoles'
import { formatShortDate } from '../../../utils/date'

type Choice = 'no' | 'until' | 'always'

/** What each staff role lets someone do, under its name. */
const DOES: Record<StaffRole, string> = {
  mentor: 'Looks after one team: team page, 1:1 times, weekly grades.',
  lecturer: 'Writes the course: modules, tasks, quizzes and lectures.',
}

export type ExtraRole = { on: false } | { on: true; until: string | null }

/**
 * Admin: a staff member's roles. The main role is the one the account was created with: it is shown
 * but cannot be changed or taken away. The other staff role can be added on top (for a while, then it
 * ends by itself, or with no end date) and taken back.
 */
export function RolesForm({
  user,
  main,
  teamName,
  now,
  onSave,
  onCancel,
}: {
  user: SchoolUser
  /** The role the account was created with. */
  main: StaffRole
  /** The team they mentor now, if any (losing an extra mentor role ends that). */
  teamName?: string
  now: Date
  onSave: (roles: Role[], until: Partial<Record<Role, string>>, extra: ExtraRole) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const extra = otherStaffRole(main)
  const extraName = ROLE_NAMES[extra]
  const holds = user.roles.includes(extra)
  const currentUntil = holds ? user.roleUntil?.[extra] : undefined
  const [choice, setChoice] = useState<Choice>(!holds ? 'no' : currentUntil ? 'until' : 'always')
  const [until, setUntil] = useState(currentUntil ? dayInput(new Date(currentUntil)) : dayInput(now, 30))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const untilIso = choice === 'until' ? endOfDay(until) : null
  const untilError = choice === 'until' && (!untilIso || new Date(untilIso) <= now) ? 'Pick a day from today on.' : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (untilError || busy) return
    const next: ExtraRole = choice === 'no' ? { on: false } : { on: true, until: untilIso }
    const { roles, until: ends } = rolesWithExtra(main, next)
    setBusy(true)
    setError('')
    try {
      await onSave(roles, ends, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The roles could not be saved.')
      setBusy(false)
    }
  }

  const lower = extraName.toLowerCase()

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label={`Roles of ${user.name}`}>
      <div className="admin-main-role" role="group" aria-label="Main role">
        <span className="admin-field__label">Main role</span>
        <p className="admin-main-role__value">
          <span className="admin-pill admin-pill--role">
            <Icon name="lock" size={12} /> {ROLE_NAMES[main]}
          </span>
          <span className="admin-hint">{DOES[main]}</span>
        </p>
        <p className="admin-hint">Set when the account was made. It cannot be changed or taken away.</p>
      </div>

      <fieldset className="admin-roles">
        <legend className="admin-field__label">Extra role: {extraName}</legend>
        <p className="admin-hint">{DOES[extra]}</p>
        {currentUntil && (
          <p className="admin-hint">
            Now: {lower} until {formatShortDate(currentUntil)} ({daysLeft(currentUntil, now)} days left).
          </p>
        )}
        <label className="admin-check">
          <input type="radio" name={`${id}-extra`} checked={choice === 'no'} onChange={() => setChoice('no')} />
          <span>Not a {lower}</span>
        </label>
        {choice === 'no' && holds && extra === 'mentor' && teamName && (
          <p className="admin-hint admin-hint--warn">They will stop mentoring {teamName}.</p>
        )}
        <label className="admin-check">
          <input type="radio" name={`${id}-extra`} checked={choice === 'until'} onChange={() => setChoice('until')} />
          <span>
            {extraName} for a while
            <span className="admin-hint">The role ends by itself after the last day.</span>
          </span>
        </label>
        {choice === 'until' && (
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
              aria-invalid={touched && !!untilError}
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
            {touched && untilError && <span className="admin-field__error">{untilError}</span>}
          </div>
        )}
        <label className="admin-check">
          <input type="radio" name={`${id}-extra`} checked={choice === 'always'} onChange={() => setChoice('always')} />
          <span>
            {extraName}, no end date
          </span>
        </label>
      </fieldset>

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
