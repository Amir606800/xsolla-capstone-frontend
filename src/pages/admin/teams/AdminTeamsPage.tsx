import { useMemo, useState } from 'react'
import { hasBackend } from '../../../api/http'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useDirectory } from '../../../hooks/useDirectory'
import type { TeamPlan } from '../../../mocks/directory'
import type { SchoolTeam, SchoolUser } from '../../../types/admin'
import { TEAM_LIMIT } from '../../../utils/adminPeople'
import { canMentor, isStudent } from '../../../utils/roles'
import { ConfirmDialog } from '../ConfirmDialog'
import { AddTeamForm } from './AddTeamForm'
import { CreateTeamsPanel } from './CreateTeamsPanel'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Admin: every team with its mentor and students. Add one team or delete one, move a student to another
 * team, take them out of their team, put a student without a team into one, or change a team's mentor.
 * Creating random teams is the big action: with no teams yet it is the only thing on the page, and later
 * it asks for a tick because it replaces every team.
 */
export default function AdminTeamsPage() {
  const { status, users, teams, reload, createTeams, addTeam, deleteTeam, clearTeams, putStudentInTeam, setMentorOf } = useDirectory()
  const [rebuilding, setRebuilding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<SchoolTeam | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const students = useMemo(() => users.filter((u) => isStudent(u) && !u.leftAt), [users])
  const mentors = useMemo(() => users.filter((u) => canMentor(u) && !u.leftAt), [users])
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const placed = useMemo(() => new Set(teams.flatMap((t) => t.studentIds)), [teams])
  const loose = students.filter((s) => !placed.has(s.id))
  const teamOfMentor = useMemo(
    () => new Map(teams.filter((t) => t.mentorId !== null).map((t) => [t.mentorId as number, t])),
    [teams],
  )
  const nameOf = (id: number) => byId.get(id)?.name ?? `User #${id}`

  /** Runs a change; shows what happened, or why it failed. */
  async function run(change: () => Promise<void>, done: string) {
    setMessage('')
    setError('')
    try {
      await change()
      setMessage(done)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved.')
    }
  }

  const move = (student: SchoolUser, team: SchoolTeam | undefined, to: string) => {
    const target = to === 'none' ? null : teams.find((t) => t.id === to)!
    const count = target ? target.studentIds.length + 1 : 0
    return run(
      () => putStudentInTeam(student.id, target?.id ?? null),
      target
        ? `${student.name} moved ${team ? `from ${team.name} ` : ''}to ${target.name}.${count > TEAM_LIMIT ? ` ${target.name} now has ${count} students.` : ''}`
        : `${student.name} is out of ${team?.name ?? 'their team'}.`,
    )
  }

  const create = async (plan: TeamPlan[]) => {
    await createTeams(plan)
    setRebuilding(false)
    setError('')
    setMessage(`${plural(plan.length, 'team')} created.`)
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">Teams, their mentors and students.</p>
        </div>
        {status === 'ready' && teams.length > 0 && (
          <div className="admin-actions">
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => (setMessage(''), setAdding(true))}>
              <Icon name="plus" size={16} /> Add team
            </button>
            <button type="button" className="admin-btn" onClick={() => setRebuilding(true)}>
              <Icon name="reset" size={16} /> Create random teams…
            </button>
            <button type="button" className="admin-btn admin-btn--danger-outline" onClick={() => setClearing(true)}>
              <Icon name="trash" size={16} /> Remove all teams…
            </button>
          </div>
        )}
      </header>

      <p className="admin-status" role="status">
        {message}
      </p>
      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}

      {status === 'loading' && (
        <p className="admin-muted" role="status">
          Loading the teams…
        </p>
      )}
      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The teams could not be loaded.</p>
          {hasBackend() && <p className="admin-muted">The server does not list accounts yet (GET /users).</p>}
          <button type="button" className="admin-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {/* no teams yet: making them is all there is to do */}
      {status === 'ready' && teams.length === 0 && (
        <section className="admin-panel" aria-labelledby="teams-none">
          <h2 id="teams-none" className="admin-section-title">
            There are no teams yet
          </h2>
          <p className="admin-muted">
            Make them at random: the students and mentors are shuffled, and you see the result before anything is created.
          </p>
          <CreateTeamsPanel students={students} mentors={mentors} replacing={0} onCreate={create} />
        </section>
      )}

      {status === 'ready' && teams.length > 0 && (
        <>
          <p className="admin-muted">
            {plural(teams.length, 'team')} · {plural(students.length, 'student')}
            {loose.length > 0 ? ` · ${loose.length} without a team` : ''}
          </p>

          <div className="admin-teams">
            {teams.map((team) => {
              const members = team.studentIds.map((id) => byId.get(id)).filter((u): u is SchoolUser => !!u)
              const over = members.length > TEAM_LIMIT
              return (
                <section key={team.id} className="admin-team" aria-label={team.name}>
                  <header className="admin-team__head">
                    <h2>{team.name}</h2>
                    <span className="admin-team__tools">
                      <span className={`admin-pill${over ? ' admin-pill--hidden' : ''}`}>{plural(members.length, 'student')}</span>
                      <button
                        type="button"
                        className="admin-icon-btn admin-icon-btn--danger"
                        onClick={() => (setMessage(''), setDeleting(team))}
                        aria-label={`Delete ${team.name}`}
                        title="Delete team"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </span>
                  </header>

                  <label className="admin-team__mentor">
                    <span>Mentor</span>
                    <select
                      className="admin-field__input"
                      aria-label={`Mentor of ${team.name}`}
                      value={team.mentorId ?? ''}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null
                        const old = id !== null ? teamOfMentor.get(id) : undefined
                        void run(
                          () => setMentorOf(team.id, id),
                          id === null
                            ? `${team.name} has no mentor now.`
                            : `${nameOf(id)} now mentors ${team.name}.${old && old.id !== team.id ? ` ${old.name} has no mentor now.` : ''}`,
                        )
                      }}
                    >
                      <option value="">No mentor</option>
                      {mentors.map((m) => {
                        const leads = teamOfMentor.get(m.id)
                        return (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {leads && leads.id !== team.id ? ` (now ${leads.name})` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  {members.length === 0 ? (
                    <p className="admin-muted admin-team__empty">No students yet.</p>
                  ) : (
                    <ul className="admin-team__students">
                      {members.map((s) => (
                        <li key={s.id}>
                          <span className="admin-team__name" title={s.name}>
                            {s.name}
                          </span>
                          <select
                            className="admin-field__input admin-team__move"
                            aria-label={`Move ${s.name} to another team`}
                            value=""
                            onChange={(e) => void move(s, team, e.target.value)}
                          >
                            <option value="" disabled>
                              Move to…
                            </option>
                            {teams
                              .filter((t) => t.id !== team.id)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            <option value="none">Take out of {team.name}</option>
                          </select>
                        </li>
                      ))}
                    </ul>
                  )}

                  {loose.length > 0 && (
                    <select
                      className="admin-field__input admin-team__add"
                      aria-label={`Add a student to ${team.name}`}
                      value=""
                      onChange={(e) => {
                        const s = byId.get(Number(e.target.value))
                        if (s) void move(s as SchoolUser, undefined, team.id)
                      }}
                    >
                      <option value="" disabled>
                        Add a student…
                      </option>
                      {loose.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </section>
              )
            })}

            {loose.length > 0 && (
              <section className="admin-team admin-team--loose" aria-label="Students without a team">
                <header className="admin-team__head">
                  <h2>Without a team</h2>
                  <span className="admin-pill admin-pill--hidden">{plural(loose.length, 'student')}</span>
                </header>
                <ul className="admin-team__students">
                  {loose.map((s) => (
                    <li key={s.id}>
                      <span className="admin-team__name" title={s.name}>
                            {s.name}
                          </span>
                      <select
                        className="admin-field__input admin-team__move"
                        aria-label={`Put ${s.name} in a team`}
                        value=""
                        onChange={(e) => void move(s, undefined, e.target.value)}
                      >
                        <option value="" disabled>
                          Put in…
                        </option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}

      <Modal open={rebuilding} onClose={() => setRebuilding(false)} title="Create random teams" size="lg">
        {rebuilding && (
          <div className="admin-dialog">
            <CreateTeamsPanel students={students} mentors={mentors} replacing={teams.length} onCreate={create} />
          </div>
        )}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a team" initialFocus=".admin-dialog input">
        {adding && (
          <AddTeamForm
            teams={teams}
            mentors={mentors}
            loose={loose}
            onCancel={() => setAdding(false)}
            onSave={async (input) => {
              const old = input.mentorId !== null ? teamOfMentor.get(input.mentorId) : undefined
              const made = await addTeam(input)
              setAdding(false)
              setError('')
              const parts = [
                input.mentorId !== null ? `mentor ${nameOf(input.mentorId)}` : 'no mentor yet',
                input.studentIds.length ? plural(input.studentIds.length, 'student') : 'no students yet',
              ]
              setMessage(`${made.name} added: ${parts.join(', ')}.${old ? ` ${old.name} has no mentor now.` : ''}`)
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : ''}
        confirmLabel="Delete team"
        busyLabel="Deleting…"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteTeam(deleting.id)
          const left = deleting.studentIds.length
          setDeleting(null)
          setError('')
          setMessage(`${deleting.name} deleted.${left ? ` ${plural(left, 'student')} ${left === 1 ? 'is' : 'are'} without a team now.` : ''}`)
        }}
      >
        {deleting && (
          <p>
            {deleting.studentIds.length
              ? `Its ${plural(deleting.studentIds.length, 'student')} will be without a team until you put them in another one.`
              : 'It has no students.'}
            {deleting.mentorId !== null ? ` ${nameOf(deleting.mentorId)} will have no team to mentor.` : ''} Accounts and work are kept.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={clearing}
        title="Remove all teams?"
        confirmLabel="Remove all teams"
        busyLabel="Removing…"
        onClose={() => setClearing(false)}
        onConfirm={async () => {
          await clearTeams()
          setClearing(false)
          setMessage('All teams removed.')
        }}
      >
        <p>
          All {teams.length} teams are deleted. Students and mentors keep their accounts but have no team until you make new ones.
        </p>
      </ConfirmDialog>
    </section>
  )
}
