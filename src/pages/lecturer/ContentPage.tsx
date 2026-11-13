import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import type { CourseModule } from '../../types/course'
import { contentCounts, contentGaps, isAssignedTo, modulePhase, PHASE_LABEL } from '../../utils/content'
import { isAdmin } from '../../utils/roles'
import type { ContentGap } from '../../utils/content'
import { formatShortDate } from '../../utils/date'
import '../../styles/ui.css'
import '../../components/module/module.css'
import './lecturer.css'
import { Loading } from '../../components/loading/Loading'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const ModuleRow = memo(function ModuleRow({ module, now, gaps, mine }: { module: CourseModule; now: Date; gaps: ContentGap[]; mine: boolean }) {
  const counts = contentCounts(module)
  const phase = modulePhase(module, now)
  const dates =
    module.opensAt && module.closesAt ? `${formatShortDate(module.opensAt)} - ${formatShortDate(module.closesAt)}` : 'No dates yet'

  return (
    <li>
      <Link to={`/courses/${module.id}`} className={`content-row content-row--${phase}${mine ? ' content-row--mine' : ''}`}>
        <span className="content-row__num" aria-hidden="true">
          {module.position}
        </span>
        <span className="content-row__main">
          <span className="content-row__title">
            Module {module.position} · {module.title}
          </span>
          <span className="content-row__meta">
            {dates} · {plural(counts.materials, 'material')} · {plural(counts.tasks, 'task')} · {plural(counts.quizzes, 'quiz', 'quizzes')}
          </span>
        </span>
        <span className="content-row__tags">
          {mine && (
            <span className="pill pill--mine">
              <Icon name="check" size={14} /> Assigned to you
            </span>
          )}
          <span className={`pill phase phase--${phase}`}>{PHASE_LABEL[phase]}</span>
          {gaps.length > 0 && (
            <span className="pill pill--warn" title={gaps.map((g) => g.text).join('\n')}>
              <Icon name="alert" size={14} /> {plural(gaps.length, 'thing')} to do
            </span>
          )}
        </span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </li>
  )
})

/** Lecturer: the 12 modules of the course, what each holds and what is still missing. */
export default function ContentPage() {
  const { status, modules, now, reload } = useCourses()
  const { user } = useAuth()
  // admins are not assigned to modules: only lecturers get the "assigned to you" marks and the filter
  const lecturer = !isAdmin(user)
  const sorted = useMemo(() => [...modules].sort((a, b) => a.position - b.position), [modules])
  const mineIds = useMemo(() => new Set(sorted.filter((m) => isAssignedTo(m, user?.id)).map((m) => m.id)), [sorted, user?.id])
  // a lecturer with assigned modules starts on those; "All" shows the whole course
  const [only, setOnly] = useState<'mine' | 'all' | null>(null)
  const view = lecturer && mineIds.size > 0 ? (only ?? 'mine') : 'all'
  const shown = view === 'mine' ? sorted.filter((m) => mineIds.has(m.id)) : sorted
  const gapsByModule = useMemo(() => {
    const map = new Map<string, ContentGap[]>()
    for (const g of contentGaps(modules, now)) map.set(g.moduleId, [...(map.get(g.moduleId) ?? []), g])
    return map
  }, [modules, now])
  const todo = [...mineIds].reduce((n, id) => n + (gapsByModule.get(id)?.length ?? 0), 0)

  return (
    <section className="module">
      <div>
        <h1 className="page-title">Course content</h1>
        <p className="page-subtitle">The 12 weekly modules: their dates, materials, tasks and quizzes</p>
      </div>

      {status === 'loading' && (
        <Loading className="module__state">Loading the course…</Loading>
      )}
      {status === 'error' && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load the course.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {status === 'ready' && lecturer && (
        <div className="content-assigned">
          <p className="content-assigned__text" role="status">
            {mineIds.size === 0
              ? 'No modules are assigned to you yet. An admin assigns the weeks you prepare.'
              : `You are assigned to ${plural(mineIds.size, 'module')}: ${sorted
                  .filter((m) => mineIds.has(m.id))
                  .map((m) => m.position)
                  .join(', ')}.${todo > 0 ? ` ${plural(todo, 'thing')} still to do in them.` : ' Nothing is missing in them.'}`}
          </p>
          {mineIds.size > 0 && (
            <div className="content-assigned__filter" role="group" aria-label="Which modules to show">
              <button type="button" className="content-chip" aria-pressed={view === 'mine'} onClick={() => setOnly('mine')}>
                Assigned to me ({mineIds.size})
              </button>
              <button type="button" className="content-chip" aria-pressed={view === 'all'} onClick={() => setOnly('all')}>
                All modules ({sorted.length})
              </button>
            </div>
          )}
        </div>
      )}
      {status === 'ready' && (
        <ul className="content-rows" aria-label="Modules">
          {shown.map((m) => (
            <ModuleRow key={m.id} module={m} now={now} gaps={gapsByModule.get(m.id) ?? []} mine={lecturer && mineIds.has(m.id)} />
          ))}
        </ul>
      )}
    </section>
  )
}
