import type { Team } from '../types/team'
import type { User } from '../types/user'

// A cohort of 29 students is split into 6 teams: five teams of 5 and one of 4.
const COHORT_SIZE = 29
const TEAM_COUNT = 6

export const MENTOR = { id: 900, name: 'Rashad Aliyev', email: 'rashad.aliyev@example.com' }

const TEAMMATES = [
  { id: 101, name: 'Leyla Hasanova', email: 'leyla.hasanova@example.com' },
  { id: 102, name: 'Murad Guliyev', email: 'murad.guliyev@example.com' },
  { id: 103, name: 'Nigar Ismayilova', email: 'nigar.ismayilova@example.com' },
  { id: 104, name: 'Tural Karimov', email: 'tural.karimov@example.com' },
]

/** The signed-in student's team: themselves plus four teammates, sorted by name. */
export function buildMockTeam(user: Pick<User, 'id' | 'name' | 'email'>): Team {
  const members = [{ id: user.id, name: user.name, email: user.email }, ...TEAMMATES].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  return { id: 't3', name: 'Team 3', mentor: MENTOR, members, cohortSize: COHORT_SIZE, teamCount: TEAM_COUNT }
}
