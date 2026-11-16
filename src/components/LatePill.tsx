import { memo } from 'react'
import { Icon } from './Icon'

/** Work handed in after the student's deadline (08:00 on the day of their 1:1): it makes the week grade red. */
function LatePillBase() {
  return (
    <span className="pill pill--danger late-pill" title="Handed in after the deadline: the week grade is red">
      <Icon name="clock" size={14} />
      Late submission
    </span>
  )
}

export const LatePill = memo(LatePillBase)
