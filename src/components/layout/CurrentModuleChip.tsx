import { memo } from 'react'
import { Link } from 'react-router'
import { useCurrentModule } from '../../hooks/useCurrentModule'
import { formatTimeLeft } from '../../utils/date'
import { nextDeadline } from '../../utils/progress'

/** Header shortcut to the module that is running right now, with its next deadline. */
function CurrentModuleChipBase() {
  const { current, now } = useCurrentModule()
  if (!current) return null

  const deadline = nextDeadline(current, now)
  const left = deadline ? formatTimeLeft(deadline.dueAt, now) : ''
  // a task that is already late is not "next due": say how late it is
  const overdue = deadline ? new Date(deadline.dueAt) < now : false
  const text = !deadline
    ? 'All tasks submitted'
    : overdue
      ? left === 'just overdue'
        ? 'Just overdue'
        : `Overdue by ${left.replace(/ overdue$/, '')}`
      : left === 'due now'
        ? 'Due now'
        : `Next due ${left}`

  return (
    <Link to={`/courses/${current.id}`} className="now-chip" aria-label={`Current module: ${current.title}`}>
      <span className="now-chip__label">
        Module {current.position} · {current.title}
      </span>
      <span className={`now-chip__sub${deadline?.urgent ? ' is-urgent' : ''}`}>{text}</span>
    </Link>
  )
}

export const CurrentModuleChip = memo(CurrentModuleChipBase)
