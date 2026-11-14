import type { SchoolTeam, SchoolUser } from '../types/admin'
import type { CourseModule } from '../types/course'
import { NO_SESSION_REASONS, REVIEW_STATEMENTS, REVIEW_TOPICS } from '../types/mentorReview'
import type { AdminReview, MissingReview, ReviewStatement, ReviewTopic, Score } from '../types/mentorReview'
import { listModules } from './contentEdits'
import { listTeams, listUsers } from './directory'
import { listReviews } from './mentorReviews'

/**
 * Demo reviews for the admin's Mentor reviews page (offline mode only; a real server sends its own).
 * Every student of a team reviews every week that is over, except a few who did not (so "missing" is visible
 * later on), with answers that differ by mentor so the page has something to compare. It is worked out from the
 * directory, the weeks and a fixed seed, so it is the same on every visit; what a student sends in the demo
 * (the stored reviews) is added on top.
 */

/** A small deterministic generator: the same seed always gives the same row of numbers. */
function random(seed: number) {
  let s = (seed * 2654435761) % 4294967296
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const COMMENTS = [
  'More code reviews would help a lot.',
  'We ran out of time before we got to my questions.',
  'Very clear explanations this week, thank you.',
  'I would like the session to start with my questions, not the slides.',
  'Hard to get a slot that fits my schedule.',
  'Great feedback on my homework. I finally understand the logic.',
  'We talked mostly about the project. A career chat next time, please.',
  'My mentor was late and the session was short.',
]

const clamp = (n: number): Score => Math.min(5, Math.max(1, Math.round(n))) as Score

function demoReview(student: SchoolUser, mentor: SchoolUser, team: SchoolTeam, module: CourseModule): AdminReview {
  const next = random(student.id * 101 + module.position * 7 + mentor.id)
  // each mentor has a lean (-1 .. +1) so some are rated higher than others, and a few weeks are rougher
  const lean = ((mentor.id * 37) % 5) / 2 - 1
  const mood = lean * 0.9 + (next() - 0.5) * 2.2
  const hadSession = next() > 0.14
  const base = 3.8 + mood
  const topics: ReviewTopic[] = hadSession
    ? REVIEW_TOPICS.filter((_, i) => next() > 0.62 + i * 0.03).slice(0, 3)
    : []
  if (hadSession && topics.length === 0) topics.push('homework')
  const ratings: Partial<Record<ReviewStatement, Score>> = {}
  if (hadSession) for (const s of REVIEW_STATEMENTS) ratings[s] = clamp(base + (next() - 0.5) * 1.6)
  const overall = clamp(hadSession ? base + (next() - 0.5) : base - 1)
  const closes = module.closesAt ? new Date(module.closesAt).getTime() : Date.now()
  // sent during the weekend before the week closed, spread over the 48 hours
  const sentAt = new Date(closes - Math.round(next() * 40 * 3600 * 1000) - 3600 * 1000)
  const comment = next() > 0.62 ? COMMENTS[Math.floor(next() * COMMENTS.length)] : undefined
  return {
    id: `demo-${student.id}-${module.id}`,
    moduleId: module.id,
    moduleTitle: module.title,
    studentId: student.id,
    studentName: student.name,
    mentorId: mentor.id,
    mentorName: mentor.name,
    teamName: team.name,
    hadSession,
    ...(hadSession ? {} : { noSessionReason: NO_SESSION_REASONS[Math.floor(next() * NO_SESSION_REASONS.length)] }),
    topics,
    ...(topics.includes('other') ? { otherTopic: 'CV review' } : {}),
    ratings,
    overall,
    ...(comment ? { comment } : {}),
    submittedAt: sentAt.toISOString(),
  }
}

/** Every demo review of the weeks that are over, plus what students sent in this browser. */
export function adminReviews(now: Date = new Date()): AdminReview[] {
  const users = new Map(listUsers(now).map((u) => [u.id, u]))
  const teams = listTeams(now)
  const modules = listModules(now).filter((m) => m.closesAt && new Date(m.closesAt) < now)
  const out = new Map<string, AdminReview>()

  for (const team of teams) {
    const mentor = team.mentorId === null ? undefined : users.get(team.mentorId)
    if (!mentor) continue
    for (const id of team.studentIds) {
      const student = users.get(id)
      if (!student) continue
      for (const module of modules) {
        // about one student in twelve did not send this week's review
        if (random(student.id * 31 + module.position)() < 0.08) continue
        const r = demoReview(student, mentor, team, module)
        out.set(`${student.id}:${module.id}`, r)
      }
    }
  }

  // what a student sent in this browser replaces the made-up review of the same week
  const teamOf = new Map(teams.flatMap((t) => t.studentIds.map((id) => [id, t] as const)))
  const titleOf = new Map(listModules(now).map((m) => [m.id, m.title]))
  for (const s of listReviews()) {
    const student = users.get(s.studentId)
    const mentor = s.mentorId === undefined ? undefined : users.get(s.mentorId)
    out.set(`${s.studentId}:${s.moduleId}`, {
      id: `stored-${s.studentId}-${s.moduleId}`,
      moduleId: s.moduleId,
      moduleTitle: titleOf.get(s.moduleId),
      studentId: s.studentId,
      studentName: student?.name ?? `Student #${s.studentId}`,
      mentorId: s.mentorId ?? 0,
      mentorName: mentor?.name ?? 'Mentor',
      teamName: teamOf.get(s.studentId)?.name,
      hadSession: s.hadSession,
      ...(s.noSessionReason ? { noSessionReason: s.noSessionReason } : {}),
      topics: s.topics ?? [],
      ...(s.otherTopic ? { otherTopic: s.otherTopic } : {}),
      ratings: s.ratings ?? {},
      overall: s.overall,
      ...(s.comment ? { comment: s.comment } : {}),
      submittedAt: s.submittedAt,
    })
  }
  return [...out.values()]
}

/** The students in a team with a mentor who have no review for the week (like the server: today's teams, nothing about whether the week is open). */
export function missingReviews(moduleId: string, now: Date = new Date()): MissingReview[] {
  const users = new Map(listUsers(now).map((u) => [u.id, u]))
  const sent = new Set(adminReviews(now).filter((r) => r.moduleId === moduleId).map((r) => r.studentId))
  const out: MissingReview[] = []
  for (const team of listTeams(now)) {
    const mentor = team.mentorId === null ? undefined : users.get(team.mentorId)
    if (!mentor) continue
    for (const id of team.studentIds) {
      const student = users.get(id)
      if (!student || sent.has(id)) continue
      out.push({ studentId: id, studentName: student.name, mentorId: mentor.id, mentorName: mentor.name, teamName: team.name })
    }
  }
  return out
}
