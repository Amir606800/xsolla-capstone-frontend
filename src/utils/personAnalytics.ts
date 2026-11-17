import type { LectureRow } from '../types/analytics'
import { PACES } from '../types/lectureReview'
import type { AdminLectureReview, Pace } from '../types/lectureReview'
import type { StandingLevel, WeeklyStanding } from '../types/standing'
import type { StudentReview } from '../types/studentReview'
import { lectureKey } from './lectureAnalytics'
import { average } from './reviewAnalytics'
import { analyseStandings, RED_LIMIT, YELLOW_LIMIT } from './standing'
import type { StandingSummary } from './standing'

/**
 * The "at a glance" reading of one person for the admin's analytics: one verdict an admin can take in at first look,
 * worked out from the program's own rules (students) or from what students said (mentors, lecturers). It never mixes the
 * kinds of data into one score: a student's verdict comes from the mentor's weekly grades only, a mentor's or lecturer's
 * from the students' ratings only.
 */

export type Tone = 'good' | 'warn' | 'bad' | 'none'

export interface Verdict {
  tone: Tone
  title: string
  text: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// ---------- the reporting period ----------

const schoolDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit' })

/** The school date (YYYY-MM-DD, Baku time) of a moment. */
export const schoolDate = (iso: string) => schoolDay.format(new Date(iso))

/** Whether a moment falls inside the period (both days included). Empty ends are open. */
export function inPeriod(iso: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const day = schoolDate(iso)
  return (!from || day >= from) && (!to || day <= to)
}

// ---------- students: the mentor's weekly grades ----------

/** One student's weekly grades as the program rules read them, oldest week first. */
export function weeksOf(grades: StudentReview[], studentId: number): WeeklyStanding[] {
  return grades
    .filter((g) => g.studentId === studentId)
    .map((g) => ({ week: g.week, level: g.level, assessedAt: g.gradedAt, ...(g.note ? { note: g.note } : {}) }))
    .sort((a, b) => a.week - b.week)
}

/** How the student stands now, in the words of the program rules. */
export function studentVerdict(s: StandingSummary): Verdict {
  if (s.weeks.length === 0)
    return { tone: 'none', title: 'Not graded yet', text: 'No mentor has graded a week for this student yet.' }
  const last = s.weeks[s.weeks.length - 1]
  if (s.removal) {
    return {
      tone: 'bad',
      title: 'Removal',
      text: `${RED_LIMIT} red weeks in a row (up to week ${last.week}): under the program rules this means removal.`,
    }
  }
  if (s.redStreak === 1) {
    return {
      tone: 'bad',
      title: 'At risk',
      text: `Week ${last.week} counted as red${last.escalated ? ` (the ${YELLOW_LIMIT}th yellow week in a row)` : ''}. One more red week in a row means removal.`,
    }
  }
  if (s.yellowStreak >= 1) {
    return {
      tone: 'warn',
      title: 'Falling behind',
      text: `${plural(s.yellowStreak, 'yellow week')} in a row up to week ${last.week}. At ${YELLOW_LIMIT} in a row it counts as red.`,
    }
  }
  return {
    tone: 'good',
    title: 'On track',
    text: `Week ${last.week} was green; ${s.counts.green} of ${plural(s.counts.total, 'graded week')} were green.`,
  }
}

/** 3 = removal, 2 = at risk, 1 = falling behind for a while; 0 = nothing to look at. */
export function severity(s: StandingSummary): 0 | 1 | 2 | 3 {
  if (s.removal) return 3
  if (s.redStreak === 1) return 2
  if (s.yellowStreak >= 2) return 1
  return 0
}

export interface StudentStanding {
  studentId: number
  name: string
  teamName?: string
  mentorId?: number
  mentorName?: string
  summary: StandingSummary
  verdict: Verdict
  severity: 0 | 1 | 2 | 3
}

/** Every graded student's standing, by student. */
export function standingsByStudent(grades: StudentReview[]): Map<number, StudentStanding> {
  const groups = new Map<number, StudentReview[]>()
  for (const g of grades) groups.set(g.studentId, [...(groups.get(g.studentId) ?? []), g])
  const out = new Map<number, StudentStanding>()
  for (const [studentId, rows] of groups) {
    const latest = rows.reduce((a, b) => (b.week > a.week ? b : a))
    const summary = analyseStandings(weeksOf(rows, studentId))
    out.set(studentId, {
      studentId,
      name: latest.studentName,
      ...(latest.teamName ? { teamName: latest.teamName } : {}),
      ...(latest.mentorId !== undefined ? { mentorId: latest.mentorId } : {}),
      ...(latest.mentorName ? { mentorName: latest.mentorName } : {}),
      summary,
      verdict: studentVerdict(summary),
      severity: severity(summary),
    })
  }
  return out
}

/** The students an admin should look at, worst first (removal, at risk, then a run of yellow weeks), then A-Z. */
export function needsAttention(grades: StudentReview[]): StudentStanding[] {
  return [...standingsByStudent(grades).values()]
    .filter((s) => s.severity > 0)
    .sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name))
}

export type CurrentCounts = Record<StandingLevel | 'none', number>

/** How a group of students stands: each by the level of the average of their week grades, or "none" with no grade yet. */
export function currentCounts(studentIds: number[], standings: Map<number, StudentStanding>): CurrentCounts {
  const counts: CurrentCounts = { green: 0, yellow: 0, red: 0, none: 0 }
  for (const id of studentIds) counts[standings.get(id)?.summary.current ?? 'none'] += 1
  return counts
}

/**
 * How the school stands now, in one line: the share of graded students whose average grade is green (a student nobody
 * graded yet is not counted as behind). The bands are a front-end proposal: 70% and up = most on track, 50% and up =
 * many falling behind, below that = most behind.
 */
export function schoolVerdict(counts: CurrentCounts, attention: number): Verdict {
  const graded = counts.green + counts.yellow + counts.red
  if (graded === 0) return { tone: 'none', title: 'No grades yet', text: 'No mentor has graded a week yet.' }
  const share = counts.green / graded
  const rest = attention === 0 ? 'Nobody is at risk.' : `${plural(attention, 'student needs', 'students need')} attention.`
  const ungraded = counts.none === 0 ? '' : ` ${counts.none} not graded yet.`
  const text = `${counts.green} of ${plural(graded, 'graded student')} on track now.${ungraded} ${rest}`
  if (share >= 0.7) return { tone: 'good', title: 'Most students are on track', text }
  if (share >= 0.5) return { tone: 'warn', title: 'Many students are falling behind', text }
  return { tone: 'bad', title: 'Most students are behind', text }
}

/** The share of a student's passed deadlines met on time, or null with none due. */
export const onTimeShare = (s: { onTime: number; eligible: number }) => (s.eligible === 0 ? null : s.onTime / s.eligible)

/** Points earned out of points possible over every scored quiz attempt (weighted, not an average of percentages). */
export function quizShare(quizzes: { scoreTotal: number; possibleTotal: number }[]): number | null {
  const possible = quizzes.reduce((n, q) => n + q.possibleTotal, 0)
  return possible === 0 ? null : quizzes.reduce((n, q) => n + q.scoreTotal, 0) / possible
}

// ---------- mentors and lecturers: the students' 1-5 ratings ----------

export interface RatingSplit {
  /** 4 or 5 */
  positive: number
  /** 3 */
  neutral: number
  /** 1 or 2 */
  negative: number
}

export function ratingSplit(scores: number[]): RatingSplit {
  return {
    positive: scores.filter((s) => s >= 4).length,
    neutral: scores.filter((s) => s === 3).length,
    negative: scores.filter((s) => s <= 2).length,
  }
}

/** Fewer answers than this and the page does not call a person well or poorly rated. */
export const MIN_RATINGS = 3

/**
 * What the students' overall ratings say, in one line. The bands are a front-end proposal: 4 and up = well rated,
 * 3 to 4 = mixed, under 3 = poorly rated.
 */
export function ratingVerdict(avg: number | null, n: number, about: string): Verdict {
  if (n === 0 || avg === null)
    return { tone: 'none', title: 'No ratings yet', text: `Students have not rated ${about} in this period.` }
  const mean = `${avg.toFixed(1)} out of 5 from ${plural(n, 'rating')}`
  if (n < MIN_RATINGS) return { tone: 'none', title: 'Too few ratings', text: `${mean}: too few to tell.` }
  if (avg >= 4) return { tone: 'good', title: 'Well rated', text: `Students rate ${about} ${mean}.` }
  if (avg >= 3) return { tone: 'warn', title: 'Mixed ratings', text: `Students rate ${about} ${mean}.` }
  return { tone: 'bad', title: 'Poorly rated', text: `Students rate ${about} ${mean}.` }
}

// ---------- lecturers ----------

/** The answers about one lecturer's lectures (a lecture taught by several counts for each of them). */
export const reviewsOfLecturer = (rows: AdminLectureReview[], lecturerId: number) =>
  rows.filter((r) => r.lecturers.some((l) => l.id === lecturerId))

/** One row per lecture, newest first. `expected` is keyed by `lectureKey`. */
export function lectureRows(rows: AdminLectureReview[], expected: Record<string, number> = {}): LectureRow[] {
  const groups = new Map<string, AdminLectureReview[]>()
  for (const r of rows) groups.set(lectureKey(r), [...(groups.get(lectureKey(r)) ?? []), r])
  return [...groups.entries()]
    .map(([key, list]): LectureRow => {
      const l = list[0].lecture
      const pace = Object.fromEntries(PACES.map((p) => [p, list.filter((r) => r.pace === p).length])) as Record<Pace, number>
      return {
        key,
        title: l.title,
        startsAt: l.startsAt,
        ...(l.moduleTitle ? { moduleTitle: l.moduleTitle } : {}),
        responses: list.length,
        expected: expected[key] ?? null,
        overall: average(list.map((r) => r.overall)),
        pace,
      }
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

/** Answers out of answers possible over the lectures whose expected count is known; null when none is. */
export function responseRate(lectures: LectureRow[]): number | null {
  const known = lectures.filter((l) => l.expected !== null && l.expected > 0)
  if (known.length === 0) return null
  return known.reduce((n, l) => n + l.responses, 0) / known.reduce((n, l) => n + (l.expected as number), 0)
}

/** "62%", or a dash. */
export const percent = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)
