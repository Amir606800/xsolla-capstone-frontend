import { memo, useMemo } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { useCourses } from '../../hooks/useCourses'
import type { CourseModule } from '../../types/course'
import { contentCounts, contentGaps, modulePhase, PHASE_LABEL } from '../../utils/content'
import type { ContentGap } from '../../utils/content'
import { formatShortDate } from '../../utils/date'
import '../../styles/ui.css'
import '../../components/module/module.css'
import './lecturer.css'
import { Loading } from '../../components/loading/Loading'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const ModuleRow = memo(function ModuleRow({ module, now, gaps }: { module: CourseModule; now: Date; gaps: ContentGap[] }) {
  const counts = contentCounts(module)
  const phase = modulePhase(module, now)
  const dates =
    module.opensAt && module.closesAt ? `${formatShortDate(module.opensAt)} - ${formatShortDate(module.closesAt)}` : 'No dates yet'

  return (
    <li>
      <Link to={`/courses/${module.id}`} className={`content-row content-row--${phase}`}>
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
  const sorted = useMemo(() => [...modules].sort((a, b) => a.position - b.position), [modules])
  const gapsByModule = useMemo(() => {
    const map = new Map<string, ContentGap[]>()
    for (const g of contentGaps(modules, now)) map.set(g.moduleId, [...(map.get(g.moduleId) ?? []), g])
    return map
  }, [modules, now])

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
      {status === 'ready' && (
        <ul className="content-rows" aria-label="Modules">
          {sorted.map((m) => (
            <ModuleRow key={m.id} module={m} now={now} gaps={gapsByModule.get(m.id) ?? []} />
          ))}
        </ul>
      )}
    </section>
  )
}
