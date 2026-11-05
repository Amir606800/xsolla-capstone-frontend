/**
 * Every week the student's mentor rates their performance on a 3-level scale:
 *   green  = on track or exceeding expectations
 *   yellow = falling behind, but putting in effort to catch up
 *   red    = no meaningful progress, or no progress report given without appropriate notice
 * (see utils/standing.ts for the rules that connect the weeks)
 */
export type StandingLevel = 'green' | 'yellow' | 'red'

/** The mentor's rating of one week. `week` is the module position (1-12): a module is a week. */
export interface WeeklyStanding {
  week: number
  level: StandingLevel
  /** When the mentor shared it (end of the week). */
  assessedAt: string // ISO
  /** Optional comment from the mentor. */
  note?: string
}
