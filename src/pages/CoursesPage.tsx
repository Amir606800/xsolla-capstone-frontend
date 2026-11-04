import { memo, useMemo } from 'react'
import { Link } from 'react-router'
import { StatBar } from '../components/dashboard/StatBar'
import { useCourses } from '../hooks/useCourses'
import type { CourseModule } from '../types/course'
import { formatShortDate } from '../utils/date'
import { moduleProgress, nextDeadline } from '../utils/progress'
import '../styles/ui.css'
import '../components/module/module.css'

const ModuleCard = memo(function ModuleCard({ module, now }: { module: CourseModule; now: Date }) {
  const progress = moduleProgress(module, now)
  const deadline = nextDeadline(module, now)

  return (
    <li>
      <Link to={`/courses/${module.id}`} className="module-card">
        <span className="module-card__eyebrow">Module {module.position}</span>
        <span className="module-card__title">{module.title}</span>
        {module.description && <span className="module-card__desc">{module.description}</span>}
        <StatBar label="Tasks" value={progress.submitted} max={progress.total} />
        <span className="module-card__foot">
          {deadline ? (
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
  const sorted = useMemo(() => [...modules].sort((a, b) => a.position - b.position), [modules])

  return (
    <section className="module">
      <h1 className="page-title">My courses</h1>
      <p className="page-subtitle">All 12 modules of the program</p>

      {status === 'loading' && (
        <p className="module__state" role="status">
          Loading your courses…
        </p>
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
        <ul className="module-cards" aria-label="Modules">
          {sorted.map((m) => (
            <ModuleCard key={m.id} module={m} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}
