import { memo } from 'react'
import { STANDING_LABEL, STANDING_LEVELS } from '../utils/standing'
import type { StandingCounts } from '../utils/standing'

/** How the assessed weeks split into green / yellow / red: one stacked bar plus a legend with the counts. */
function StandingBarBase({ counts }: { counts: StandingCounts }) {
  const summary =
    counts.total === 0
      ? 'No weeks rated yet'
      : STANDING_LEVELS.map((l) => `${counts[l]} ${STANDING_LABEL[l].toLowerCase()}`).join(', ')

  return (
    <div className="standing-bar">
      <div className="standing-bar__bar" role="img" aria-label={summary}>
        {STANDING_LEVELS.map((l) =>
          counts[l] > 0 ? (
            <span key={l} className={`standing-bar__part standing-bar__part--${l}`} style={{ flexGrow: counts[l] }} />
          ) : null,
        )}
      </div>
      <ul className="standing-bar__legend" aria-label="Weeks by level">
        {STANDING_LEVELS.map((l) => (
          <li key={l}>
            <span className={`standing-bar__dot standing-bar__dot--${l}`} aria-hidden="true" />
            <strong>{counts[l]}</strong> {STANDING_LABEL[l]}
          </li>
        ))}
      </ul>
    </div>
  )
}

export const StandingBar = memo(StandingBarBase)
