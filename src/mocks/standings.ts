import type { WeeklyStanding } from '../types/standing'
import { buildMockModules } from './courses'

/**
 * The mentor's ratings of the weeks that are finished (weeks 1-5; week 6 is running and is rated at its end).
 * A mix of all three levels, ending with two yellow weeks so the "4 in a row" warning has something to show.
 */
const RATINGS: Pick<WeeklyStanding, 'level' | 'note'>[] = [
  { level: 'green', note: 'Great start. Setup done and you reported on time.' },
  { level: 'red', note: 'No progress report this week. Please tell me in advance if you are away.' },
  { level: 'green', note: 'Back on track, well done.' },
  { level: 'yellow', note: 'Behind on the tasks, but you are catching up.' },
  { level: 'yellow' },
]

/** Each rating is shared at the end of its week. */
export function buildMockStandings(now: Date = new Date()): WeeklyStanding[] {
  const modules = buildMockModules(now)
  return RATINGS.map((r, i) => ({
    week: i + 1,
    level: r.level,
    assessedAt: modules[i].closesAt ?? now.toISOString(),
    ...(r.note ? { note: r.note } : {}),
  }))
}
