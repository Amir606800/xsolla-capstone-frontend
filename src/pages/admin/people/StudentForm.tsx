import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { NewStudent } from '../../../api/directory'
import { Icon } from '../../../components/Icon'
import type { SchoolTeam } from '../../../types/admin'
import type { User } from '../../../types/user'
import { generatePassword, TEAM_LIMIT } from '../../../utils/adminPeople'
import { isValidEmail, isValidName, isValidPassword, MIN_SIGNUP_PASSWORD_LENGTH } from '../../../utils/validation'

/**
 * Admin: a student's or a mentor's account. New: name, e-mail, the password the admin chooses and
 * (optionally) a team: the team a student is in, or the team a mentor looks after. Editing (`student`
 * given): name, e-mail and team; the password is not shown or changed here.
 */
export function StudentForm({
  variant = 'student',
  student,
  teamOf,
  users,
  teams,
  nameOf = (id) => `User #${id}`,
  onSave,
  onCancel,
}: {
  variant?: 'student' | 'mentor' | 'lecturer'
  /** The account being edited (a student or a mentor). */
  student?: User
  /** Their team now (when editing). */
  teamOf?: string | null
  users: User[]
  teams: SchoolTeam[]
  /** Names for the mentors shown next to the teams. */
  nameOf?: (id: number) => string
  onSave: (input: NewStudent) => Promise<void>
  onCancel: () => void
}) {
  const editing = !!student
  const isMentor = variant === 'mentor'
  const isLecturer = variant === 'lecturer'
  const noun = variant
  const [name, setName] = useState(student?.name ?? '')
  const [email, setEmail] = useState(student?.email ?? '')
  const [password, setPassword] = useState('')
  const [teamId, setTeamId] = useState(teamOf ?? '')
  const [showPw, setShowPw] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = useId()

  const taken = users.some((u) => u.id !== student?.id && u.email.toLowerCase() === email.trim().toLowerCase())
  const errors = {
    name: isValidName(name) ? '' : 'Enter their name.',
    email: !isValidEmail(email.trim())
      ? 'Enter a valid email address.'
      : taken
        ? 'There is already an account with this email.'
        : '',
    password: editing || isValidPassword(password, true) ? '' : `At least ${MIN_SIGNUP_PASSWORD_LENGTH} characters.`,
  }
  const team = teams.find((t) => t.id === teamId)
  // a full team counts the student themselves when they are already in it
  const others = team ? team.studentIds.filter((sid) => sid !== student?.id).length : 0
  const full = !isMentor && team && others >= TEAM_LIMIT
  // a team has one mentor: choosing a team that has another one replaces them
  const replaced = isMentor && team && team.mentorId !== null && team.mentorId !== student?.id ? team.mentorId : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (errors.name || errors.email || errors.password || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave({ name: name.trim(), email: email.trim(), password, teamId: teamId || null })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : editing ? 'The changes could not be saved.' : `The ${noun} could not be added.`,
      )
      setBusy(false)
    }
  }

  const show = (k: keyof typeof errors) => (touched && errors[k] ? errors[k] : '')

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label={editing ? `Edit ${student.name}` : `New ${noun}`}>
      <div className="admin-field">
        <label className="admin-field__label" htmlFor={`${id}-name`}>
          Full name
        </label>
        <input
          id={`${id}-name`}
          className="admin-field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          aria-invalid={!!show('name')}
          aria-describedby={show('name') ? `${id}-name-error` : undefined}
        />
        {show('name') && (
          <span id={`${id}-name-error`} className="admin-field__error">
            {show('name')}
          </span>
        )}
      </div>

      <div className="admin-field">
        <label className="admin-field__label" htmlFor={`${id}-email`}>
          Email
        </label>
        <input
          id={`${id}-email`}
          type="email"
          className="admin-field__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          aria-invalid={!!show('email')}
          aria-describedby={show('email') ? `${id}-email-error` : undefined}
        />
        {show('email') && (
          <span id={`${id}-email-error`} className="admin-field__error">
            {show('email')}
          </span>
        )}
      </div>

      {!editing && (
        <div className="admin-field">
          <label className="admin-field__label" htmlFor={`${id}-password`}>
            Password
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
                aria-invalid={!!show('password')}
                aria-describedby={`${id}-password-hint${show('password') ? ` ${id}-password-error` : ''}`}
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
                setPassword(generatePassword())
                setShowPw(true)
              }}
            >
              Generate
            </button>
          </div>
          <span id={`${id}-password-hint`} className="admin-hint">
            Give it to the {noun} so they can sign in. At least {MIN_SIGNUP_PASSWORD_LENGTH} characters.
          </span>
          {show('password') && (
            <span id={`${id}-password-error`} className="admin-field__error">
              {show('password')}
            </span>
          )}
        </div>
      )}

      {!isLecturer && (
        <div className="admin-field">
          <label className="admin-field__label" htmlFor={`${id}-team`}>
            {isMentor ? 'Team they mentor' : 'Team'}
          </label>
          <select id={`${id}-team`} className="admin-field__input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">No team yet</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (
                {isMentor
                  ? t.mentorId === null
                    ? 'no mentor'
                    : t.mentorId === student?.id
                      ? 'mentors it now'
                      : `mentor: ${nameOf(t.mentorId)}`
                  : `${t.studentIds.length} ${t.studentIds.length === 1 ? 'student' : 'students'}`}
                )
              </option>
            ))}
          </select>
          {replaced !== null && team && (
            <span className="admin-hint admin-hint--warn">
              {team.name} is mentored by {nameOf(replaced)} now. {nameOf(replaced)} will have no team.
            </span>
          )}
          {full && (
            <span className="admin-hint admin-hint--warn">
              {team.name} already has {others} students.
            </span>
          )}
        </div>
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
          {busy ? 'Saving…' : editing ? 'Save changes' : `Add ${noun}`}
        </button>
      </div>
    </form>
  )
}
