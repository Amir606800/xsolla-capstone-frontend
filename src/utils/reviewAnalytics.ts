import { NO_SESSION_REASONS, REVIEW_STATEMENTS, REVIEW_TOPICS } from '../types/mentorReview'
import type { AdminReview, NoSessionReason, ReviewStatement, ReviewTopic } from '../types/mentorReview'

/** The statements by one word, for column heads and chips (the full sentences are `STATEMENT_LABEL`). */
export const STATEMENT_SHORT: Record<ReviewStatement, string> = {
  clarity: 'Clarity',
  engagement: 'Engagement',
  comfort: 'Comfort',
  time: 'Time',
}

/** An overall score at or below this is "low": the admin should have a look. */
export const LOW_SCORE = 2

export type ReviewShow = 'all' | 'low' | 'comments' | 'no-session'

export interface ReviewFilter {
  /** A module id, or 'all'. */
  moduleId: string
  /** A mentor's user id, or 'all'. */
  mentorId: number | 'all'
  /** Matches the student, the mentor, the team and the comment. */
  query: string
  show: ReviewShow
}

export const ALL_REVIEWS: ReviewFilter = { moduleId: 'all', mentorId: 'all', query: '', show: 'all' }

const has = (r: AdminReview, show: ReviewShow) =>
  show === 'all' || (show === 'low' ? r.overall <= LOW_SCORE : show === 'comments' ? !!r.comment : !r.hadSession)

const matches = (r: AdminReview, query: string) => {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [r.studentName, r.mentorName, r.teamName, r.comment, r.otherTopic].some((v) => v?.toLowerCase().includes(q))
}

/** The reviews that pass the filter, newest first. */
export function filterReviews(reviews: AdminReview[], f: ReviewFilter): AdminReview[] {
  return reviews
    .filter((r) => (f.moduleId === 'all' || r.moduleId === f.moduleId) && (f.mentorId === 'all' || r.mentorId === f.mentorId) && has(r, f.show) && matches(r, f.query))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.studentName.localeCompare(b.studentName))
}

/** The mean, or null when there is nothing to average. */
export function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length
}

/** One decimal, or a dash. */
export const formatScore = (n: number | null) => (n === null ? '—' : n.toFixed(1))
export const formatPercent = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)

export interface ReviewSummary {
  count: number
  /** Reviews that said the 1:1 took place. */
  sessions: number
  /** sessions / count, null with no reviews. */
  sessionRate: number | null
  overall: number | null
  low: number
  withComment: number
  /** The mean of each statement over the reviews that rated it. */
  ratings: Record<ReviewStatement, number | null>
}

export function summarise(rows: AdminReview[]): ReviewSummary {
  const sessions = rows.filter((r) => r.hadSession).length
  const ratings = {} as Record<ReviewStatement, number | null>
  for (const s of REVIEW_STATEMENTS) ratings[s] = average(rows.flatMap((r) => (r.ratings[s] === undefined ? [] : [r.ratings[s] as number])))
  return {
    count: rows.length,
    sessions,
    sessionRate: rows.length ? sessions / rows.length : null,
    overall: average(rows.map((r) => r.overall)),
    low: rows.filter((r) => r.overall <= LOW_SCORE).length,
    withComment: rows.filter((r) => !!r.comment).length,
    ratings,
  }
}

export interface MentorRow extends ReviewSummary {
  mentorId: number
  mentorName: string
  teamName?: string
}

/** One row per mentor, A-Z. The team shown is the one on that mentor's latest review. */
export function byMentor(rows: AdminReview[]): MentorRow[] {
  const groups = new Map<number, AdminReview[]>()
  for (const r of rows) groups.set(r.mentorId, [...(groups.get(r.mentorId) ?? []), r])
  return [...groups.entries()]
    .map(([mentorId, list]) => {
      const latest = list.reduce((a, b) => (b.submittedAt > a.submittedAt ? b : a))
      return { mentorId, mentorName: latest.mentorName, teamName: latest.teamName, ...summarise(list) }
    })
    .sort((a, b) => a.mentorName.localeCompare(b.mentorName))
}

/** How often each topic came up (a review can name several), most often first. Topics never named are left out. */
export function topicCounts(rows: AdminReview[]): { topic: ReviewTopic; count: number }[] {
  return REVIEW_TOPICS.map((topic) => ({ topic, count: rows.filter((r) => r.topics.includes(topic)).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
}

/** Why there was no session, most often first. */
export function reasonCounts(rows: AdminReview[]): { reason: NoSessionReason; count: number }[] {
  return NO_SESSION_REASONS.map((reason) => ({ reason, count: rows.filter((r) => !r.hadSession && r.noSessionReason === reason).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
}
