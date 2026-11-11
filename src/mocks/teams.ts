import type { Person, Team } from '../types/team'
import type { User } from '../types/user'

/** Every demo team has a mentor (a real one may not have one yet). */
export type DemoTeam = Team & { mentor: Person }

// A cohort of 29 students is split into 6 teams: five teams of 5 and one of 4.
const COHORT_SIZE = 29
const TEAM_COUNT = 6

/** Mentor of Team 3 (Sam's team). Same id as the "Mentor & lecturer" demo account. */
export const MENTOR = { id: 900, name: 'Rashad Aliyev', email: 'rashad.aliyev@example.com' }

const TEAMMATES = [
  { id: 101, name: 'Leyla Hasanova', email: 'leyla.hasanova@example.com' },
  { id: 102, name: 'Murad Guliyev', email: 'murad.guliyev@example.com' },
  { id: 103, name: 'Nigar Ismayilova', email: 'nigar.ismayilova@example.com' },
  { id: 104, name: 'Tural Karimov', email: 'tural.karimov@example.com' },
]

/** The demo student who signs in as student@xsolla.school. */
const SAM = { id: 1, name: 'Sam Student', email: 'student@xsolla.school' }

/** Any other mentor gets Team 4. */
const TEAM_4 = [
  { id: 111, name: 'Aynur Babayeva', email: 'aynur.babayeva@example.com' },
  { id: 112, name: 'Kamran Rzayev', email: 'kamran.rzayev@example.com' },
  { id: 113, name: 'Sabina Valiyeva', email: 'sabina.valiyeva@example.com' },
  { id: 114, name: 'Orkhan Mustafayev', email: 'orkhan.mustafayev@example.com' },
  { id: 115, name: 'Gunel Ahmadova', email: 'gunel.ahmadova@example.com' },
]

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name)

/** The signed-in student's team: themselves plus four teammates, sorted by name. */
export function buildMockTeam(user: Pick<User, 'id' | 'name' | 'email'>): DemoTeam {
  const members = [{ id: user.id, name: user.name, email: user.email }, ...TEAMMATES].sort(byName)
  return { id: 't3', name: 'Team 3', mentor: MENTOR, members, cohortSize: COHORT_SIZE, teamCount: TEAM_COUNT }
}

/** The team a mentor looks after. Rashad (900) has Sam's team, so the two demo accounts meet. */
export function buildMentorTeam(mentor: Pick<User, 'id' | 'name' | 'email'>): DemoTeam {
  const self = { id: mentor.id, name: mentor.name, email: mentor.email }
  if (mentor.id === MENTOR.id) {
    return { id: 't3', name: 'Team 3', mentor: self, members: [SAM, ...TEAMMATES].sort(byName), cohortSize: COHORT_SIZE, teamCount: TEAM_COUNT }
  }
  return { id: 't4', name: 'Team 4', mentor: self, members: [...TEAM_4].sort(byName), cohortSize: COHORT_SIZE, teamCount: TEAM_COUNT }
}
