import { memo } from 'react'
import type { AnalysedWeek } from '../utils/standing'
import { STANDING_LABEL } from '../utils/standing'

/** The program at a glance: one square per week, coloured by the mentor's rating (grey = not rated yet). */
function WeekTilesBase({ totalWeeks, weeks }: { totalWeeks: number; weeks: AnalysedWeek[] }) {
  const byWeek = new Map(weeks.map((w) => [w.week, w]))

  return (
    <ol className="week-tiles" aria-label="Weekly standing">
      {Array.from({ length: totalWeeks }, (_, i) => {
        const week = i + 1
        const rated = byWeek.get(week)
        const label = rated
          ? `Week ${week}: ${STANDING_LABEL[rated.effective]}${rated.escalated ? ' (4th yellow week in a row)' : ''}`
          : `Week ${week}: not rated yet`
        return (
          <li
            key={week}
            className={`week-tile week-tile--${rated ? rated.effective : 'none'}`}
            aria-label={label}
            title={label}
          >
            {week}
          </li>
        )
      })}
    </ol>
  )
}

export const WeekTiles = memo(WeekTilesBase)
