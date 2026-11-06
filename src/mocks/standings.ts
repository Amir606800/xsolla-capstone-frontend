import type { StandingLevel, WeeklyStanding } from '../types/standing'
import { buildMockModules } from './courses'
import { buildMentorTeam, MENTOR } from './teams'

/**
 * Stand-in for the backend's weekly grades: every student's green / yellow / red grade per week,
 * given by their team's mentor. Kept in localStorage so a mentor and a student in the same browser
 * see each other's changes. Rules the real backend must enforce too:
 * - a student only reads their own grades
 * - a mentor grades the students of THEIR team only, and only weeks that have started
 * - one grade per student per week; the mentor may change it (the last one counts)
 */

export interface StoredStanding extends WeeklyStanding {
  studentId: number
  gradedBy?: { id: number; name: string }
}

const KEY = 'standings'
const keyOf = (studentId: number, week: number) => `${studentId}:${week}`
type Store = Record<string, StoredStanding>

/** Sam's weeks 1-5, ending with two yellow weeks so the "4 in a row" warning has something to show. */
const SAM: Pick<WeeklyStanding, 'level' | 'note'>[] = [
  { level: 'green', note: 'Great start. Setup done and you reported on time.' },
  { level: 'red', note: 'No progress report this week. Please tell me in advance if you are away.' },
  { level: 'green', note: 'Back on track, well done.' },
  { level: 'yellow', note: 'Behind on the tasks, but you are catching up.' },
  { level: 'yellow' },
]

/** Teammates: weeks 1-4 graded, week 5 still to grade. */
const OTHERS: StandingLevel[][] = [
  ['green', 'green', 'green', 'green'],
  ['green', 'yellow', 'yellow', 'yellow'],
  ['yellow', 'green', 'green', 'green'],
  ['green', 'green', 'red', 'green'],
  ['green', 'yellow', 'green', 'yellow'],
]

/** Sam's own grades, as the student pages show them. */
export function buildMockStandings(now: Date = new Date()): WeeklyStanding[] {
  const modules = buildMockModules(now)
  return SAM.map((r, i) => ({
    week: i + 1,
    level: r.level,
    assessedAt: modules[i].closesAt ?? now.toISOString(),
    ...(r.note ? { note: r.note } : {}),
  }))
}

export function buildMockStandingStore(now: Date = new Date()): Store {
  const modules = buildMockModules(now)
  const store: Store = {}
  const rashad = { id: MENTOR.id, name: MENTOR.name }
  for (const s of buildMockStandings(now)) store[keyOf(1, s.week)] = { ...s, studentId: 1, gradedBy: rashad }

  const teams = [buildMentorTeam({ ...MENTOR }), buildMentorTeam({ id: 901, name: 'Aysel Mammadova', email: '' })]
  for (const team of teams) {
    team.members
      .filter((m) => m.id !== 1)
      .forEach((student, si) => {
        OTHERS[si % OTHERS.length].forEach((level, wi) => {
          const week = wi + 1
          store[keyOf(student.id, week)] = {
            week,
            level,
            assessedAt: modules[wi].closesAt ?? now.toISOString(),
            studentId: student.id,
            gradedBy: { id: team.mentor.id, name: team.mentor.name },
          }
        })
      })
  }
  return store
}

function load(now: Date): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    /* unreadable: fall back to the demo data */
  }
  const seed = buildMockStandingStore(now)
  save(seed)
  return seed
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage blocked or full: changes last until the page reloads */
  }
}

const plain = (s: StoredStanding): WeeklyStanding => ({
  week: s.week,
  level: s.level,
  assessedAt: s.assessedAt,
  ...(s.note ? { note: s.note } : {}),
})

/** A student's own weekly grades, oldest week first. */
export function standingsOf(studentId: number, now: Date = new Date()): WeeklyStanding[] {
  return Object.values(load(now))
    .filter((s) => s.studentId === studentId)
    .sort((a, b) => a.week - b.week)
    .map(plain)
}

export interface Mentor {
  id: number
  name: string
}

const teamIds = (mentor: Mentor) => new Set(buildMentorTeam({ ...mentor, email: '' }).members.map((m) => m.id))

/** Every weekly grade of this mentor's students. */
export function teamStandings(mentor: Mentor, now: Date = new Date()): StoredStanding[] {
  const ids = teamIds(mentor)
  return Object.values(load(now)).filter((s) => ids.has(s.studentId))
}

/** Mentor: gives (or changes) a student's grade for one week. */
export function gradeWeek(
  mentor: Mentor,
  studentId: number,
  week: number,
  level: StandingLevel,
  note: string,
  now: Date = new Date(),
): StoredStanding[] {
  if (!teamIds(mentor).has(studentId)) throw new Error('This student is not in your team')
  const module = buildMockModules(now).find((m) => m.position === week)
  if (!module) throw new Error('This week does not exist')
  if (module.opensAt && new Date(module.opensAt) > now) throw new Error('This week has not started yet')
  const store = load(now)
  const text = note.trim()
  store[keyOf(studentId, week)] = {
    week,
    level,
    assessedAt: now.toISOString(),
    ...(text ? { note: text } : {}),
    studentId,
    gradedBy: { id: mentor.id, name: mentor.name },
  }
  save(store)
  return teamStandings(mentor, now)
}
