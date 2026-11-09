import { useMemo, useState } from 'react'
import { hasBackend } from '../../../api/http'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useCourses } from '../../../hooks/useCourses'
import { useDirectory } from '../../../hooks/useDirectory'
import { useSort } from '../../../hooks/useSort'
import type { SchoolUser } from '../../../types/admin'
import { matchesQuery } from '../../../utils/adminPeople'
import { isStaffRole, mainRoleOf, roleBadges, rolesSummary } from '../../../utils/adminRoles'
import { canMentor, hasRole } from '../../../utils/roles'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableTh } from '../SortableTh'
import { AssignWeeksForm } from './AssignWeeksForm'
import { ResetPasswordForm } from './ResetPasswordForm'
import { RolePills } from './RolePills'
import { RolesForm } from './RolesForm'
import { StudentForm } from './StudentForm'

type Show = 'all' | 'only' | 'temporary'
type Action = { kind: 'add' } | { kind: 'edit' | 'weeks' | 'roles' | 'password' | 'delete'; person: SchoolUser }

/** The role the account was created with: lecturer, or mentor for a mentor who also lectures. */
const mainOf = (u: SchoolUser) => {
  const main = mainRoleOf(u)
  return isStaffRole(main) ? main : 'lecturer'
}

/**
 * Admin: everyone who is a lecturer now, and the weeks they teach. Add a lecturer (with a password),
 * correct their details, give them weeks, give or take the extra mentor role (the lecturer role they
 * were created with stays), reset a password, or delete an account. Mentors who were given the lecturer
 * role are listed too.
 */
export default function AdminLecturersPage() {
  const { status, users, teams, reload, addLecturer, editMentor, changeRoles, setNewPassword, removeAccount } = useDirectory()
  const courses = useCourses()
  const [today] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<Show>('all')
  const [action, setAction] = useState<Action | null>(null)
  const [message, setMessage] = useState('')

  const lecturers = useMemo(() => users.filter((u) => hasRole(u, 'lecturer') && !u.leftAt), [users])
  const modulesBy = useMemo(() => {
    const map = new Map<number, number>()
    for (const m of courses.modules) if (m.createdBy !== undefined) map.set(m.createdBy, (map.get(m.createdBy) ?? 0) + 1)
    return map
  }, [courses.modules])
  const weeksOf = (id: number) =>
    courses.modules
      .filter((m) => m.createdBy === id)
      .map((m) => m.position)
      .sort((a, b) => a - b)
  const nameOf = useMemo(() => {
    const names = new Map(users.map((u) => [u.id, u.name]))
    return (id: number | undefined) => (id === undefined ? 'No lecturer' : (names.get(id) ?? `User #${id}`))
  }, [users])
  const teamOf = useMemo(() => new Map(teams.filter((t) => t.mentorId !== null).map((t) => [t.mentorId as number, t])), [teams])
  const alsoMentors = lecturers.filter(canMentor)
  const temporary = lecturers.filter((l) => l.roleUntil?.lecturer)
  const only = lecturers.filter((l) => !canMentor(l))
  const pool = show === 'only' ? only : show === 'temporary' ? temporary : lecturers

  const {
    sorted: shown,
    sort,
    toggle,
  } = useSort(
    pool.filter((l) => matchesQuery(l, query)),
    {
      name: (l) => l.name,
      email: (l) => l.email,
      modules: (l) => modulesBy.get(l.id) ?? 0,
      roles: (l) =>
        roleBadges(l, today)
          .map((b) => b.label)
          .join(', '),
    },
    { key: 'name', dir: 'asc' },
  )

  const open = (a: Action) => {
    setMessage('')
    setAction(a)
  }
  const close = () => setAction(null)
  const done = (text: string) => {
    close()
    setMessage(text)
  }
  const target = action && 'person' in action ? action.person : undefined
  const modulesLine = (id: number) => {
    const n = modulesBy.get(id) ?? 0
    return n === 0 ? '—' : `${n} ${n === 1 ? 'module' : 'modules'}`
  }
  const weekNumbers = (ids: string[]) =>
    courses.modules
      .filter((m) => ids.includes(m.id))
      .map((m) => m.position)
      .sort((a, b) => a - b)
      .join(', ')
  const weeksText = (id: number) => {
    const w = weeksOf(id)
    return w.length ? `Week${w.length === 1 ? '' : 's'} ${w.join(', ')}` : 'No weeks yet'
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Lecturers</h1>
          <p className="page-subtitle">Everyone who writes the course: their modules and roles.</p>
        </div>
        <button type="button" className="admin-btn admin-btn--primary" onClick={() => open({ kind: 'add' })}>
          <Icon name="plus" size={16} /> Add lecturer
        </button>
      </header>

      <p className="admin-status" role="status">
        {message}
      </p>

      {status === 'loading' && (
        <p className="admin-muted" role="status">
          Loading the lecturers…
        </p>
      )}
      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The lecturer list could not be loaded.</p>
          {hasBackend() && <p className="admin-muted">The server does not list accounts yet (GET /users).</p>}
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
              <input
                type="search"
                placeholder="Search by name or email"
                aria-label="Search lecturers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="admin-segmented" role="group" aria-label="Show">
              {(
                [
                  ['all', 'All', lecturers.length],
                  ['only', 'Lecturers only', only.length],
                  ['temporary', 'For a while', temporary.length],
                ] as const
              ).map(([value, label, n]) => (
                <button key={value} type="button" aria-pressed={show === value} onClick={() => setShow(value)}>
                  {label} <span className="admin-segmented__count">{n}</span>
                </button>
              ))}
            </div>
            <p className="admin-muted admin-count" aria-live="polite">
              {shown.length === lecturers.length
                ? `${lecturers.length} lecturers`
                : `${shown.length} of ${lecturers.length} lecturers`}
              {alsoMentors.length > 0 && show === 'all' && !query ? ` · ${alsoMentors.length} also mentor` : ''}
            </p>
          </div>

          {shown.length === 0 ? (
            <p className="admin-empty">{lecturers.length === 0 ? 'There are no lecturers yet.' : 'No lecturers match.'}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Lecturers</caption>
                <thead>
                  <tr>
                    <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggle} />
                    <SortableTh label="Email" sortKey="email" sort={sort} onSort={toggle} />
                    <SortableTh label="Modules" sortKey="modules" sort={sort} onSort={toggle} />
                    <SortableTh label="Roles" sortKey="roles" sort={sort} onSort={toggle} />
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id}>
                      <td className="admin-table__strong">
                          <span className="admin-cell" title={l.name}>
                            {l.name}
                          </span>
                        </td>
                      <td>
                        <a className="admin-link admin-cell" href={`mailto:${l.email}`} title={l.email}>
                            {l.email}
                          </a>
                      </td>
                      <td className="admin-table__muted" title={weeksText(l.id)}>
                        {modulesLine(l.id)}
                        {weeksOf(l.id).length > 0 && <span className="admin-table__sub">{weeksText(l.id)}</span>}
                      </td>
                      <td>
                        <RolePills user={l} now={today} />
                      </td>
                      <td>
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => open({ kind: 'edit', person: l })}
                            aria-label={`Edit ${l.name}`}
                            title="Edit"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => open({ kind: 'weeks', person: l })}
                            aria-label={`Assign weeks to ${l.name}`}
                            title="Assign weeks"
                          >
                            <Icon name="calendar" size={16} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => open({ kind: 'roles', person: l })}
                            aria-label={`Roles of ${l.name}`}
                            title="Roles"
                          >
                            <Icon name="award" size={16} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => open({ kind: 'password', person: l })}
                            aria-label={`Reset the password of ${l.name}`}
                            title="Reset password"
                          >
                            <Icon name="key" size={16} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn admin-icon-btn--danger"
                            onClick={() => open({ kind: 'delete', person: l })}
                            aria-label={`Delete ${l.name}`}
                            title="Delete account"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* add / edit */}
      <Modal
        open={action?.kind === 'add' || action?.kind === 'edit'}
        onClose={close}
        title={target ? `Edit ${target.name}` : 'Add a lecturer'}
        initialFocus=".admin-dialog input"
      >
        {(action?.kind === 'add' || action?.kind === 'edit') && (
          <StudentForm
            variant="lecturer"
            student={target}
            users={users}
            teams={teams}
            onCancel={close}
            onSave={async (input) => {
              if (target) {
                // a lecturer's team (if they also mentor) is not changed here: that is on the Mentors page
                await editMentor(target.id, { name: input.name, email: input.email, teamId: teamOf.get(target.id)?.id ?? null })
                done(`${input.name}: changes saved.`)
                return
              }
              const user = await addLecturer(input)
              setQuery('')
              setShow('all')
              done(`${user.name} added as a lecturer. They can sign in with ${user.email} and the password you set.`)
            }}
          />
        )}
      </Modal>

      <Modal
        open={action?.kind === 'weeks'}
        onClose={close}
        title={target ? `Weeks of ${target.name}` : ''}
        initialFocus=".admin-dialog input:not(:disabled)"
      >
        {action?.kind === 'weeks' && target && (
          <AssignWeeksForm
            lecturerId={target.id}
            modules={courses.modules}
            nameOf={nameOf}
            onCancel={close}
            onSave={async ({ assign, unassign }) => {
              for (const id of unassign) await courses.assignLecturer(id, null)
              for (const id of assign) await courses.assignLecturer(id, target.id)
              const parts = [
                assign.length ? `now teaches ${assign.length === 1 ? 'week' : 'weeks'} ${weekNumbers(assign)}` : '',
                unassign.length
                  ? `${assign.length ? 'and ' : ''}is off ${unassign.length === 1 ? 'week' : 'weeks'} ${weekNumbers(unassign)}`
                  : '',
              ]
              done(`${target.name} ${parts.filter(Boolean).join(' ')}.`)
            }}
          />
        )}
      </Modal>

      <Modal open={action?.kind === 'roles'} onClose={close} title={target ? `Roles of ${target.name}` : ''} initialFocus=".admin-dialog input">
        {action?.kind === 'roles' && target && (
          <RolesForm
            user={target}
            main={mainOf(target)}
            teamName={teamOf.get(target.id)?.name}
            now={today}
            onCancel={close}
            onSave={async (roles, until, extra) => {
              await changeRoles(target.id, roles, until)
              const main = mainOf(target)
              if (main === 'mentor' && !extra.on) done(`${target.name} no longer lectures. You will find them under Mentors.`)
              else if (main === 'lecturer' && extra.on && !teamOf.get(target.id))
                done(`${target.name}: ${rolesSummary(main, extra)} Give them a team on the Mentors page.`)
              else done(`${target.name}: ${rolesSummary(main, extra)}`)
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
        open={action?.kind === 'delete'}
        title={target ? `Delete ${target.name}’s account?` : ''}
        confirmLabel="Delete account"
        onClose={close}
        onConfirm={async () => {
          if (!target) return
          await removeAccount(target.id)
          done(`${target.name}’s account deleted.`)
        }}
      >
        <p>
          The account is removed for good.
          {target && modulesBy.get(target.id) ? ` The ${modulesLine(target.id)} they wrote stay in the course.` : ''}
          {target && teamOf.get(target.id) ? ` ${teamOf.get(target.id)!.name} will have no mentor until you give it one.` : ''}
        </p>
      </ConfirmDialog>
    </section>
  )
}
