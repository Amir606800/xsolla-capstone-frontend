import { memo } from 'react'
import { Link } from 'react-router'
import type { CourseModule } from '../../types/course'
import { dayOfMonth, formatShortDate, monthShort } from '../../utils/date'
import type { ModuleProgress, NextDeadline } from '../../utils/progress'
import { Icon } from '../Icon'
import { ProgressRing } from './ProgressRing'

interface ModuleNodeProps {
  module: CourseModule
  progress: ModuleProgress
  deadline: NextDeadline | null
}

const STATUS_LABEL: Record<ModuleProgress['status'], string> = {
  'not-started': 'not started',
  'in-progress': 'in progress',
  submitted: 'submitted, awaiting grade',
  completed: 'completed',
  overdue: 'overdue',
}

function ModuleNodeBase({ module, progress, deadline }: ModuleNodeProps) {
  const label =
    `Module ${module.position}: ${module.title}, ${progress.percent}% done, ${STATUS_LABEL[progress.status]}` +
    (deadline ? `, next deadline ${formatShortDate(deadline.dueAt)}` : '')

  return (
    <Link to={`/courses/${module.id}`} className={`node node--${progress.status}`} aria-label={label}>
      <div className="node__circle">
        <ProgressRing percent={progress.percent} size={92} stroke={6}>
          <Icon name={progress.status === 'completed' ? 'check' : 'courses'} size={30} />
        </ProgressRing>
        {deadline && (
          <span className={`node__badge${deadline.urgent ? ' is-urgent' : ''}`} aria-hidden="true">
            <span className="node__badge-month">{monthShort(deadline.dueAt)}</span>
            <span className="node__badge-day">{dayOfMonth(deadline.dueAt)}</span>
          </span>
        )}
      </div>
      <span className="node__label" aria-hidden="true">
        <span className="node__title">{module.title}</span>
        <span className="node__percent">{progress.percent}%</span>
      </span>
    </Link>
  )
}

export const ModuleNode = memo(ModuleNodeBase)
