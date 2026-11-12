import { memo, useId, useState } from 'react'
import type { SubmitPayload } from '../../api/courses'
import type { AssignmentItem } from '../../types/course'
import { formatDateTime, formatTimeLeft } from '../../utils/date'
import { assignmentStatus } from '../../utils/progress'
import { GradedPill } from '../GradedPill'
import { Icon } from '../Icon'
import { SubmissionPanel } from './SubmissionPanel'

interface AssignmentCardProps {
  assignment: AssignmentItem
  now: Date
  onSubmit: (assignmentId: string, payload: SubmitPayload) => Promise<void>
  /** When the module closes (handing in is over from then on). */
  closesAt?: string
  /** Where the task belongs (e.g. "Module 6 · Go Basics"), shown in lists that mix several modules. */
  context?: string
}

function StatusPill({ assignment, now }: { assignment: AssignmentItem; now: Date }) {
  const status = assignmentStatus(assignment, now)
  switch (status) {
    case 'graded':
      return <GradedPill />
    case 'submitted':
      return <span className="pill pill--ok">Submitted</span>
    case 'overdue':
      return <span className="pill pill--danger">Overdue</span>
    default:
      return <span className="pill">{formatTimeLeft(assignment.dueAt, now)}</span>
  }
}

function AssignmentCardBase({ assignment, now, onSubmit, closesAt, context }: AssignmentCardProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <li className={`assignment${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="assignment__head"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="assignment__title-wrap">
          <span className="list__title">{assignment.title}</span>
          <span className="list__meta">
            {context ? `${context} · ` : ''}Due {formatDateTime(assignment.dueAt)}
          </span>
        </span>
        <StatusPill assignment={assignment} now={now} />
        <Icon name="chevron" size={18} />
      </button>

      {open && (
        <div id={panelId} className="assignment__body">
          {assignment.description && <p>{assignment.description}</p>}
          {assignment.requirements && assignment.requirements.length > 0 && (
            <>
              <h4 className="submission__title">Requirements</h4>
              <ul className="assignment__requirements">
                {assignment.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
          <SubmissionPanel assignment={assignment} onSubmit={onSubmit} now={now} closesAt={closesAt} />
        </div>
      )}
    </li>
  )
}

export const AssignmentCard = memo(AssignmentCardBase)
