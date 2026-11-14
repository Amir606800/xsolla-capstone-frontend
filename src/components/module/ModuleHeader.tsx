import { memo } from 'react'
import { Link } from 'react-router'
import type { CourseModule } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { moduleProgress, moduleWindow } from '../../utils/progress'
import { Icon } from '../Icon'
import { StatBar } from '../dashboard/StatBar'

function ModuleHeaderBase({ module, now }: { module: CourseModule; now: Date }) {
  const progress = moduleProgress(module, now)
  const { opensAt, dueAt } = moduleWindow(module)

  return (
    <header className="module-head">
      <Link to="/courses" className="module-head__back">
        <Icon name="back" size={16} /> My courses
      </Link>

      <p className="module-head__eyebrow">Module {module.position}</p>
      <h1 className="page-title">{module.title}</h1>
      {module.description && <p className="page-subtitle">{module.description}</p>}

      <dl className="module-head__meta">
        {opensAt && (
          <div>
            <dt>Opened</dt>
            <dd>{formatDateTime(opensAt)}</dd>
          </div>
        )}
        {dueAt && (
          <div>
            <dt>Due</dt>
            <dd>{formatDateTime(dueAt)}</dd>
          </div>
        )}
        <div className="module-head__progress">
          {progress.noTasks ? (
            <span className="pill pill--ok">
              <Icon name="check" size={14} /> Nothing to hand in: this module counts as done
            </span>
          ) : (
            <StatBar label="Tasks submitted" value={progress.submitted} max={progress.total} />
          )}
        </div>
      </dl>
    </header>
  )
}

export const ModuleHeader = memo(ModuleHeaderBase)
