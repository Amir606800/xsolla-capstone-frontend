import type { CourseModule } from '../types/course'
import type { MentorReview, NoSessionReason, ReviewStatement, ReviewTopic, ReviewedWeek, Score } from '../types/mentorReview'
import { REVIEW_STATEMENTS } from '../types/mentorReview'

export const TOPIC_LABEL: Record<ReviewTopic, string> = {
  goals: 'Development goals and progress review',
  homework: 'Homework defense and code logic',
  lecture: 'Lecture material clarification',
  project: 'Project / capstone guidance',
  career: 'Personal check-in and career advice',
  other: 'Other',
}

export const NO_SESSION_LABEL: Record<NoSessionReason, string> = {
  'mentor-unavailable': 'My mentor was not available',
  'student-unavailable': 'I could not make it',
  'not-scheduled': 'No session was scheduled',
  other: 'Another reason',
}

export const STATEMENT_LABEL: Record<ReviewStatement, string> = {
  clarity: "The mentor's guidance was clear and useful",
  engagement: 'My mentor was actively engaged in helping me, not just present',
  comfort: 'I felt comfortable asking questions and getting support',
  time: 'I had enough time with my mentor to cover what I needed',
}

export const SCORES: Score[] = [1, 2, 3, 4, 5]
export const MAX_COMMENT = 1000
export const MAX_OTHER_TOPIC = 120

/** The review a student owes: for which week, and whether the LMS is locked until it is sent. */
export interface ReviewDue {
  module: CourseModule
  /** True once the week is over: the student can do nothing else first. False = weekend reminder only. */
  locked: boolean
}

const isWeekend = (d: Date) => d.getDay() === 6 || d.getDay() === 0

/**
 * Which review the student owes right now, if any.
 * - The LAST week that is over and not reviewed locks the LMS (older weeks are not asked for again).
 * - Otherwise, on Saturday and Sunday of the running week, that week's review is open as a reminder.
 * Weeks without dates cannot be "over", so they never ask for a review.
 */
export function reviewDue(modules: CourseModule[], reviewed: ReviewedWeek[], now: Date, { weekend = isWeekend(now) } = {}): ReviewDue | null {
  const done = new Set(reviewed.map((r) => r.moduleId))
  const dated = modules.filter((m) => m.opensAt && m.closesAt)
  const finished = dated.filter((m) => new Date(m.closesAt as string) < now).sort((a, b) => (b.closesAt as string).localeCompare(a.closesAt as string))
  const last = finished[0]
  if (last && !done.has(last.id)) return { module: last, locked: true }

  const running = dated.find((m) => new Date(m.opensAt as string) <= now && now <= new Date(m.closesAt as string))
  if (running && weekend && !done.has(running.id)) return { module: running, locked: false }
  return null
}

/** What the student has filled in so far; nothing is chosen at the start. */
export interface ReviewDraft {
  hadSession: boolean | null
  noSessionReason: NoSessionReason | ''
  topics: ReviewTopic[]
  otherTopic: string
  ratings: Partial<Record<ReviewStatement, Score>>
  overall: Score | null
  comment: string
}

export const emptyDraft = (): ReviewDraft => ({ hadSession: null, noSessionReason: '', topics: [], otherTopic: '', ratings: {}, overall: null, comment: '' })

export type ReviewErrors = Partial<Record<'hadSession' | 'noSessionReason' | 'topics' | 'otherTopic' | 'ratings' | 'overall' | 'comment', string>>

export function validateReview(d: ReviewDraft): ReviewErrors {
  const e: ReviewErrors = {}
  if (d.hadSession === null) e.hadSession = 'Choose yes or no.'
  if (d.hadSession === false && !d.noSessionReason) e.noSessionReason = 'Choose the reason.'
  if (d.hadSession === true) {
    if (d.topics.length === 0) e.topics = 'Choose at least one topic.'
    if (d.topics.includes('other') && !d.otherTopic.trim()) e.otherTopic = 'Say what the other topic was.'
    if (REVIEW_STATEMENTS.some((s) => d.ratings[s] === undefined)) e.ratings = 'Rate every statement.'
  }
  if (d.overall === null) e.overall = 'Choose a rating.'
  if (d.comment.length > MAX_COMMENT) e.comment = `Keep it under ${MAX_COMMENT} characters.`
  return e
}

/** A valid draft -> the review that is sent. Parts that do not apply to the answer are left out. */
export function draftToReview(d: ReviewDraft, moduleId: string): MentorReview {
  const comment = d.comment.trim()
  const base = { moduleId, overall: d.overall as Score, ...(comment ? { comment } : {}) }
  if (!d.hadSession) return { ...base, hadSession: false, noSessionReason: d.noSessionReason as NoSessionReason }
  return {
    ...base,
    hadSession: true,
    topics: d.topics,
    ...(d.topics.includes('other') ? { otherTopic: d.otherTopic.trim() } : {}),
    ratings: d.ratings as Record<ReviewStatement, Score>,
  }
}
