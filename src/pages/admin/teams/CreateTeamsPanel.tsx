import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import type { TeamPlan } from '../../../mocks/directory'
import type { User } from '../../../types/user'
import { DEFAULT_TEAM_SIZE, MAX_TEAM_SIZE, MIN_TEAM_SIZE, planTeams } from '../../../utils/adminTeams'
import type { Random } from '../../../utils/adminTeams'

const SIZES = Array.from({ length: MAX_TEAM_SIZE - MIN_TEAM_SIZE + 1 }, (_, i) => MIN_TEAM_SIZE + i)

/**
 * Admin: random teams. Pick how big a team may be; the students and mentors are shuffled into a
 * preview. Shuffle again as often as you like; nothing is created until you confirm.
 * `replacing`: there are teams already, and these would replace all of them, so a tick is needed.
 */
export function CreateTeamsPanel({
  students,
  mentors,
  replacing,
  onCreate,
  random = Math.random,
}: {
  students: User[]
  mentors: User[]
  /** How many teams exist now (they would all be replaced), or 0 when there are none. */
  replacing: number
  onCreate: (plan: TeamPlan[]) => Promise<void>
  random?: Random
}) {
  const [size, setSize] = useState(DEFAULT_TEAM_SIZE)
  const make = (max: number) =>
    planTeams(
      students.map((s) => s.id),
      mentors.map((m) => m.id),
      max,
      random,
    )
  const [plan, setPlan] = useState(() => make(DEFAULT_TEAM_SIZE))
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nameOf = new Map([...students, ...mentors].map((u) => [u.id, u.name]))
  const withoutMentor = plan.filter((t) => t.mentorId === null).length
  const idle = mentors.length - plan.filter((t) => t.mentorId !== null).length
  const ready = plan.length > 0 && (replacing === 0 || sure)

  async function create() {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      await onCreate(plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The teams could not be created.')
      setBusy(false)
    }
  }

  if (students.length === 0) return <p className="admin-empty">There are no students to put in teams yet. Add students first.</p>

  return (
    <div className="admin-maker">
      <div className="admin-toolbar">
        <label className="admin-inline-field">
          <span>Students per team</span>
          <select
            className="admin-field__input"
            value={size}
            aria-label="Most students in a team"
            onChange={(e) => {
              const next = Number(e.target.value)
              setSize(next)
              setPlan(make(next))
            }}
          >
            {SIZES.map((n) => (
              <option key={n} value={n}>
                Up to {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="admin-btn" onClick={() => setPlan(make(size))} disabled={busy}>
          <Icon name="reset" size={16} /> Shuffle again
        </button>
      </div>

      <p className="admin-muted" aria-live="polite">
        {students.length} {students.length === 1 ? 'student' : 'students'} → {plan.length} {plan.length === 1 ? 'team' : 'teams'}{' '}
        of {[...new Set(plan.map((t) => t.studentIds.length))].sort((a, b) => b - a).join(' or ')}.{' '}
        {mentors.length === 0
          ? 'There are no mentors yet, so the teams start without one.'
          : withoutMentor > 0
            ? `${mentors.length} ${mentors.length === 1 ? 'mentor' : 'mentors'} for ${plan.length} teams: ${withoutMentor} ${withoutMentor === 1 ? 'team has' : 'teams have'} no mentor.`
            : idle > 0
              ? `Every team gets a mentor; ${idle} ${idle === 1 ? 'mentor stays' : 'mentors stay'} without a team.`
              : 'Every team gets a mentor.'}
      </p>

      <ul className="admin-maker__teams" aria-label="Preview">
        {plan.map((team, i) => (
          <li key={i} className="admin-maker__team">
            <p className="admin-maker__name">
              Team {i + 1} <span className="admin-table__sub">{team.studentIds.length} students</span>
            </p>
            <p className="admin-maker__mentor">{team.mentorId !== null ? `Mentor: ${nameOf.get(team.mentorId)}` : 'No mentor'}</p>
            <p className="admin-maker__students">{team.studentIds.map((id) => nameOf.get(id)).join(', ')}</p>
          </li>
        ))}
      </ul>

      {replacing > 0 && (
        <label className="admin-check admin-note admin-maker__sure">
          <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
          <span>This replaces all {replacing} teams. Everyone’s current team and mentor are forgotten. I understand.</span>
        </label>
      )}

      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn admin-btn--primary" onClick={create} disabled={!ready || busy}>
          {busy ? 'Creating…' : replacing > 0 ? 'Replace teams' : 'Create these teams'}
        </button>
      </div>
    </div>
  )
}
