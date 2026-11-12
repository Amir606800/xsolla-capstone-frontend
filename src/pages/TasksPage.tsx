import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { AssignmentCard } from '../components/module/AssignmentCard'
import { useCourses } from '../hooks/useCourses'
import { useModuleAccess } from '../hooks/useModuleAccess'
import { FILTER_LABEL, TASK_FILTERS, collectTasks, countTasks, filterTasks, isTaskFilter, sortTasks } from '../utils/tasks'
import type { TaskFilter } from '../utils/tasks'
import '../styles/ui.css'
import '../components/module/module.css'
import './TasksPage.css'
import { Loading } from '../components/loading/Loading'

const EMPTY_TEXT: Record<TaskFilter, string> = {
  all: 'There are no tasks yet.',
  todo: "Nothing to do. You're all caught up.",
  overdue: 'Nothing is overdue.',
  submitted: 'No work is waiting for a grade.',
  graded: 'No graded work yet.',
}

/**
 * "My tasks": every assignment from every open module in one list, with filters.
 * The filters live in the URL (?status=overdue&module=m4), so a view can be linked to and
 * the back button works.
 */
export default function TasksPage() {
  const { status, modules, now, reload, submitAssignment } = useCourses()
  const isLocked = useModuleAccess()
  const [params, setParams] = useSearchParams()

  // tasks of modules that are not open yet stay hidden from students
  const open = useMemo(
    () => modules.filter((m) => !isLocked(m)).sort((a, b) => a.position - b.position),
    [modules, isLocked],
  )
  const tasks = useMemo(() => collectTasks(open, now), [open, now])

  const rawFilter = params.get('status')
  const filter: TaskFilter = isTaskFilter(rawFilter) ? rawFilter : 'all'
  const rawModule = params.get('module')
  const moduleId = open.some((m) => m.id === rawModule) ? rawModule : null

  const counts = useMemo(() => countTasks(tasks, moduleId), [tasks, moduleId])
  const shown = useMemo(() => sortTasks(filterTasks(tasks, filter, moduleId)), [tasks, filter, moduleId])

  function update(next: { status?: TaskFilter; module?: string | null }) {
    const p = new URLSearchParams(params)
    const nextStatus = next.status ?? filter
    const nextModule = next.module === undefined ? moduleId : next.module
    if (nextStatus === 'all') p.delete('status')
    else p.set('status', nextStatus)
    if (nextModule === null) p.delete('module')
    else p.set('module', nextModule)
    setParams(p, { replace: true })
  }

  return (
    <section className="module">
      <div>
        <h1 className="page-title">My tasks</h1>
        <p className="page-subtitle">Everything you have to hand in, in one place</p>
      </div>

      {status === 'loading' && (
        <Loading className="module__state">Loading your tasks…</Loading>
      )}

      {status === 'error' && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load your tasks.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="tasks__filters">
            <div className="view-toggle" role="group" aria-label="Filter by status">
              {TASK_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`view-toggle__btn${filter === f ? ' is-active' : ''}`}
                  aria-pressed={filter === f}
                  onClick={() => update({ status: f })}
                >
                  {FILTER_LABEL[f]}
                  <span className="tasks__count">{counts[f]}</span>
                </button>
              ))}
            </div>

            <label className="tasks__module">
              <span>Module</span>
              <select
                className="tasks__select"
                value={moduleId ?? ''}
                onChange={(e) => update({ module: e.target.value || null })}
              >
                <option value="">All modules</option>
                {open.map((m) => (
                  <option key={m.id} value={m.id}>
                    Module {m.position} · {m.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="card" aria-label="Tasks">
            {shown.length === 0 ? (
              <p className="card__empty">{EMPTY_TEXT[filter]}</p>
            ) : (
              <ul className="assignments">
                {shown.map(({ assignment, module }) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    now={now}
                    onSubmit={submitAssignment}
                    closesAt={module.closesAt}
                    context={`Module ${module.position} · ${module.title}`}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  )
}
