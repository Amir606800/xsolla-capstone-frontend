import { Link, useParams } from 'react-router'
import { Icon } from '../components/Icon'
import { AssignmentCard } from '../components/module/AssignmentCard'
import { ModuleHeader } from '../components/module/ModuleHeader'
import { QuizzesCard } from '../components/module/QuizzesCard'
import { ResourceList } from '../components/module/ResourceList'
import { useCourses } from '../hooks/useCourses'
import { useModuleAccess } from '../hooks/useModuleAccess'
import { formatDateTime } from '../utils/date'
import { quizzesOf } from '../utils/content'
import { assignmentsOf, resourcesOf } from '../utils/progress'
import '../styles/ui.css'
import '../components/module/module.css'
import { Loading } from '../components/loading/Loading'

export default function ModulePage() {
  const { moduleId } = useParams()
  const { status, modules, now, reload, submitAssignment } = useCourses()
  const isLocked = useModuleAccess()

  if (status === 'loading') {
    return (
      <Loading className="module__state">Loading module…</Loading>
    )
  }

  if (status === 'error') {
    return (
      <div className="module__state" role="alert">
        <p>We couldn&apos;t load this module.</p>
        <button type="button" className="btn" onClick={reload}>
          Try again
        </button>
      </div>
    )
  }

  const module = modules.find((m) => m.id === moduleId)
  if (!module) {
    return (
      <div className="module__state">
        <h1 className="page-title">Module not found</h1>
        <p>It may have been removed or you don&apos;t have access to it.</p>
        <Link to="/courses" className="btn">
          Back to my courses
        </Link>
      </div>
    )
  }

  // Typing the URL of a future module must not reveal its content to a student.
  if (isLocked(module)) {
    return (
      <div className="module__state module__locked">
        <Icon name="lock" size={32} />
        <h1 className="page-title">{module.title}</h1>
        <p>
          This module opens on <strong>{module.opensAt ? formatDateTime(module.opensAt) : 'a later date'}</strong>.
          Its materials and tasks will appear here then.
        </p>
        <Link to="/courses" className="btn">
          Back to my courses
        </Link>
      </div>
    )
  }

  const assignments = assignmentsOf(module)
  const resources = resourcesOf(module)

  return (
    <div className="module">
      <ModuleHeader module={module} now={now} />

      <div className="module__grid">
        <section className="card" aria-labelledby="assignments-title">
          <header className="card__head">
            <span className="card__icon card__icon--accent">
              <Icon name="tasks" size={20} />
            </span>
            <h2 id="assignments-title">Assignments</h2>
          </header>
          {assignments.length === 0 ? (
            <p className="card__empty">No assignments in this module.</p>
          ) : (
            <ul className="assignments">
              {assignments.map((a) => (
                <AssignmentCard key={a.id} assignment={a} now={now} onSubmit={submitAssignment} closesAt={module.closesAt} />
              ))}
            </ul>
          )}
        </section>

        <div className="module__side">
          <ResourceList resources={resources} />
          <QuizzesCard quizzes={quizzesOf(module)} />
        </div>
      </div>
    </div>
  )
}
