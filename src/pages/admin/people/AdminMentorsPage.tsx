import { useMemo, useState } from 'react'
import { hasBackend } from '../../../api/http'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useDirectory } from '../../../hooks/useDirectory'
import { useSort } from '../../../hooks/useSort'
import type { SchoolTeam, SchoolUser } from '../../../types/admin'
import { matchesQuery } from '../../../utils/adminPeople'
import { isStaffRole, mainRoleOf, roleBadges, rolesSummary } from '../../../utils/adminRoles'
import { canMentor } from '../../../utils/roles'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableTh } from '../SortableTh'
import { ResetPasswordForm } from './ResetPasswordForm'
import { RolePills } from './RolePills'
import { RolesForm } from './RolesForm'
import { StudentForm } from './StudentForm'

type Show = 'all' | 'lecturers' | 'no-team'
type Action = { kind: 'add' } | { kind: 'edit' | 'roles' | 'password' | 'delete'; person: SchoolUser }

/** The role the account was created with: mentor, or lecturer for a lecturer who also mentors. */
const mainOf = (u: SchoolUser) => {
  const main = mainRoleOf(u)
  return isStaffRole(main) ? main : 'mentor'
}

/**
 * Admin: every mentor, the team they look after and their roles. Add a mentor (with the mentor role,
 * a password and a team), correct their details or team, give or take the extra lecturer role (for a
 * while or for good; the mentor role they were created with stays), reset a password, or delete an account.
 * Lecturers who were given the mentor role are listed too.
 */
export default function AdminMentorsPage() {
  const { status, users, teams, reload, addMentor, editMentor, changeRoles, setNewPassword, removeAccount } = useDirectory()
  const [today] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<Show>('all')
  const [action, setAction] = useState<Action | null>(null)
  const [message, setMessage] = useState('')

  const mentors = useMemo(() => users.filter((u) => canMentor(u) && !u.leftAt), [users])
  const teamOf = useMemo(() => {
    const map = new Map<number, SchoolTeam>()
    for (const t of teams) if (t.mentorId !== null) map.set(t.mentorId, t)
    return map
  }, [teams])
  const nameOf = useMemo(() => {
    const names = new Map(users.map((u) => [u.id, u.name]))
    return (id: number) => names.get(id) ?? `User #${id}`
  }, [users])
  const lecturing = mentors.filter((m) => m.roles.includes('lecturer'))
  const noTeam = mentors.filter((m) => !teamOf.has(m.id))
  const pool = show === 'lecturers' ? lecturing : show === 'no-team' ? noTeam : mentors
  const { sorted: shown, sort, toggle } = useSort(
    pool.filter((m) => matchesQuery(m, query)),
    {
      name: (m) => m.name,
      email: (m) => m.email,
      team: (m) => teamOf.get(m.id)?.name,
      // more roles first is not useful; sort by what they hold: "Mentor" before "Mentor, Lecturer"
      roles: (m) => roleBadges(m, today).map((b) => b.label).join(', '),
    },
    { key: 'name', dir: 'asc' },
  )
  const teamsWithout = teams.filter((t) => t.mentorId === null)

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

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Mentors</h1>
          <p className="page-subtitle">Every mentor, the team they look after and their roles.</p>
        </div>
        <button type="button" className="admin-btn admin-btn--primary" onClick={() => open({ kind: 'add' })}>
          <Icon name="plus" size={16} /> Add mentor
        </button>
      </header>

      <p className="admin-status" role="status">
        {message}
      </p>

      {status === 'loading' && (
        <p className="admin-muted" role="status">
          Loading the mentors…
        </p>
      )}
      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The mentor list could not be loaded.</p>
          {hasBackend() && <p className="admin-muted">The server does not list accounts yet (GET /users).</p>}
          <button type="button" className="admin-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {teamsWithout.length > 0 && (
            <p className="admin-note" role="note">
              <Icon name="alert" size={16} /> {teamsWithout.map((t) => t.name).join(', ')} {teamsWithout.length === 1 ? 'has' : 'have'} no mentor.
            </p>
          )}

          <div className="admin-toolbar">
            <label className="admin-search">
              <Icon name="search" size={16} />
              <input type="search" placeholder="Search by name or email" aria-label="Search mentors" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="admin-segmented" role="group" aria-label="Show">
              {(
                [
                  ['all', 'All', mentors.length],
                  ['lecturers', 'Also lecturers', lecturing.length],
                  ['no-team', 'Without a team', noTeam.length],
                ] as const
              ).map(([value, label, n]) => (
                <button key={value} type="button" aria-pressed={show === value} onClick={() => setShow(value)}>
                  {label} <span className="admin-segmented__count">{n}</span>
                </button>
              ))}
            </div>
            <p className="admin-muted admin-count" aria-live="polite">
              {shown.length === mentors.length ? `${mentors.length} mentors` : `${shown.length} of ${mentors.length} mentors`}
            </p>
          </div>

          {shown.length === 0 ? (
            <p className="admin-empty">{mentors.length === 0 ? 'There are no mentors yet.' : 'No mentors match.'}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Mentors</caption>
                <thead>
                  <tr>
                    <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggle} />
                    <SortableTh label="Email" sortKey="email" sort={sort} onSort={toggle} />
                    <SortableTh label="Team" sortKey="team" sort={sort} onSort={toggle} />
                    <SortableTh label="Roles" sortKey="roles" sort={sort} onSort={toggle} />
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const t = teamOf.get(m.id)
                    return (
                      <tr key={m.id}>
                        <td className="admin-table__strong">{m.name}</td>
                        <td>
                          <a className="admin-link" href={`mailto:${m.email}`}>
                            {m.email}
                          </a>
                        </td>
                        <td>{t ? `${t.name} · ${t.studentIds.length} students` : <span className="admin-pill admin-pill--hidden">No team</span>}</td>
                        <td>
                          <RolePills user={m} now={today} />
                        </td>
                        <td>
                          <div className="admin-actions">
                            <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'edit', person: m })} aria-label={`Edit ${m.name}`} title="Edit">
                              <Icon name="edit" size={16} />
                            </button>
                            <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'roles', person: m })} aria-label={`Roles of ${m.name}`} title="Roles">
                              <Icon name="award" size={16} />
                            </button>
                            <button
                              type="button"
                              className="admin-icon-btn"
                              onClick={() => open({ kind: 'password', person: m })}
                              aria-label={`Reset the password of ${m.name}`}
                              title="Reset password"
                            >
                              <Icon name="key" size={16} />
                            </button>
                            <button
                              type="button"
                              className="admin-icon-btn admin-icon-btn--danger"
                              onClick={() => open({ kind: 'delete', person: m })}
                              aria-label={`Delete ${m.name}`}
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
      <Modal open={action?.kind === 'add' || action?.kind === 'edit'} onClose={close} title={target ? `Edit ${target.name}` : 'Add a mentor'} initialFocus=".admin-dialog input">
        {(action?.kind === 'add' || action?.kind === 'edit') && (
          <StudentForm
            variant="mentor"
            student={target}
            teamOf={target ? (teamOf.get(target.id)?.id ?? null) : undefined}
            users={users}
            teams={teams}
            nameOf={nameOf}
            onCancel={close}
            onSave={async (input) => {
              const teamName = teams.find((t) => t.id === input.teamId)?.name
              if (target) {
                await editMentor(target.id, { name: input.name, email: input.email, teamId: input.teamId })
                done(`${input.name}: changes saved.`)
                return
              }
              const user = await addMentor(input)
              setQuery('')
              setShow('all')
              done(`${user.name} added as a mentor${teamName ? ` of ${teamName}` : ''}. They can sign in with ${user.email} and the password you set.`)
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
              if (main === 'lecturer' && !extra.on) done(`${target.name} is no longer a mentor. You will find them under Lecturers.`)
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
          {target && teamOf.get(target.id) ? ` ${teamOf.get(target.id)!.name} will have no mentor until you give it one.` : ''}
        </p>
      </ConfirmDialog>
    </section>
  )
}
