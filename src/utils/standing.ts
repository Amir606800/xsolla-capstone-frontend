import type { IconName } from '../components/Icon'
import type { StandingLevel, WeeklyStanding } from '../types/standing'

export const STANDING_LEVELS: readonly StandingLevel[] = ['green', 'yellow', 'red']

export const STANDING_LABEL: Record<StandingLevel, string> = {
  green: 'On track',
  yellow: 'Falling behind',
  red: 'No progress',
}

// the icon repeats what the colour says, so a level is clear without seeing colours
export const STANDING_ICON: Record<StandingLevel, IconName> = { green: 'check', yellow: 'clock', red: 'close' }

/** What each level means, in the words of the program rules. */
export const STANDING_MEANING: Record<StandingLevel, string> = {
  green: 'You are on track or exceeding expectations. All good, keep it up!',
  yellow:
    'You are falling behind but putting in effort to catch up. No action straight away, but you have to step up.',
  red: 'No meaningful progress was made, or no progress report was given without appropriate notice.',
}

/**
 * The weight of a level: red 1, yellow 2, green 3. A student's standing is the AVERAGE of their week grades on this
 * scale, like the backend's analytics (grade_average / grade_level), not the grade of the latest week.
 */
export const GRADE_WEIGHT: Record<StandingLevel, number> = { red: 1, yellow: 2, green: 3 }
const LEVEL_OF_WEIGHT: StandingLevel[] = ['red', 'yellow', 'green']

export interface GradeAverage {
  /** The average weight, to one decimal (1 to 3). */
  average: number
  /** The level the average rounds to, half up: under 1.5 is red, 1.5 to under 2.5 is yellow, 2.5 and up is green. */
  level: StandingLevel
  /** How many graded weeks it is over. */
  weeks: number
}

/** The average of week grades and the level it rounds to, or null with no grade. Same rule as the backend. */
export function gradeAverage(levels: readonly StandingLevel[]): GradeAverage | null {
  if (levels.length === 0) return null
  const mean = levels.reduce((sum, l) => sum + GRADE_WEIGHT[l], 0) / levels.length
  const place = Math.min(LEVEL_OF_WEIGHT.length, Math.max(1, Math.floor(mean + 0.5)))
  return { average: Math.round(mean * 10) / 10, level: LEVEL_OF_WEIGHT[place - 1], weeks: levels.length }
}

/** The longest module feedback a mentor writes with a week grade, in characters. */
export const MAX_GRADE_NOTE = 1000

/** 4 weeks of yellow in a row count as red. */
export const YELLOW_LIMIT = 4
/** 2 weeks of red in a row mean removal from the program. */
export const RED_LIMIT = 2

export function parseStandingLevel(value: unknown): StandingLevel | undefined {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return (STANDING_LEVELS as readonly string[]).includes(v) ? (v as StandingLevel) : undefined
}

export interface AnalysedWeek extends WeeklyStanding {
  /** For the rules (warnings, removal): the 4th yellow week in a row counts as red. A screen that lists weeks shows `level`. */
  effective: StandingLevel
  /** True when `effective` is red only because of the 4-yellow rule. */
  escalated: boolean
}

export type StandingCounts = Record<StandingLevel, number> & { total: number }

export interface StandingSummary {
  /** Assessed weeks, oldest first. */
  weeks: AnalysedWeek[]
  /** How the student stands: the level of the AVERAGE of all their week grades (not the latest week). */
  current: StandingLevel | null
  /** The average of the week grades (red 1, yellow 2, green 3), to one decimal; null with no grade. */
  average: number | null
  /** Yellow weeks in a row up to the latest week (0-3: the 4th turns red and starts over). */
  yellowStreak: number
  /** Red weeks in a row up to the latest week (an escalated week counts). */
  redStreak: number
  /** Two red weeks in a row: removal from the program. */
  removal: boolean
  /** Weeks per level, as graded (the weeks list shows the same colours). */
  counts: StandingCounts
}

/**
 * Applies the program rules to the mentor's weekly ratings:
 *  - 4 consecutive yellow weeks escalate to red (that 4th week counts as red);
 *  - 2 consecutive red weeks mean removal from the program;
 *  - a green week, or a gap between weeks, ends any run.
 * Weeks that have not been assessed yet are simply not in the list.
 */
export function analyseStandings(ratings: WeeklyStanding[]): StandingSummary {
  const byWeek = new Map<number, WeeklyStanding>()
  for (const r of ratings) byWeek.set(r.week, r) // one rating per week; the last one wins
  const ordered = [...byWeek.values()].sort((a, b) => a.week - b.week)

  const weeks: AnalysedWeek[] = []
  const counts: StandingCounts = { green: 0, yellow: 0, red: 0, total: 0 }
  let yellowRun = 0
  let redRun = 0
  let previous: number | null = null

  for (const r of ordered) {
    if (previous === null || r.week !== previous + 1) {
      yellowRun = 0
      redRun = 0
    }
    previous = r.week

    let effective: StandingLevel = r.level
    let escalated = false

    if (r.level === 'green') {
      yellowRun = 0
      redRun = 0
    } else if (r.level === 'yellow') {
      redRun = 0
      yellowRun += 1
      if (yellowRun >= YELLOW_LIMIT) {
        effective = 'red'
        escalated = true
        yellowRun = 0
        redRun = 1
      }
    } else {
      yellowRun = 0
      redRun += 1
    }

    counts[r.level] += 1
    counts.total += 1
    weeks.push({ ...r, effective, escalated })
  }

  const avg = gradeAverage(weeks.map((w) => w.level))
  return {
    weeks,
    current: avg?.level ?? null,
    average: avg?.average ?? null,
    yellowStreak: yellowRun,
    redStreak: redRun,
    removal: redRun >= RED_LIMIT,
    counts,
  }
}

export interface StandingAlert {
  tone: 'warning' | 'danger'
  text: string
}

/** The warning a student should see for their current run of weeks, or null when all is fine. */
export function standingAlert(summary: StandingSummary): StandingAlert | null {
  if (summary.removal) {
    return {
      tone: 'danger',
      text: `${RED_LIMIT} red weeks in a row mean removal from the program. Please talk to your mentor.`,
    }
  }
  if (summary.redStreak === 1) {
    const last = summary.weeks[summary.weeks.length - 1]
    return {
      tone: 'danger',
      text: `${last?.escalated ? `${YELLOW_LIMIT} yellow weeks in a row count as red. ` : ''}One more red week in a row means removal from the program.`,
    }
  }
  if (summary.yellowStreak >= 1) {
    const n = summary.yellowStreak
    const left = YELLOW_LIMIT - n
    return {
      tone: 'warning',
      text:
        left === 1
          ? `${n} yellow weeks in a row. One more yellow week counts as red. You have to step up.`
          : `${n} yellow ${n === 1 ? 'week' : 'weeks'} in a row. At ${YELLOW_LIMIT} in a row it counts as red.`,
    }
  }
  return null
}
