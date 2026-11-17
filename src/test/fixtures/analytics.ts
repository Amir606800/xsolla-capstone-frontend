import type {
  AiSummary,
  AnalyticsPerson,
  AnalyticsRole,
  AnalyticsWeek,
  AssignmentStatus,
  FeedbackDimension,
  MentorReport,
  OverviewReport,
  QuizAccuracy,
  StudentReport,
} from '../../types/analytics'
import { REVIEW_STATEMENTS } from '../../types/mentorReview'
import type { SchoolUser } from '../../types/admin'
import { analyseStandings } from '../../utils/standing'
import { canMentor, isStudent } from '../../utils/roles'
import { adminLectureReviews } from './adminLectureReviews'
import { adminReviews } from './adminReviews'
import { buildMockModules } from './courses'
import { listTeams, listUsers } from './directory'
import { allStandings } from './standings'

/**
 * Offline stand-in for the analytics routes. It is made from the same demo data as the rest of the app (the people and
 * teams, the mentors' week grades, the mentor and lecture reviews), so Sam in Analytics is the Sam of the Grading page.
 * Hand-ins and quiz scores are not kept by the demo, so they are worked out from the student's id: the same on every visit.
 */
const MOCK_LATENCY_MS = 200
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

const day = (d: Date) => d.toISOString().slice(0, 10)

function period(now: Date) {
  const from = new Date(now)
  from.setDate(from.getDate() - 12 * 7 + 1)
  return { from: day(from), to: day(now) }
}

const person = (u: SchoolUser): AnalyticsPerson => ({ id: u.id, name: u.name, email: u.email })
const active = (now: Date) => listUsers(now).filter((u) => !u.leftAt)
const studentsOf = (now: Date) => active(now).filter((u) => isStudent(u))
const mentorsOf = (now: Date) => active(now).filter((u) => canMentor(u))

/** The weeks that have opened, oldest first. */
function openWeeks(now: Date) {
  return buildMockModules(now).filter((m) => m.opensAt && new Date(m.opensAt) <= now)
}

/** Green / yellow / red per week for these students (all students when `ids` is left out). */
function standingWeeks(now: Date, ids?: Set<number>): AnalyticsWeek[] {
  const grades = allStandings(now).filter((g) => !ids || ids.has(g.studentId))
  return openWeeks(now).map((m) => {
    const of = grades.filter((g) => g.week === m.position)
    const count = (level: string) => of.filter((g) => g.level === level).length
    const green = count('green')
    const yellow = count('yellow')
    const red = count('red')
    return {
      moduleId: m.position,
      moduleTitle: `Week ${m.position} · ${m.title}`,
      opensAt: m.opensAt as string,
      green,
      yellow,
      red,
      total: green + yellow + red,
    }
  })
}

export async function mockOverview(now: Date = new Date()): Promise<OverviewReport> {
  await wait()
  return { period: period(now), generatedAt: now.toISOString(), weeks: standingWeeks(now) }
}

export async function mockPeople(role: 'students' | 'mentors', q: string, limit: number, offset: number, now: Date = new Date()) {
  await wait()
  const all = (role === 'students' ? studentsOf(now) : mentorsOf(now)).map(person)
  const needle = q.trim().toLowerCase()
  return all
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.email ?? '').toLowerCase().includes(needle))
    .slice(offset, offset + limit)
}

export async function mockStudent(id: number, now: Date = new Date()): Promise<StudentReport | null> {
  await wait()
  const student = studentsOf(now).find((u) => u.id === id)
  if (!student) return null
  const weeks = openWeeks(now)
  // two deadlines in each week that is over; some late, a few missed (more for some students than others)
  const over = weeks.filter((m) => m.closesAt && new Date(m.closesAt) < now).length
  const eligible = over * 2
  const missing = Math.min(eligible, (id * 7) % 4 === 0 ? 0 : ((id * 7) % 4) - (id % 2))
  const late = Math.min(eligible - Math.max(0, missing), (id * 3) % 3)
  const status: AssignmentStatus = {
    onTime: eligible - Math.max(0, missing) - late,
    late,
    missing: Math.max(0, missing),
    eligible,
  }
  // one quiz per week that is over; the latest one has no points to score, so it shows as "No scored answers"
  const quizzes: QuizAccuracy[] = weeks.slice(0, over + 1).map((m, i) => {
    const possible = i === over ? 0 : 10
    const score = possible === 0 ? 0 : Math.max(3, 10 - ((id + i * 3) % 6))
    return {
      moduleId: m.position,
      moduleTitle: `Week ${m.position} · ${m.title}`,
      opensAt: m.opensAt as string,
      scoreTotal: score,
      possibleTotal: possible,
      accuracy: possible === 0 ? null : Math.round((score / possible) * 1000) / 10,
      attemptCount: 1,
    }
  })
  return { student: person(student), period: period(now), generatedAt: now.toISOString(), status, quizzes }
}

export async function mockMentor(id: number, now: Date = new Date()): Promise<MentorReport | null> {
  await wait()
  const mentor = mentorsOf(now).find((u) => u.id === id)
  if (!mentor) return null
  const reviews = adminReviews(now).filter((r) => r.mentorId === id)
  const feedback: FeedbackDimension[] = REVIEW_STATEMENTS.map((dimension) => {
    const scores = reviews.flatMap((r) => (r.ratings[dimension] === undefined ? [] : [r.ratings[dimension] as number]))
    return {
      dimension,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
      count: scores.length,
    }
  })
  const team = new Set(
    listTeams(now)
      .filter((t) => t.mentorId === id)
      .flatMap((t) => t.studentIds),
  )
  return {
    mentor: person(mentor),
    period: period(now),
    generatedAt: now.toISOString(),
    feedback,
    weeks: standingWeeks(now, team),
    attribution: 'current_roster',
  }
}

// ---------- the AI summary, offline ----------

const none = (now: Date, what: string): AiSummary => ({
  summary: `There is not enough ${what} to generate a summary yet.`,
  sourceCount: 0,
  generatedAt: null,
  cached: false,
  period: period(now),
})

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/**
 * A stand-in for the AI summary, written by the app from the demo data so the section has something to show offline.
 * The card says it is demo text; with a server the text comes from the AI and the real feedback.
 */
export async function mockAiSummary(role: AnalyticsRole, id: number, now: Date = new Date()): Promise<AiSummary> {
  await wait()
  if (role === 'students') {
    const notes = allStandings(now).filter((g) => g.studentId === id)
    const written = notes.filter((g) => g.note)
    if (written.length === 0) return none(now, 'written feedback')
    const s = analyseStandings(notes)
    const steady = s.counts.green >= s.counts.total / 2
    return {
      summary: [
        steady
          ? 'The mentor’s notes describe a student who mostly keeps pace with the program and reports on time.'
          : 'The mentor’s notes describe an uneven run of weeks: good starts are followed by weeks where the work fell behind.',
        s.counts.red > 0
          ? 'At least one week had no progress report, and the mentor asked to be told in advance about absences.'
          : 'No note mentions a missed progress report.',
        s.yellowStreak > 0
          ? 'The latest notes say the tasks are behind but that the student is catching up; finishing the open tasks before the next week starts is the clearest next step.'
          : 'The latest notes are positive; the mentor’s advice is to keep the same rhythm.',
      ].join(' '),
      sourceCount: written.length,
      generatedAt: now.toISOString(),
      cached: false,
      period: period(now),
    }
  }
  if (role === 'mentors') {
    const reviews = adminReviews(now).filter((r) => r.mentorId === id)
    if (reviews.length === 0) return none(now, 'student feedback')
    const sessions = reviews.filter((r) => r.hadSession).length
    const overall = mean(reviews.map((r) => r.overall))
    const comments = reviews.filter((r) => r.comment).length
    return {
      summary: [
        `Students reported having a 1:1 in ${sessions} of ${reviews.length} reviewed weeks${sessions < reviews.length ? '; in the other weeks the most common reason was that no time was scheduled' : ''}.`,
        overall >= 4
          ? 'Overall ratings are mostly high: students describe the mentor as approachable and clear.'
          : overall >= 3
            ? 'Overall ratings are mixed: several students find the sessions useful, others would like more structure.'
            : 'Overall ratings are low, and comments ask for more time and clearer next steps.',
        comments > 0
          ? `${comments} reviews have a written comment; the recurring wish is to end each session with concrete next steps.`
          : 'Few reviews have a written comment.',
      ].join(' '),
      sourceCount: reviews.length,
      generatedAt: now.toISOString(),
      cached: false,
      period: period(now),
    }
  }
  const lectures = adminLectureReviews(now).filter((r) => r.lecturers.some((l) => l.id === id))
  if (lectures.length === 0) return none(now, 'lecture feedback')
  const overall = mean(lectures.map((r) => r.overall))
  const fast = lectures.filter((r) => r.pace === 'too_fast').length
  return {
    summary: [
      overall >= 4
        ? 'Students rate the lectures well: the live coding and the examples are what they mention most.'
        : 'Students find the lectures useful but uneven: the examples work, the newer parts are harder to follow.',
      fast > lectures.length / 3
        ? `About ${Math.round((fast / lectures.length) * 100)}% say the pace is too fast; slowing down on new material and leaving time for the exercises are the most common requests.`
        : 'Most students find the pace about right.',
      'Several ask for the slides to be shared before the lecture.',
    ].join(' '),
    sourceCount: lectures.length,
    generatedAt: now.toISOString(),
    cached: false,
    period: period(now),
  }
}

/** Offline: every active student may answer every lecture. */
export async function mockLectureExpected(now: Date = new Date()): Promise<Record<string, number>> {
  await wait()
  const students = studentsOf(now).length
  return Object.fromEntries(adminLectureReviews(now).map((r) => [`${r.lecture.eventId}@${r.lecture.startsAt}`, students]))
}
