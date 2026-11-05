import { memo } from 'react'
import type { StandingLevel } from '../types/standing'
import { STANDING_ICON, STANDING_LABEL } from '../utils/standing'
import { Icon } from './Icon'

/** A weekly standing: green (on track), yellow (falling behind) or red (no progress). */
function StandingPillBase({ level }: { level: StandingLevel }) {
  return (
    <span className={`pill standing-pill standing-pill--${level}`}>
      <Icon name={STANDING_ICON[level]} size={14} />
      {STANDING_LABEL[level]}
    </span>
  )
}

export const StandingPill = memo(StandingPillBase)
