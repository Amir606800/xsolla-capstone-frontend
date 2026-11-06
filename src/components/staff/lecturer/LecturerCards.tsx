import { Link } from 'react-router'
import type { CourseModule } from '../../../types/course'
import type { ContentGap, DueTask } from '../../../utils/content'
import { contentCounts } from '../../../utils/content'
import { formatDateTime, formatTimeLeft } from '../../../utils/date'
import { StaffCard } from '../StaffCard'
import { StatTile } from '../StatTile'

/**
 * LECTURER parts of the staff dashboard: they are about writing the course, so only people who
 * can author content (lecturer role, admins) see them.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Tile: the module running now (or the next one), with what it holds. Opens its editor. */
export function ThisWeekTile({ module, running }: { module: CourseModule; running: boolean }) {
  const c = contentCounts(module)
  return (
    <StatTile
      id="lect-focus"
      label={running ? 'This week' : 'Next module'}
      value={`Module ${module.position}`}
      sub={
        <>
          {module.title}
          <br />
          {plural(c.materials, 'material')} · {plural(c.tasks, 'task')} · {plural(c.quizzes, 'quiz', 'quizzes')}
        </>
      }
      to={`/courses/${module.id}`}
    />
  )
}

/** Tile: when the next task is due. */
export function NextDeadlineTile({ next, now }: { next: DueTask | undefined; now: Date }) {
  return (
    <StatTile
      id="lect-next"
      label="Next deadline"
      value={next ? formatTimeLeft(next.task.dueAt, now) : 'None'}
      sub={next ? `${next.task.title} · ${formatDateTime(next.task.dueAt)}` : 'No tasks due ahead'}
      to={next ? `/courses/${next.module.id}` : undefined}
    />
  )
}

/** Tile: how many coming modules still miss content. */
export function GapsTile({ count }: { count: number }) {
  return (
    <StatTile
      id="lect-gaps-tile"
      label="Needs attention"
      value={count === 0 ? 'All set' : plural(count, 'gap')}
      tone={count === 0 ? 'ok' : 'warn'}
      sub={count === 0 ? 'The coming weeks are ready' : 'Modules missing content'}
      to={count === 0 ? undefined : '/courses'}
    />
  )
}

/** Card: which coming modules miss content. Only shown when something is missing. */
export function NeedsAttentionCard({ gaps }: { gaps: ContentGap[] }) {
  return (
    <StaffCard id="lect-gaps" icon="alert" title="Missing content">
      <ul className="list" aria-label="Needs attention">
        {gaps.slice(0, 6).map((g) => (
          <li key={g.id} className="list__row">
            <Link to={`/courses/${g.moduleId}`} className="lect__row-link">
              <span className="list__title">Module {g.position}</span>
              <span className="list__meta">{g.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      {gaps.length > 6 && (
        <p className="card__foot">
          <Link to="/courses">{gaps.length - 6} more in Course content</Link>
        </p>
      )}
    </StaffCard>
  )
}

export function DeadlinesCard({ due, now }: { due: DueTask[]; now: Date }) {
  return (
    <StaffCard id="lect-due" icon="tasks" title="Upcoming deadlines">
      {due.length === 0 ? (
        <p className="card__empty">No deadlines ahead.</p>
      ) : (
        <ul className="list" aria-label="Upcoming deadlines">
          {due.map(({ task, module }) => (
            <li key={task.id} className="list__row">
              <Link to={`/courses/${module.id}`} className="lect__row-link">
                <span className="list__title">{task.title}</span>
                <span className="list__meta">
                  Module {module.position} · {formatDateTime(task.dueAt)}
                </span>
              </Link>
              <span className="chip">{formatTimeLeft(task.dueAt, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </StaffCard>
  )
}
