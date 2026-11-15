import type { StandingLevel } from './standing'

/** Inclusive reporting period as school dates (YYYY-MM-DD). */
export interface AnalyticsPeriod {
  from: string
  to: string
}

/** A student or mentor in the analytics selectors and headers. */
export interface AnalyticsPerson {
  id: number
  name: string
  email?: string
}

/** One week's (module's) standing counts. `total` counts only recorded grades. */
export interface AnalyticsWeek {
  moduleId: number
  moduleTitle: string
  /** ISO timestamp of the module's start; the week's school date. */
  opensAt: string
  green: number
  yellow: number
  red: number
  total: number
}

/** Deadline classification of a student's eligible assignments. */
export interface AssignmentStatus {
  onTime: number
  late: number
  missing: number
  eligible: number
}

/** One module's weighted quiz accuracy. `accuracy` is null when no attempt had points. */
export interface QuizAccuracy {
  moduleId: number
  moduleTitle: string
  opensAt: string
  scoreTotal: number
  possibleTotal: number
  accuracy: number | null
  attemptCount: number
}

export type FeedbackDimensionKey = 'clarity' | 'engagement' | 'comfort' | 'time'

/** One rated dimension's mean and the number of ratings behind it. */
export interface FeedbackDimension {
  dimension: FeedbackDimensionKey
  average: number | null
  count: number
}

export interface OverviewReport {
  period: AnalyticsPeriod
  generatedAt: string
  weeks: AnalyticsWeek[]
}

export interface StudentReport {
  student: AnalyticsPerson
  period: AnalyticsPeriod
  generatedAt: string
  status: AssignmentStatus
  quizzes: QuizAccuracy[]
}

export interface MentorReport {
  mentor: AnalyticsPerson
  period: AnalyticsPeriod
  generatedAt: string
  feedback: FeedbackDimension[]
  weeks: AnalyticsWeek[]
  /** "current_roster" until the schema keeps mentor assignment history. */
  attribution: string
}

export type StandingKey = Extract<StandingLevel, 'green' | 'yellow' | 'red'>
