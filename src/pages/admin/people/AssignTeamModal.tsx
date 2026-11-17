import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../../components/Modal'
import type { SchoolTeam, SchoolUser } from '../../../types/admin'

/** Teams with no mentor first: they are the ones that need one. */
const byNeed = (a: SchoolTeam, b: SchoolTeam) =>
  Number(a.mentorId !== null) - Number(b.mentorId !== null) || a.name.localeCompare(b.name, undefined, { numeric: true })

/** The value of the "no team" choice (a team's id is never this). */
const NONE = '__none'

function TeamChoice({
  person,
  teams,
  current,
  nameOf,
  onSave,
  onCancel,
}: {
  person: SchoolUser
  teams: SchoolTeam[]
  current: SchoolTeam | undefined
  nameOf: (id: number) => string
  onSave: (team: SchoolTeam | null) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const sorted = [...teams].sort(byNeed)
  // their own team stays chosen; a mentor with none starts on the first team that needs one
  const [chosen, setChosen] = useState(current?.id ?? sorted.find((t) => t.mentorId === null)?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const team = teams.find((t) => t.id === chosen)
  const replaced = team && team.mentorId !== null && team.mentorId !== person.id ? team.mentorId : null
  const free = teams.filter((t) => t.mentorId === null).length
  const unchanged = chosen === '' || chosen === (current?.id ?? NONE)
  const first = person.name.split(' ')[0]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (unchanged || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(team ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The team could not be saved.')
      setBusy(false)
    }
  }

  return (
    <form className="admin-dialog" onSubmit={submit} aria-label="Team">
      <fieldset className="admin-roles admin-weeks">
        <legend className="admin-field__label">Team they mentor</legend>
        <p className="admin-hint">
          {free === 0
            ? 'Every team has a mentor. Choosing another one replaces its mentor.'
            : `${free} ${free === 1 ? 'team has' : 'teams have'} no mentor.`}
        </p>
        {sorted.map((t) => (
          <label key={t.id} className="admin-check">
            <input type="radio" name={`${id}-team`} checked={chosen === t.id} onChange={() => setChosen(t.id)} />
            <span>
              {t.name} · {t.studentIds.length} {t.studentIds.length === 1 ? 'student' : 'students'}
              <span className="admin-hint">
                {t.id === current?.id ? `${first} mentors it now` : t.mentorId === null ? 'No mentor yet' : `Mentor: ${nameOf(t.mentorId)}`}
              </span>
            </span>
          </label>
        ))}
        {current && (
          <label className="admin-check">
            <input type="radio" name={`${id}-team`} checked={chosen === NONE} onChange={() => setChosen(NONE)} />
            <span>
              No team
              <span className="admin-hint">{current.name} will have no mentor.</span>
            </span>
          </label>
        )}
      </fieldset>
      {replaced !== null && team && (
        <p className="admin-hint admin-hint--warn">
          {nameOf(replaced)} mentors {team.name} now. They will have no team.
        </p>
      )}
      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          {current ? 'Cancel' : 'Not now'}
        </button>
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || unchanged}>
          {busy ? 'Saving…' : chosen === NONE ? 'Leave without a team' : `Give ${first} this team`}
        </button>
      </div>
    </form>
  )
}

/**
 * Admin: the team a mentor looks after. From the Mentors page (the team icon) and from the Lecturers page right after a
 * lecturer was given the mentor role. `onDone` gets the sentence to show on the page.
 */
export function AssignTeamModal({
  person,
  teams,
  nameOf,
  assign,
  onClose,
  onDone,
}: {
  /** Whose team; the dialog is closed when there is nobody. */
  person: SchoolUser | undefined
  teams: SchoolTeam[]
  nameOf: (id: number) => string
  /** Puts them in charge of this team, or of none (null). */
  assign: (teamId: string | null) => Promise<void>
  onClose: () => void
  onDone: (text: string) => void
}) {
  const current = person ? teams.find((t) => t.mentorId === person.id) : undefined
  return (
    <Modal open={!!person} onClose={onClose} title={person ? `Team of ${person.name}` : ''} initialFocus=".admin-dialog input:checked">
      {person && (
        <TeamChoice
          person={person}
          teams={teams}
          current={current}
          nameOf={nameOf}
          onCancel={onClose}
          onSave={async (team) => {
            const old = team && team.mentorId !== person.id ? team.mentorId : null
            await assign(team?.id ?? null)
            onDone(
              team
                ? `${person.name} now mentors ${team.name}.${old !== null ? ` ${nameOf(old)} has no team now.` : ''}`
                : `${person.name} has no team now.`,
            )
          }}
        />
      )}
    </Modal>
  )
}
