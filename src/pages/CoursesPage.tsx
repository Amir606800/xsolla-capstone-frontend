import { memo, useMemo } from 'react'
import { Link } from 'react-router'
import { StatBar } from '../components/dashboard/StatBar'
import { Icon } from '../components/Icon'
import { useCourses } from '../hooks/useCourses'
import { useModuleAccess } from '../hooks/useModuleAccess'
import { usePersistedState } from '../hooks/usePersistedState'
import type { CourseModule } from '../types/course'
import { formatShortDate } from '../utils/date'
import { moduleProgress, nextDeadline } from '../utils/progress'
import '../styles/ui.css'
import '../components/module/module.css'
import { Loading } from '../components/loading/Loading'

type ViewMode = 'grid' | 'list'
const VIEW_MODES = ['grid', 'list'] as const

const ModuleCard = memo(function ModuleCard({
  module,
  now,
  locked,
}: {
  module: CourseModule
  now: Date
  locked: boolean
}) {
  if (locked) {
    // Not open yet: visible in the list, but not a link and without any content.
    return (
      <li>
        <div className="module-card is-locked" aria-label={`Module ${module.position}: ${module.title}, locked`}>
          <span className="module-card__text">
            <span className="module-card__eyebrow">Module {module.position}</span>
            <span className="module-card__title">{module.title}</span>
          </span>
          <span className="module-card__foot">
            <span className="pill">
              <Icon name="lock" size={14} /> Opens {module.opensAt ? formatShortDate(module.opensAt) : 'soon'}
            </span>
          </span>
        </div>
      </li>
    )
  }

  const progress = moduleProgress(module, now)
  const deadline = nextDeadline(module, now)

  return (
    <li>
      <Link to={`/courses/${module.id}`} className="module-card">
        <span className="module-card__text">
          <span className="module-card__eyebrow">Module {module.position}</span>
          <span className="module-card__title">{module.title}</span>
          {module.description && <span className="module-card__desc">{module.description}</span>}
        </span>
        <span className="module-card__progress">
          {progress.noTasks ? (
            <span className="list__meta">No tasks this week</span>
          ) : (
            <StatBar label="Tasks" value={progress.submitted} max={progress.total} />
          )}
        </span>
        <span className="module-card__foot">
          {progress.noTasks ? (
            <span className="pill pill--ok">Done: nothing to hand in</span>
          ) : deadline ? (
            <span className={`pill${deadline.urgent ? ' pill--danger' : ''}`}>
              Next due {formatShortDate(deadline.dueAt)}
            </span>
          ) : (
            <span className="pill pill--ok">All submitted</span>
          )}
        </span>
      </Link>
    </li>
  )
})

export default function CoursesPage() {
  const { status, modules, now, reload } = useCourses()
  const isLocked = useModuleAccess()
  const [view, setView] = usePersistedState<ViewMode>('courses_view', 'grid', VIEW_MODES)
  const sorted = useMemo(() => [...modules].sort((a, b) => a.position - b.position), [modules])

  return (
    <section className="module">
      <div className="courses-head">
        <div>
          <h1 className="page-title">My courses</h1>
          <p className="page-subtitle">All 12 modules of the program</p>
        </div>

        <div className="view-toggle" role="group" aria-label="Layout">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`view-toggle__btn${view === mode ? ' is-active' : ''}`}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              <Icon name={mode} size={18} />
              {mode === 'grid' ? 'Grid' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {status === 'loading' && (
        <Loading className="module__state">Loading your courses…</Loading>
      )}
      {status === 'error' && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load your courses.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {status === 'ready' && (
        <ul className={`module-cards module-cards--${view}`} aria-label="Modules">
          {sorted.map((m) => (
            <ModuleCard key={m.id} module={m} now={now} locked={isLocked(m)} />
          ))}
        </ul>
      )}
    </section>
  )
}
