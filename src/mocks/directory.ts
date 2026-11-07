import { DEMO_ACCOUNTS, DEMO_ADMIN } from '../api/auth.mock'
import type { SchoolTeam } from '../types/admin'
import type { Role, User } from '../types/user'

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

/** Everyone, sorted by name. Each call returns fresh copies. */
export function listUsers(): User[] {
  const all = [...TEAM_SEEDS.flatMap((t) => [t.mentor, ...t.students]), ...OTHER_STAFF]
  return all.map((u) => ({ ...u, roles: [...u.roles] })).sort((a, b) => a.name.localeCompare(b.name))
}

/** The teams, in order. Each call returns fresh copies. */
export function listTeams(): SchoolTeam[] {
  return TEAM_SEEDS.map((t) => ({ id: t.id, name: t.name, mentorId: t.mentor.id, studentIds: t.students.map((s) => s.id) }))
}
