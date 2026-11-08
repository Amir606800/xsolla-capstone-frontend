import { DEMO_ACCOUNTS, DEMO_ADMIN } from './accounts'
import type { SchoolTeam, SchoolUser } from '../types/admin'
import type { Role, User } from '../types/user'
import { isStaffRole, mainRoleOf, ROLE_NAMES } from '../utils/adminRoles'

/**
 * Offline school directory for the admin section: every account and the six teams.
 * It matches the other mocks: Sam and teammates 101-104 are Team 3 with Rashad (900), Team 4
 * (111-115) is Aysel's (901), Elvin (902) only lectures. 29 students in 6 teams (five of 5, one of 4).
 */

const person = (id: number, name: string, roles: Role[], email?: string): User => ({
  id,
  name,
  email: email ?? `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  roles,
})
const student = (id: number, name: string) => person(id, name, ['student'])
const mentor = (id: number, name: string) => person(id, name, ['mentor'])

const sam = DEMO_ACCOUNTS['student@xsolla.school']
const rashad = DEMO_ACCOUNTS['lecturer@xsolla.school']
const aysel = DEMO_ACCOUNTS['mentor@xsolla.school']
const elvin = DEMO_ACCOUNTS['teacher@xsolla.school']

const TEAM_SEEDS: { id: string; name: string; mentor: User; students: User[] }[] = [
  {
    id: 't1',
    name: 'Team 1',
    mentor: mentor(903, 'Farid Mammadli'),
    students: [
      student(121, 'Ali Abbasov'),
      student(122, 'Banu Hajiyeva'),
      student(123, 'Elnur Safarov'),
      student(124, 'Fidan Jafarova'),
      student(125, 'Ilkin Najafov'),
    ],
  },
  {
    id: 't2',
    name: 'Team 2',
    mentor: mentor(904, 'Lala Aliyeva'),
    students: [
      student(131, 'Aysu Mirzayeva'),
      student(132, 'Emil Hasanli'),
      student(133, 'Konul Rahimova'),
      student(134, 'Nijat Bayramov'),
      student(135, 'Ulvi Tagiyev'),
    ],
  },
  {
    id: 't3',
    name: 'Team 3',
    mentor: rashad,
    students: [
      sam,
      student(101, 'Leyla Hasanova'),
      student(102, 'Murad Guliyev'),
      student(103, 'Nigar Ismayilova'),
      student(104, 'Tural Karimov'),
    ],
  },
  {
    id: 't4',
    name: 'Team 4',
    mentor: aysel,
    students: [
      student(111, 'Aynur Babayeva'),
      student(112, 'Kamran Rzayev'),
      student(113, 'Sabina Valiyeva'),
      student(114, 'Orkhan Mustafayev'),
      student(115, 'Gunel Ahmadova'),
    ],
  },
  {
    id: 't5',
    name: 'Team 5',
    mentor: mentor(905, 'Javid Huseynli'),
    students: [
      student(151, 'Arzu Gasimova'),
      student(152, 'Rauf Ibrahimov'),
      student(153, 'Shahla Musayeva'),
      student(154, 'Togrul Aliyev'),
      student(155, 'Zarina Salimova'),
    ],
  },
  {
    id: 't6',
    name: 'Team 6',
    mentor: mentor(906, 'Sevinj Gasimova'),
    students: [
      student(161, 'Anar Novruzov'),
      student(162, 'Gulnar Mammadova'),
      student(163, 'Ramil Shirinov'),
      student(164, 'Vusala Karimli'),
    ],
  },
]

/** Staff who are in no team: lecturers without a team, and the admin. */
const OTHER_STAFF: User[] = [elvin, person(907, 'Nargiz Abbasova', ['lecturer']), DEMO_ADMIN]

// ---------- what the admin changed, kept in this browser ----------

interface DirectoryEdits {
  /** Accounts the admin added (with the role they were created with). */
  added: SchoolUser[]
  /** Students moved between teams: user id -> team id, or null for no team. */
  teamOf: Record<string, string | null>
  /** Name / e-mail corrections: user id -> the new values. */
  changed: Record<string, { name?: string; email?: string }>
  /** Students who left the school: user id -> when. Their account is kept. */
  left: Record<string, string>
  /** Accounts deleted for good. */
  deleted: number[]
  /** Roles the admin set: user id -> the roles, and until when the temporary ones last. */
  roles: Record<string, { roles: Role[]; until?: Partial<Record<Role, string>> }>
  /** Team mentors the admin set: team id -> mentor id, or null for none. */
  mentorOf: Record<string, number | null>
  /**
   * Teams the admin made (random teams) instead of the six demo ones. An empty list is "no teams".
   * Left out, the demo teams are used.
   */
  custom?: { id: string; name: string }[]
  /**
   * Passwords the admin reset: user id -> a fingerprint of the new one. Offline only, so the demo
   * behaves like the real thing (the old password stops working). Not a security measure: with a
   * backend the server keeps passwords (hashed) and nothing is stored in the browser.
   */
  passwords?: Record<string, string>
}

const KEY = 'school_directory'

function load(): DirectoryEdits {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<DirectoryEdits>) : {}
    return {
      added: parsed.added ?? [],
      teamOf: parsed.teamOf ?? {},
      changed: parsed.changed ?? {},
      left: parsed.left ?? {},
      deleted: parsed.deleted ?? [],
      roles: parsed.roles ?? {},
      mentorOf: parsed.mentorOf ?? {},
      ...(parsed.custom ? { custom: parsed.custom } : {}),
      ...(parsed.passwords ? { passwords: parsed.passwords } : {}),
    }
  } catch {
    return { added: [], teamOf: {}, changed: {}, left: {}, deleted: [], roles: {}, mentorOf: {} }
  }
}

function save(edits: DirectoryEdits): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(edits))
  } catch {
    /* storage blocked or full: the change lasts until the page reloads */
  }
}

/** The teams that exist: the ones the admin made, else the six demo teams. */
const teamDefs = (edits: DirectoryEdits) => edits.custom ?? TEAM_SEEDS.map((t) => ({ id: t.id, name: t.name }))
const teamExists = (id: string) => teamDefs(load()).some((t) => t.id === id)

const seedUsers = (): User[] => [...TEAM_SEEDS.flatMap((t) => [t.mentor, ...t.students]), ...OTHER_STAFF]

/**
 * The roles someone holds at `now`: a role given until a date is gone once that date has passed
 * (the backend should do the same). The end dates of the roles still held are kept.
 */
function rolesAt(base: User, set: DirectoryEdits['roles'][string] | undefined, now: Date): Pick<User, 'roles' | 'roleUntil'> {
  const roles = set ? set.roles : base.roles
  const until = set ? (set.until ?? {}) : (base.roleUntil ?? {})
  const held = roles.filter((r) => !until[r] || new Date(until[r]!) > now)
  const left: Partial<Record<Role, string>> = {}
  for (const r of held) if (until[r]) left[r] = until[r]
  return { roles: held, ...(Object.keys(left).length ? { roleUntil: left } : {}) }
}

/** Everyone (also those who left; not the deleted), sorted by name. Each call returns fresh copies. */
export function listUsers(now: Date = new Date()): SchoolUser[] {
  const { added, changed, left, deleted, roles } = load()
  return [...seedUsers(), ...added]
    .filter((u) => !deleted.includes(u.id))
    .map((u) => {
      const { roleUntil: _old, ...rest } = u
      void _old
      return {
        ...rest,
        ...changed[String(u.id)],
        ...rolesAt(u, roles[String(u.id)], now),
        // worked out from the roles the account started with, so later changes never move it
        mainRole: mainRoleOf(u),
        ...(left[String(u.id)] ? { leftAt: left[String(u.id)] } : {}),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Students who left or were deleted are in no team. */
const gone = (edits: DirectoryEdits) => (id: number) => edits.deleted.includes(id) || String(id) in edits.left

/** The teams, in order, with the admin's moves applied. Each call returns fresh copies. */
export function listTeams(now: Date = new Date()): SchoolTeam[] {
  const edits = load()
  const { teamOf, mentorOf } = edits
  const out = gone(edits)
  // a team's mentor must still exist and still hold the mentor role
  const mentors = new Set(
    listUsers(now)
      .filter((u) => u.roles.includes('mentor') && !u.leftAt)
      .map((u) => u.id),
  )
  return teamDefs(edits).map((t) => {
    // the demo teams start with their demo members and mentor; teams the admin made start empty
    const seed = edits.custom ? undefined : TEAM_SEEDS.find((x) => x.id === t.id)
    const mentorId = t.id in mentorOf ? mentorOf[t.id] : (seed?.mentor.id ?? null)
    const kept = (seed?.students ?? []).map((st) => st.id).filter((id) => !(String(id) in teamOf))
    const joined = Object.entries(teamOf)
      .filter(([, team]) => team === t.id)
      .map(([id]) => Number(id))
    return {
      id: t.id,
      name: t.name,
      mentorId: mentorId !== null && mentors.has(mentorId) ? mentorId : null,
      studentIds: [...kept, ...joined].filter((id) => !out(id)),
    }
  })
}

export interface NewAccount {
  name: string
  email: string
  roles: Role[]
  roleUntil?: Partial<Record<Role, string>>
}

/** Adds an account (any password works offline). The e-mail must be new. */
export function addUser(account: NewAccount): User {
  const email = account.email.trim().toLowerCase()
  if (emailTaken(email)) throw new Error('There is already an account with this email.')
  const edits = load()
  const id = Math.max(2000, ...listUsers().map((u) => u.id)) + 1
  const user: SchoolUser = {
    id,
    name: account.name.trim(),
    email,
    roles: [...account.roles],
    ...(account.roleUntil ? { roleUntil: { ...account.roleUntil } } : {}),
    // the first role is the one the account is created as
    mainRole: account.roles[0],
  }
  edits.added.push(user)
  save(edits)
  return { ...user, roles: [...user.roles] }
}

const emailTaken = (email: string, exceptId?: number) =>
  listUsers().some((u) => u.id !== exceptId && u.email.toLowerCase() === email.trim().toLowerCase())

function existing(id: number): SchoolUser {
  const user = listUsers().find((u) => u.id === id)
  if (!user) throw new Error('This account does not exist')
  return user
}

/** Corrects someone's name or e-mail (the e-mail must stay unique). */
export function updateUser(id: number, patch: { name?: string; email?: string }): SchoolUser {
  existing(id)
  if (patch.email !== undefined && emailTaken(patch.email, id)) throw new Error('There is already an account with this email.')
  const edits = load()
  edits.changed[String(id)] = {
    ...edits.changed[String(id)],
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
  }
  save(edits)
  return existing(id)
}

/** Marks a student as having left (they leave their team too), or brings them back (without a team). */
export function setLeft(id: number, left: boolean, now: Date = new Date()): SchoolUser {
  existing(id)
  const edits = load()
  if (left) {
    edits.left[String(id)] = now.toISOString()
    edits.teamOf[String(id)] = null
  } else delete edits.left[String(id)]
  save(edits)
  return existing(id)
}

/** Deletes an account for good. */
export function deleteUser(id: number): void {
  existing(id)
  const edits = load()
  edits.deleted.push(id)
  delete edits.teamOf[String(id)]
  delete edits.left[String(id)]
  save(edits)
}

/**
 * Sets someone's roles. `until`: the roles given only for a while, and when they end.
 * The main role (the one the account was created with) always stays and never ends; only the other
 * staff role can be added or taken back. A mentor who loses the role is no longer any team's mentor.
 */
export function setRoles(id: number, roles: Role[], until: Partial<Record<Role, string>> = {}): SchoolUser {
  const user = existing(id)
  if (roles.length === 0) throw new Error('Keep at least one role.')
  const main = mainRoleOf(user)
  if (!roles.includes(main)) throw new Error(`${user.name} is a ${ROLE_NAMES[main].toLowerCase()}: that role cannot be taken away.`)
  if (until[main]) throw new Error(`${user.name}’s main role cannot end.`)
  if (isStaffRole(main) && roles.some((r) => !isStaffRole(r))) throw new Error('Only the mentor and lecturer roles can be given.')
  const edits = load()
  const kept: Partial<Record<Role, string>> = {}
  for (const r of roles) if (until[r]) kept[r] = until[r]
  edits.roles[String(id)] = { roles: [...roles], ...(Object.keys(kept).length ? { until: kept } : {}) }
  save(edits)
  return existing(id)
}

/** Makes someone the mentor of a team (its previous mentor is left without one), or of none (null). */
export function setMentorTeam(mentorId: number, teamId: string | null): void {
  // no check that the mentor is in this directory: with a backend the accounts live there, only teams are here
  if (teamId !== null && !teamExists(teamId)) throw new Error('This team does not exist')
  const edits = load()
  for (const t of listTeams()) if (t.mentorId === mentorId) edits.mentorOf[t.id] = null
  if (teamId !== null) edits.mentorOf[teamId] = mentorId
  save(edits)
}

/** Puts a student in a team (or in none, with null). */
export function setTeam(userId: number, teamId: string | null): void {
  if (teamId !== null && !teamExists(teamId)) throw new Error('This team does not exist')
  const edits = load()
  edits.teamOf[String(userId)] = teamId
  save(edits)
}

/** One team to create: who mentors it and which students are in it. */
export interface TeamPlan {
  mentorId: number | null
  studentIds: number[]
}

/** Replaces every team with these (Team 1, Team 2, ...). Nobody is left in an old team. */
export function createTeams(plan: TeamPlan[]): void {
  const edits = load()
  edits.custom = plan.map((_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}` }))
  edits.teamOf = {}
  edits.mentorOf = {}
  plan.forEach((team, i) => {
    const id = `t${i + 1}`
    edits.mentorOf[id] = team.mentorId
    for (const studentId of team.studentIds) edits.teamOf[String(studentId)] = id
  })
  save(edits)
}

/** Removes every team: all students and mentors are free again. */
export function clearTeams(): void {
  const edits = load()
  edits.custom = []
  edits.teamOf = {}
  edits.mentorOf = {}
  save(edits)
}

/** Sets who mentors a team: a mentor leaves their old team for it; null leaves the team without one. */
export function setTeamMentor(teamId: string, mentorId: number | null): void {
  if (mentorId !== null) return setMentorTeam(mentorId, teamId)
  if (!teamExists(teamId)) throw new Error('This team does not exist')
  const edits = load()
  edits.mentorOf[teamId] = null
  save(edits)
}

/** Offline stand-in for a password check (see `passwords` above): a short fingerprint, not real hashing. */
function fingerprint(id: number, password: string): string {
  let h = 0x811c9dc5
  for (const ch of `${id}:${password}`) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

/** The admin set a new password: from now on only this one signs the person in (offline demo). */
export function setPassword(id: number, password: string): void {
  existing(id)
  if (!password) throw new Error('Enter the new password.')
  const edits = load()
  edits.passwords = { ...edits.passwords, [String(id)]: fingerprint(id, password) }
  save(edits)
}

/** Offline sign-in: any password works until the admin resets it, then only the new one does. */
export function passwordMatches(id: number, password: string): boolean {
  const stored = load().passwords?.[String(id)]
  return stored === undefined || stored === fingerprint(id, password)
}
