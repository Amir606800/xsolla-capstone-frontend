import { memo } from 'react'
import { Link } from 'react-router'
import type { CourseModule } from '../../types/course'
import {
  dayOfMonth,
  formatClockTime,
  formatDateTime,
  formatShortDate,
  formatTimeLeft,
  monthShort,
} from '../../utils/date'
import type { ModuleProgress, NextDeadline } from '../../utils/progress'
import { Icon } from '../Icon'
import { ProgressRing } from './ProgressRing'

interface ModuleNodeProps {
  module: CourseModule
  progress: ModuleProgress
  deadline: NextDeadline | null
  /** Not open yet: shown, but not reachable and without its content. */
  locked?: boolean
  /** The module running right now: gets "Opened" / "Due" badges on both sides. */
  active?: boolean
  now: Date
}

const STATUS_LABEL: Record<ModuleProgress['status'], string> = {
  'not-started': 'not started',
  'in-progress': 'in progress',
  submitted: 'submitted, awaiting grade',
  completed: 'completed',
  overdue: 'overdue',
}

function ModuleNodeBase({ module, progress, deadline, locked = false, active = false, now }: ModuleNodeProps) {
  if (locked) {
    const opens = module.opensAt ? formatShortDate(module.opensAt) : ''
    return (
      <div
        className="node node--locked"
        role="group"
        aria-label={`Module ${module.position}: ${module.title}, locked, opens ${opens}`}
      >
        <div className="node__circle">
          <ProgressRing percent={0} size={92} stroke={6}>
            <Icon name="lock" size={28} />
          </ProgressRing>
        </div>
        <span className="node__label" aria-hidden="true">
          <span className="node__title">{module.title}</span>
          <span className="node__percent">Opens {opens}</span>
        </span>
      </div>
    )
  }

  const label =
    `Module ${module.position}: ${module.title}, ${progress.percent}% done, ${STATUS_LABEL[progress.status]}` +
    (active && module.opensAt ? `, current module, opened ${formatShortDate(module.opensAt)}` : '') +
    (deadline ? `, next deadline ${active ? formatDateTime(deadline.dueAt) : formatShortDate(deadline.dueAt)}` : '')

  return (
    <Link
      to={`/courses/${module.id}`}
      className={`node node--${progress.status}${active ? ' node--active' : ''}`}
      aria-label={label}
      aria-current={active ? 'step' : undefined}
    >
      <div className="node__circle">
        <ProgressRing percent={progress.percent} size={92} stroke={6}>
          <Icon name={progress.status === 'completed' ? 'check' : 'courses'} size={30} />
        </ProgressRing>

        {active ? (
          <>
            {module.opensAt && (
              <span className="node__tag node__tag--left" aria-hidden="true">
                <span className="node__tag-label">Opened</span>
                <span className="node__tag-value">
                  {monthShort(module.opensAt)} {dayOfMonth(module.opensAt)}
                </span>
              </span>
            )}
            {deadline && (
              <span
                className={`node__tag node__tag--right${deadline.urgent ? ' is-urgent' : ''}`}
                aria-hidden="true"
              >
                <span className="node__tag-label">Due</span>
                <span className="node__tag-value">
                  {monthShort(deadline.dueAt)} {dayOfMonth(deadline.dueAt)}
                </span>
                <span className="node__tag-time">{formatClockTime(deadline.dueAt)}</span>
              </span>
            )}
          </>
        ) : (
          deadline && (
            <span className={`node__badge${deadline.urgent ? ' is-urgent' : ''}`} aria-hidden="true">
              <span className="node__badge-month">{monthShort(deadline.dueAt)}</span>
              <span className="node__badge-day">{dayOfMonth(deadline.dueAt)}</span>
            </span>
          )
        )}
      </div>
      <span className="node__label" aria-hidden="true">
        <span className="node__title">{module.title}</span>
        <span className="node__percent">{progress.percent}%</span>
        {active && deadline && (
          <span className={`node__when${deadline.urgent ? ' is-urgent' : ''}`}>
            {formatTimeLeft(deadline.dueAt, now)}
          </span>
        )}
      </span>
    </Link>
  )
}

export const ModuleNode = memo(ModuleNodeBase)
