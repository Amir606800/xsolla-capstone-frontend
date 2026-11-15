import type {
  AnalyticsPerson,
  AnalyticsWeek,
  AssignmentStatus,
  FeedbackDimension,
  MentorReport,
  OverviewReport,
  QuizAccuracy,
  StudentReport,
} from '../types/analytics'

/**
 * Offline stand-in for the analytics routes. Enough rows to click through every screen: a week with no grades, a
 * student with no scored quiz, and a mentor dimension nobody rated. Dates are fixed so tests and demos do not drift.
 */
const MOCK_LATENCY_MS = 200
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

const PERIOD = { from: '2026-09-28', to: '2026-11-15' }
const GENERATED_AT = '2026-11-15T17:00:00Z'

const openDate = (week: number) => new Date(Date.UTC(2026, 8, 28 + week * 7, 8)).toISOString()

const WEEK_COUNTS: { green: number; yellow: number; red: number }[] = [
  { green: 9, yellow: 3, red: 1 },
  { green: 8, yellow: 4, red: 1 },
  { green: 10, yellow: 2, red: 1 },
  { green: 0, yellow: 0, red: 0 }, // week 4: nobody graded yet
  { green: 7, yellow: 4, red: 2 },
  { green: 11, yellow: 1, red: 1 },
]

const WEEK_TITLES = ['Week 1 · Foundations', 'Week 2 · Go Basics', 'Week 3 · HTTP', 'Week 4 · Databases', 'Week 5 · React', 'Week 6 · Delivery']

const weeks = (): AnalyticsWeek[] =>
  WEEK_COUNTS.map((counts, i) => ({
    moduleId: i + 1,
    moduleTitle: WEEK_TITLES[i],
    opensAt: openDate(i),
    ...counts,
    total: counts.green + counts.yellow + counts.red,
  }))

const studentNames = [
  'Leyla Hasanova',
  'Murad Guliyev',
  'Nigar Ismayilova',
  'Tural Karimov',
  'Sam Student',
  'Aynur Babayeva',
  'Kamran Rzayev',
  'Sabina Valiyeva',
  'Orkhan Mustafayev',
  'Gunel Ahmadova',
  'Ali Abbasov',
  'Banu Hajiyeva',
  'Elnur Safarov',
  'Fidan Jafarova',
  'Ilkin Najafov',
  'Aysu Mirzayeva',
  'Emil Hasanli',
  'Konul Rahimova',
  'Nijat Bayramov',
  'Ulvi Tagiyev',
  'Arzu Gasimova',
  'Rauf Ibrahimov',
  'Narmin Aliyeva',
  'Farid Mammadov',
]

const students: AnalyticsPerson[] = studentNames.map((name, i) => ({
  id: 100 + i,
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@xsolla.school`,
}))

const mentors: AnalyticsPerson[] = [
  { id: 900, name: 'Rashad Aliyev', email: 'rashad.aliyev@xsolla.school' },
  { id: 901, name: 'Aysel Mammadova', email: 'aysel.mammadova@xsolla.school' },
  { id: 902, name: 'Elvin Huseynov', email: 'elvin.huseynov@xsolla.school' },
]

const find = (people: AnalyticsPerson[], id: number) => people.find((p) => p.id === id) ?? null

export async function mockOverview(): Promise<OverviewReport> {
  await wait()
  return { period: PERIOD, generatedAt: GENERATED_AT, weeks: weeks() }
}

export async function mockPeople(role: 'students' | 'mentors', q: string, limit: number, offset: number) {
  await wait()
  const all = role === 'students' ? students : mentors
  const needle = q.trim().toLowerCase()
  return all.filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.email ?? '').toLowerCase().includes(needle)).slice(offset, offset + limit)
}

export async function mockStudent(id: number): Promise<StudentReport | null> {
  await wait()
  const student = find(students, id)
  if (!student) return null
  const seed = id % 5
  const status: AssignmentStatus = {
    onTime: 5 + (seed % 3),
    late: 1 + (seed % 2),
    missing: seed === 0 ? 0 : 2,
    eligible: 8 + (seed % 3),
  }
  status.eligible = status.onTime + status.late + status.missing
  const quizzes: QuizAccuracy[] = [
    { moduleId: 1, moduleTitle: WEEK_TITLES[0], opensAt: openDate(0), scoreTotal: 16, possibleTotal: 20, accuracy: 80, attemptCount: 2 },
    { moduleId: 2, moduleTitle: WEEK_TITLES[1], opensAt: openDate(1), scoreTotal: 5, possibleTotal: 8, accuracy: 62.5, attemptCount: 1 },
    { moduleId: 3, moduleTitle: WEEK_TITLES[2], opensAt: openDate(2), scoreTotal: 0, possibleTotal: 0, accuracy: null, attemptCount: 1 },
  ]
  return { student, period: PERIOD, generatedAt: GENERATED_AT, status, quizzes }
}

export async function mockMentor(id: number): Promise<MentorReport | null> {
  await wait()
  const mentor = find(mentors, id)
  if (!mentor) return null
  // Elvin (902) has only unrated dimensions, so the screen shows "No responses".
  const rated = id !== 902
  const feedback: FeedbackDimension[] = [
    { dimension: 'clarity', average: rated ? 4.4 : null, count: rated ? 5 : 0 },
    { dimension: 'engagement', average: rated ? 4.2 : null, count: rated ? 5 : 0 },
    { dimension: 'comfort', average: rated ? 4.8 : null, count: rated ? 4 : 0 },
    { dimension: 'time', average: rated ? 4 : null, count: rated ? 5 : 0 },
  ]
  const mentorWeeks = weeks().map((w) => ({ ...w, green: Math.ceil(w.green / 3), yellow: Math.ceil(w.yellow / 3), red: Math.ceil(w.red / 3), total: 0 }))
  for (const w of mentorWeeks) w.total = w.green + w.yellow + w.red
  return { mentor, period: PERIOD, generatedAt: GENERATED_AT, feedback, weeks: mentorWeeks, attribution: 'current_roster' }
}
