import { memo } from 'react'
import { Link } from 'react-router'
import { useCourses } from '../../hooks/useCourses'
import { useModuleAccess } from '../../hooks/useModuleAccess'
import { formatTimeLeft } from '../../utils/date'
import { isActiveModule, nextDeadline } from '../../utils/progress'

/** Header shortcut to the module that is running right now, with its next deadline. */
function CurrentModuleChipBase() {
  const { status, modules, now } = useCourses()
  const isLocked = useModuleAccess()
  if (status !== 'ready') return null

  const current = modules.find((m) => isActiveModule(m, now) && !isLocked(m))
  if (!current) return null

  const deadline = nextDeadline(current, now)

  return (
    <Link to={`/courses/${current.id}`} className="now-chip" aria-label={`Current module: ${current.title}`}>
      <span className="now-chip__label">
        Module {current.position} · {current.title}
      </span>
      <span className={`now-chip__sub${deadline?.urgent ? ' is-urgent' : ''}`}>
        {deadline ? `Next due ${formatTimeLeft(deadline.dueAt, now)}` : 'All tasks submitted'}
      </span>
    </Link>
  )
}

export const CurrentModuleChip = memo(CurrentModuleChipBase)
