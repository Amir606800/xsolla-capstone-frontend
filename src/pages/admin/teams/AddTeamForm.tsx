import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { NewTeam } from '../../../mocks/directory'
import type { SchoolTeam, SchoolUser } from '../../../types/admin'
import { TEAM_LIMIT } from '../../../utils/adminPeople'
import { nextTeamName } from '../../../utils/adminTeams'

/**
 * Admin: one new team. A name (the next "Team N" to start with), a mentor if there is one to give, and
 * any students who are not in a team yet. Students in other teams are moved with "Move to…" afterwards.
 */
export function AddTeamForm({
  teams,
  mentors,
  loose,
  onSave,
  onCancel,
}: {
  teams: SchoolTeam[]
  mentors: SchoolUser[]
  /** Students without a team. */
  loose: SchoolUser[]
  onSave: (team: NewTeam) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const [name, setName] = useState(() => nextTeamName(teams.map((t) => t.name)))
  const [mentorId, setMentorId] = useState<number | null>(() => mentors.find((m) => !teams.some((t) => t.mentorId === m.id))?.id ?? null)
  const [picked, setPicked] = useState<number[]>([])
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clean = name.trim().replace(/\s+/g, ' ')
  const nameError = !clean
    ? 'Give the team a name.'
    : teams.some((t) => t.name.toLowerCase() === clean.toLowerCase())
      ? `There is already a team called ${clean}.`
      : ''
  const leads = (mentor: number) => teams.find((t) => t.mentorId === mentor)
  const movingFrom = mentorId !== null ? leads(mentorId) : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (nameError || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave({ name: clean, mentorId, studentIds: picked })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The team could not be added.')
      setBusy(false)
    }
  }

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label="New team">
      <div className="admin-form-row">
        <div className="admin-field">
          <label className="admin-field__label" htmlFor={`${id}-name`}>
            Name
          </label>
          <input
            id={`${id}-name`}
            className="admin-field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-invalid={touched && !!nameError}
            aria-describedby={touched && nameError ? `${id}-name-error` : undefined}
          />
          {touched && nameError && (
            <span id={`${id}-name-error`} className="admin-field__error">
              {nameError}
            </span>
          )}
        </div>
        <div className="admin-field">
          <label className="admin-field__label" htmlFor={`${id}-mentor`}>
            Mentor
          </label>
          <select
            id={`${id}-mentor`}
            className="admin-field__input"
            value={mentorId ?? ''}
            onChange={(e) => setMentorId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No mentor yet</option>
            {mentors.map((m) => {
              const team = leads(m.id)
              return (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {team ? ` (now ${team.name})` : ''}
                </option>
              )
            })}
          </select>
          {movingFrom && <span className="admin-hint admin-hint--warn">They leave {movingFrom.name}, which will have no mentor.</span>}
        </div>
      </div>

      <fieldset className="admin-roles admin-weeks">
        <legend className="admin-field__label">Students without a team</legend>
        {loose.length === 0 ? (
          <p className="admin-hint">Every student is in a team. Move students into the new team with “Move to…” afterwards.</p>
        ) : (
          loose.map((s) => (
            <label key={s.id} className="admin-check">
              <input
                type="checkbox"
                checked={picked.includes(s.id)}
                onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))}
              />
              <span>{s.name}</span>
            </label>
          ))
        )}
      </fieldset>
      {loose.length > 0 && (
        <p className={`admin-muted${picked.length > TEAM_LIMIT ? ' admin-hint--warn' : ''}`} aria-live="polite">
          {picked.length === 0
            ? 'No students yet: you can add them later.'
            : `${picked.length} ${picked.length === 1 ? 'student' : 'students'}${picked.length > TEAM_LIMIT ? `, more than the usual ${TEAM_LIMIT}` : ''}.`}
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
          {busy ? 'Adding…' : 'Add team'}
        </button>
      </div>
    </form>
  )
}
