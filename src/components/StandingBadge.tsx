import { memo } from 'react'
import type { StandingLevel } from '../types/standing'
import { STANDING_ICON, STANDING_LABEL } from '../utils/standing'
import { Icon } from './Icon'

/** The big round "where I stand now" badge: ring and text in the colour of the level, grey while nothing is rated. */
function StandingBadgeBase({ standing }: { standing: StandingLevel | null }) {
  return (
    <div
      className={`standing standing--${standing ?? 'none'}`}
      role="img"
      aria-label={standing ? `Current standing: ${STANDING_LABEL[standing]}` : 'Current standing: not rated yet'}
    >
      {standing && <Icon name={STANDING_ICON[standing]} size={28} />}
      <span className="standing__label">{standing ? STANDING_LABEL[standing] : 'Not rated yet'}</span>
    </div>
  )
}

export const StandingBadge = memo(StandingBadgeBase)
