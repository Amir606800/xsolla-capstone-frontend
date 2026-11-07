import { useMemo, useState } from 'react'
import { hasBackend } from '../../../api/http'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useCourses } from '../../../hooks/useCourses'
import { useDirectory } from '../../../hooks/useDirectory'
import { useSort } from '../../../hooks/useSort'
import type { SchoolUser } from '../../../types/admin'
import { matchesQuery } from '../../../utils/adminPeople'
import { roleBadges } from '../../../utils/adminRoles'
import { canMentor, hasRole } from '../../../utils/roles'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableTh } from '../SortableTh'
import { AssignWeeksForm } from './AssignWeeksForm'
import { StudentForm } from './StudentForm'

type Show = 'all' | 'only' | 'temporary'
type Action = { kind: 'add' } | { kind: 'edit' | 'weeks' | 'delete'; person: SchoolUser }

/**
 * Admin: everyone who is a lecturer now, and the weeks they teach. Add a lecturer (with a password),
 * correct their details, give them weeks, or delete an account. A lecturer is only a lecturer: roles are
 * not changed here. (A mentor who lectures for a while is listed too; their roles are on the Mentors page.)
 */
export default function AdminLecturersPage() {
  const { status, users, teams, reload, addLecturer, editMentor, removeAccount } = useDirectory()
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
    return (id: number | undefined) => (id === undefined ? 'Unknown' : (names.get(id) ?? `User #${id}`))
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
                      <td className="admin-table__strong">{l.name}</td>
                      <td>
                        <a className="admin-link" href={`mailto:${l.email}`}>
                          {l.email}
                        </a>
                      </td>
                      <td className="admin-table__muted" title={weeksText(l.id)}>
                        {modulesLine(l.id)}
                        {weeksOf(l.id).length > 0 && <span className="admin-table__sub">{weeksText(l.id)}</span>}
                      </td>
                      <td>
                        <span className="admin-roles-cell">
                          {roleBadges(l, today).map((b) => (
                            <span
                              key={b.role}
                              className={`admin-pill admin-pill--role${b.endingSoon ? ' admin-pill--hidden' : ''}`}
                              title={b.detail}
                            >
                              {b.label}
                              {b.detail && <span className="admin-pill__detail"> {b.detail}</span>}
                            </span>
                          ))}
                        </span>
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
            onSave={async (ids) => {
              for (const id of ids) await courses.assignLecturer(id, target.id)
              done(
                `${target.name} now teaches ${ids.length === 1 ? 'week' : 'weeks'} ${courses.modules
                  .filter((m) => ids.includes(m.id))
                  .map((m) => m.position)
                  .sort((a, b) => a - b)
                  .join(', ')}.`,
              )
            }}
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
