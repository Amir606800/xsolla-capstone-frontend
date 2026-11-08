import { useMemo, useState } from 'react'
import { hasBackend } from '../../../api/http'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useDirectory } from '../../../hooks/useDirectory'
import { useSort } from '../../../hooks/useSort'
import type { SchoolUser } from '../../../types/admin'
import { inTeamFilter, matchesQuery, teamByStudent } from '../../../utils/adminPeople'
import type { TeamFilter } from '../../../utils/adminPeople'
import { formatShortDate } from '../../../utils/date'
import { isStudent } from '../../../utils/roles'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableTh } from '../SortableTh'
import { ResetPasswordForm } from './ResetPasswordForm'
import { StudentForm } from './StudentForm'

/** Who the list shows: students at the school now, those who left, or both. */
type Status = 'current' | 'left' | 'all'
type Action = { kind: 'add' } | { kind: 'edit' | 'password' | 'leave' | 'return' | 'delete'; student: SchoolUser }

/**
 * Admin: every student, their team and mentor. Search, filter by team and status; add a student,
 * correct their details or team, mark them as left the school (account and work kept, can be undone),
 * or delete an account made by mistake.
 */
export default function AdminStudentsPage() {
  const { status, users, teams, reload, addStudent, editStudent, markLeft, removeStudent, setNewPassword } = useDirectory()
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState<TeamFilter>('all')
  const [state, setState] = useState<Status>('current')
  const [action, setAction] = useState<Action | null>(null)
  const [message, setMessage] = useState('')

  const students = useMemo(() => users.filter(isStudent), [users])
  const current = students.filter((s) => !s.leftAt)
  const left = students.filter((s) => s.leftAt)
  const byStudent = useMemo(() => teamByStudent(teams), [teams])
  const nameOf = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])
  const pool = state === 'current' ? current : state === 'left' ? left : students
  const filtered = pool.filter((s) => matchesQuery(s, query) && inTeamFilter(s.id, team, byStudent))
  const mentorName = (s: SchoolUser) => {
    const id = byStudent.get(s.id)?.mentorId
    return id != null ? nameOf.get(id) : undefined
  }
  const { sorted: shown, sort, toggle } = useSort(
    filtered,
    {
      name: (s) => s.name,
      email: (s) => s.email,
      team: (s) => (s.leftAt ? undefined : byStudent.get(s.id)?.name),
      mentor: mentorName,
    },
    { key: 'name', dir: 'asc' },
  )
  const outside = current.filter((s) => !byStudent.has(s.id)).length

  const open = (a: Action) => {
    setMessage('')
    setAction(a)
  }
  const close = () => setAction(null)
  const done = (text: string) => {
    close()
    setMessage(text)
  }
  const target = action && 'student' in action ? action.student : undefined
  const teamName = (id: string | null | undefined) => teams.find((t) => t.id === id)?.name

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">Every student account, with their team and mentor.</p>
        </div>
        <button type="button" className="admin-btn admin-btn--primary" onClick={() => open({ kind: 'add' })}>
          <Icon name="plus" size={16} /> Add student
        </button>
      </header>

      <p className="admin-status" role="status">
        {message}
      </p>

      {status === 'loading' && (
        <p className="admin-muted" role="status">
          Loading the students…
        </p>
      )}
      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The student list could not be loaded.</p>
          {hasBackend() && <p className="admin-muted">The server does not list accounts yet (GET /users). Adding a student still works.</p>}
          <button type="button" className="admin-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Icon name="search" size={16} />
              <input type="search" placeholder="Search by name or email" aria-label="Search students" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="admin-inline-field">
              <span>Team</span>
              <select className="admin-field__input" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Filter by team">
                <option value="all">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                <option value="none">No team ({outside})</option>
              </select>
            </label>
            <div className="admin-segmented" role="group" aria-label="Status">
              {(
                [
                  ['current', 'At school', current.length],
                  ['left', 'Left the school', left.length],
                  ['all', 'All', students.length],
                ] as const
              ).map(([value, label, n]) => (
                <button key={value} type="button" aria-pressed={state === value} onClick={() => setState(value)}>
                  {label} <span className="admin-segmented__count">{n}</span>
                </button>
              ))}
            </div>
            <p className="admin-muted admin-count" aria-live="polite">
              {shown.length === pool.length ? `${pool.length} students` : `${shown.length} of ${pool.length} students`}
            </p>
          </div>

          {shown.length === 0 ? (
            <p className="admin-empty">
              {pool.length === 0 ? (state === 'left' ? 'Nobody has left the school.' : 'There are no students yet.') : 'No students match.'}
            </p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Students</caption>
                <thead>
                  <tr>
                    <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggle} />
                    <SortableTh label="Email" sortKey="email" sort={sort} onSort={toggle} />
                    <SortableTh label="Team" sortKey="team" sort={sort} onSort={toggle} />
                    <SortableTh label="Mentor" sortKey="mentor" sort={sort} onSort={toggle} />
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => {
                    const t = byStudent.get(s.id)
                    return (
                      <tr key={s.id} className={s.leftAt ? 'is-left' : undefined}>
                        <td className="admin-table__strong">{s.name}</td>
                        <td>
                          <a className="admin-link" href={`mailto:${s.email}`}>
                            {s.email}
                          </a>
                        </td>
                        <td>
                          {s.leftAt ? (
                            <span className="admin-pill">Left {formatShortDate(s.leftAt)}</span>
                          ) : t ? (
                            t.name
                          ) : (
                            <span className="admin-pill admin-pill--hidden">No team</span>
                          )}
                        </td>
                        <td className="admin-table__muted">{t?.mentorId != null ? nameOf.get(t.mentorId) ?? `User #${t.mentorId}` : '—'}</td>
                        <td>
                          <div className="admin-actions">
                            {s.leftAt ? (
                              <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'return', student: s })} aria-label={`Bring back ${s.name}`} title="Bring back">
                                <Icon name="reset" size={16} />
                              </button>
                            ) : (
                              <>
                                <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'edit', student: s })} aria-label={`Edit ${s.name}`} title="Edit">
                                  <Icon name="edit" size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="admin-icon-btn"
                                  onClick={() => open({ kind: 'password', student: s })}
                                  aria-label={`Reset the password of ${s.name}`}
                                  title="Reset password"
                                >
                                  <Icon name="key" size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="admin-icon-btn"
                                  onClick={() => open({ kind: 'leave', student: s })}
                                  aria-label={`${s.name} left the school`}
                                  title="Left the school"
                                >
                                  <Icon name="logout" size={16} />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="admin-icon-btn admin-icon-btn--danger"
                              onClick={() => open({ kind: 'delete', student: s })}
                              aria-label={`Delete ${s.name}`}
                              title="Delete account"
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* add / edit */}
      <Modal open={action?.kind === 'add' || action?.kind === 'edit'} onClose={close} title={target ? `Edit ${target.name}` : 'Add a student'} initialFocus=".admin-dialog input">
        {(action?.kind === 'add' || action?.kind === 'edit') && (
          <StudentForm
            student={target}
            teamOf={target ? (byStudent.get(target.id)?.id ?? null) : undefined}
            users={users}
            teams={teams}
            onCancel={close}
            onSave={async (input) => {
              if (target) {
                await editStudent(target.id, { name: input.name, email: input.email, teamId: input.teamId })
                done(`${input.name}: changes saved.`)
                return
              }
              const user = await addStudent(input)
              setQuery('')
              setTeam('all')
              setState('current')
              const name = teamName(input.teamId)
              done(`${user.name} added${name ? ` to ${name}` : ''}. They can sign in with ${user.email} and the password you set.`)
            }}
          />
        )}
      </Modal>

      <Modal open={action?.kind === 'password'} onClose={close} title={target ? `Reset ${target.name}’s password` : ''} size="sm" initialFocus=".admin-dialog input">
        {action?.kind === 'password' && target && (
          <ResetPasswordForm
            user={target}
            onSave={(password) => setNewPassword(target.id, password)}
            onDone={(saved) => (saved ? done(`${target.name} has a new password.`) : close())}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={action?.kind === 'leave'}
        title={target ? `${target.name} left the school?` : ''}
        confirmLabel="Mark as left"
        busyLabel="Saving…"
        tone="primary"
        onClose={close}
        onConfirm={async () => {
          if (!target) return
          await markLeft(target.id, true)
          done(`${target.name} is marked as left the school.`)
        }}
      >
        {target && (
          <p>
            They can no longer sign in
            {byStudent.get(target.id) ? ` and are taken out of ${byStudent.get(target.id)!.name}` : ''}. Their account, handed-in work and grades are kept,
            and you can bring them back later.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === 'return'}
        title={target ? `Bring back ${target.name}?` : ''}
        confirmLabel="Bring back"
        busyLabel="Saving…"
        tone="primary"
        onClose={close}
        onConfirm={async () => {
          if (!target) return
          await markLeft(target.id, false)
          setState('current')
          done(`${target.name} is back. Put them in a team with Edit.`)
        }}
      >
        <p>They can sign in again. They come back without a team.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === 'delete'}
        title={target ? `Delete ${target.name}’s account?` : ''}
        confirmLabel="Delete account"
        onClose={close}
        onConfirm={async () => {
          if (!target) return
          await removeStudent(target.id)
          done(`${target.name}’s account deleted.`)
        }}
      >
        <p>
          The account is removed for good. Use this for an account made by mistake.
          {target && !target.leftAt ? ' If the student left the school, mark them as left instead: their work is kept.' : ''}
        </p>
      </ConfirmDialog>
    </section>
  )
}
