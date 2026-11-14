import { memo, useEffect, useId, useRef, useState } from 'react'
import type { TeamQuizResults } from '../../api/quizResults'
import { Icon } from '../../components/Icon'
import { StandingPill } from '../../components/StandingPill'
import { WeekGradeItem } from '../../components/staff/mentor/WeekGradeItem'
import { WorkItem } from '../../components/staff/mentor/WorkItem'
import { Avatar } from '../../components/team/People'
import type { CourseModule } from '../../types/course'
import type { TeamSubmission } from '../../types/review'
import type { StandingLevel, WeeklyStanding } from '../../types/standing'
import type { Person } from '../../types/team'
import { formatDateTime } from '../../utils/date'
import { gradeLocked, quizzesOf, rowId, studentWeek, tasksOf, weekGradeOf, weekPhase, workRow } from '../../utils/review'
import type { StandingIndex } from '../../utils/review'
import { STANDING_LABEL, STANDING_LEVELS } from '../../utils/standing'

/** What each grade means, in a few words (the student's own page explains it at length). */
const MEANING: Record<StandingLevel, string> = {
  green: 'On track or exceeding expectations.',
  yellow: 'Falling behind, but working to catch up.',
  red: 'No real progress, or no report without notice.',
}

/** An "i" button in the grade card's header: a small box with the meaning of the three grades; closes on Escape or an outside click. */
function GradeHelp() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="ghelp" ref={box}>
      <button
        type="button"
        className="icon-btn ghelp__btn"
        aria-label="What the grades mean"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="info" size={18} />
      </button>
      {open && (
        <div className="ghelp__box" id={id} role="region" aria-label="What the grades mean">
          <ul className="ghelp__list">
            {STANDING_LEVELS.map((l) => (
              <li key={l}>
                <StandingPill level={l} />
                <span>{MEANING[l]}</span>
              </li>
            ))}
          </ul>
          <p className="ghelp__note">One grade for the whole week. 4 yellow weeks in a row count as red; 2 red weeks in a row mean removal.</p>
        </div>
      )}
    </span>
  )
}

/** Every week of the course as a small dot, coloured by the student's grade; the open week is ringed. */
function WeekDots({
  modules,
  student,
  grades,
  current,
  now,
  onPick,
}: {
  modules: CourseModule[]
  student: Person
  grades: StandingIndex
  current: string
  now: Date
  /** Makes the dots buttons that switch the week (on the student's page). */
  onPick?: (moduleId: string) => void
}) {
  const levelOf = (m: CourseModule): StandingLevel | 'none' | 'later' =>
    weekPhase(m, now) === 'upcoming' ? 'later' : (weekGradeOf(grades, student.id, m.position)?.level ?? 'none')
  const label = (m: CourseModule) => {
    const l = levelOf(m)
    return `Week ${m.position}: ${l === 'later' ? 'not started' : l === 'none' ? 'not graded' : STANDING_LABEL[l].toLowerCase()}`
  }

  if (onPick) {
    return (
      <nav className="gweeks gweeks--big" aria-label={`${student.name}'s weeks`}>
        {modules.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`gweeks__dot gweeks__dot--${levelOf(m)}`}
            aria-pressed={m.id === current}
            aria-label={label(m)}
            title={label(m)}
            onClick={() => onPick(m.id)}
          >
            {m.position}
          </button>
        ))}
      </nav>
    )
  }
  return (
    <span className="gweeks" role="img" aria-label={modules.map(label).join(', ')}>
      {modules.map((m) => (
        <span key={m.id} className={`gweeks__dot gweeks__dot--${levelOf(m)}${m.id === current ? ' is-current' : ''}`} title={label(m)} />
      ))}
    </span>
  )
}

/**
 * MENTOR: one student of the team for the chosen week, in the grid. The week grade, every week's grade as dots, how much
 * of the week's work is handed in (and what is new or missing), and the quizzes. The whole card opens the student's page.
 */
export const StudentCard = memo(function StudentCard({
  student,
  week,
  modules,
  grades,
  workIndex,
  seesWork,
  quizResults,
  now,
  onOpen,
}: {
  student: Person
  week: CourseModule
  modules: CourseModule[]
  grades: StandingIndex
  workIndex: Map<string, TeamSubmission>
  seesWork: boolean
  quizResults: TeamQuizResults | null
  now: Date
  onOpen: () => void
}) {
  const grade = weekGradeOf(grades, student.id, week.position)
  const started = weekPhase(week, now) !== 'upcoming'
  const finished = weekPhase(week, now) === 'finished'
  const w = studentWeek(week, student, workIndex, now)
  const quizzes = quizzesOf(week)
  const taken = quizResults ? quizzes.filter((q) => quizResults[student.id]?.[q.id]).length : 0
  const needsGrade = finished && !grade

  return (
    <li>
      <button
        type="button"
        className={`gcard${needsGrade ? ' gcard--due' : ''}`}
        onClick={onOpen}
        aria-label={`Open ${student.name}'s week ${week.position}`}
      >
        <span className="gcard__top">
          <Avatar name={student.name} />
          <span className="gcard__who">
            <span className="gcard__name">{student.name}</span>
            {grade ? (
              <StandingPill level={grade.level} />
            ) : (
              <span className={`chip${needsGrade ? ' chip--review' : ''}`}>{started ? 'Not graded' : 'Not started'}</span>
            )}
          </span>
        </span>

        <WeekDots modules={modules} student={student} grades={grades} current={week.id} now={now} />

        <span className="gcard__stats">
          {seesWork && (
            <span className="gcard__stat">
              <Icon name="tasks" size={16} />
              {w.total === 0 ? 'No tasks' : `${w.done}/${w.total} handed in`}
            </span>
          )}
          {quizzes.length > 0 && quizResults && (
            <span className="gcard__stat">
              <Icon name="sparkle" size={16} />
              {`Quiz ${taken}/${quizzes.length}`}
            </span>
          )}
        </span>

        {(w.fresh > 0 || w.missing > 0 || needsGrade) && (
          <span className="gcard__flags">
            {needsGrade && <span className="chip chip--review">Week grade due</span>}
            {seesWork && w.fresh > 0 && <span className="chip chip--review">{w.fresh} new</span>}
            {seesWork && w.missing > 0 && <span className="chip chip--danger">{w.missing} missing</span>}
          </span>
        )}

        <span className="gcard__open" aria-hidden="true">
          Open <Icon name="chevron-right" size={16} />
        </span>
      </button>
    </li>
  )
})

/**
 * MENTOR: one student's week, on a page of its own. Their tasks (what they handed in, every version, and the comment) on the
 * left; the week grade and the week's quizzes beside it. Arrows go to the next student, the dots to another week.
 */
export function StudentWeekView({
  student,
  students,
  week,
  modules,
  grades,
  theirWeeks,
  workIndex,
  seesWork,
  gradeDetails,
  quizResults,
  now,
  openWork,
  onBack,
  onStudent,
  onWeek,
  onToggleWork,
  onComment,
  onGrade,
}: {
  student: Person
  students: Person[]
  week: CourseModule
  modules: CourseModule[]
  grades: StandingIndex
  theirWeeks: WeeklyStanding[]
  workIndex: Map<string, TeamSubmission>
  seesWork: boolean
  gradeDetails: boolean
  quizResults: TeamQuizResults | null
  now: Date
  openWork: string | null
  onBack: () => void
  onStudent: (id: number) => void
  onWeek: (moduleId: string) => void
  onToggleWork: (id: string) => void
  onComment: (taskId: string, title: string, text: string) => Promise<void>
  onGrade: (level: StandingLevel, note: string) => Promise<void>
}) {
  const at = students.findIndex((s) => s.id === student.id)
  const prev = at > 0 ? students[at - 1] : undefined
  const next = at >= 0 && at < students.length - 1 ? students[at + 1] : undefined
  const phase = weekPhase(week, now)
  const tasks = tasksOf(week)
  const w = studentWeek(week, student, workIndex, now)
  const quizzes = quizzesOf(week)

  return (
    <div className="gview">
      <div className="gview__bar">
        <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
          <Icon name="back" size={16} /> All students
        </button>
        <span className="gview__pager">
          <button
            type="button"
            className="icon-btn"
            onClick={() => prev && onStudent(prev.id)}
            disabled={!prev}
            aria-label={prev ? `Previous student: ${prev.name}` : 'No previous student'}
          >
            <Icon name="chevron-left" size={18} />
          </button>
          <span className="list__meta">
            {at + 1} of {students.length}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => next && onStudent(next.id)}
            disabled={!next}
            aria-label={next ? `Next student: ${next.name}` : 'No next student'}
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </span>
      </div>

      <header className="gview__head">
        <Avatar name={student.name} />
        <div className="gview__who">
          <h2 className="gview__name">{student.name}</h2>
          <a className="list__meta" href={`mailto:${student.email}`}>
            {student.email}
          </a>
        </div>
        <WeekDots modules={modules} student={student} grades={grades} current={week.id} now={now} onPick={onWeek} />
      </header>

      {phase === 'upcoming' ? (
        <p className="card card__empty">Week {week.position} has not started yet. Its work and grade show up here once it opens.</p>
      ) : (
        <div className="gview__grid">
          <section className="card gview__main" aria-labelledby="gview-tasks">
            <header className="card__head">
              <span className="card__icon">
                <Icon name="tasks" size={20} />
              </span>
              <h3 id="gview-tasks" className="grading__task">
                Tasks · week {week.position}
              </h3>
              {seesWork && tasks.length > 0 && (
                <span className="pill">
                  {w.done} of {w.total} handed in
                </span>
              )}
            </header>
            {!seesWork ? (
              <p className="card__empty">The server does not show your students&apos; hand-ins to mentors yet, so they cannot be read or commented on here.</p>
            ) : tasks.length === 0 ? (
              <p className="card__empty">This week has no tasks.</p>
            ) : (
              <>
                <p className="grading__hint">Tasks are not graded. Read what {student.name} handed in and leave a comment if it helps.</p>
                <ul className="list" aria-label={`${student.name}'s tasks`}>
                  {tasks.map((task) => {
                    const id = rowId(task.id, student.id)
                    return (
                      <WorkItem
                        key={id}
                        by="task"
                        row={workRow(task, student, workIndex, now)}
                        open={openWork === id}
                        onToggle={() => onToggleWork(id)}
                        onComment={(text) => onComment(task.id, task.title, text)}
                      />
                    )
                  })}
                </ul>
              </>
            )}
          </section>

          <div className="gview__side">
            <section className="card" aria-labelledby="gview-grade">
              <header className="card__head">
                <span className="card__icon card__icon--accent">
                  <Icon name="grades" size={20} />
                </span>
                <h3 id="gview-grade" className="grading__task">
                  Week {week.position} grade
                </h3>
                <GradeHelp />
              </header>
              <ul className="list" aria-label={`Week ${week.position} grade`}>
                <WeekGradeItem
                  key={`${week.id}-${student.id}`}
                  student={student}
                  week={week.position}
                  grade={weekGradeOf(grades, student.id, week.position)}
                  theirWeeks={theirWeeks}
                  work={seesWork ? { done: w.done, total: w.total } : undefined}
                  details={gradeDetails}
                  open
                  alwaysOpen
                  locked={gradeLocked(week, weekGradeOf(grades, student.id, week.position), now)}
                  onToggle={() => undefined}
                  onSave={onGrade}
                />
              </ul>
            </section>

            <section className="card" aria-labelledby="gview-quiz">
              <header className="card__head">
                <span className="card__icon">
                  <Icon name="sparkle" size={20} />
                </span>
                <h3 id="gview-quiz" className="grading__task">
                  Quizzes
                </h3>
              </header>
              {quizzes.length === 0 ? (
                <p className="card__empty">This week has no quizzes.</p>
              ) : !quizResults ? (
                <p className="card__empty">
                  {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'} this week. Quiz results are not available from the server yet.
                </p>
              ) : (
                <ul className="list" aria-label={`${student.name}'s quizzes`}>
                  {quizzes.map((q) => {
                    const a = quizResults[student.id]?.[q.id]
                    const pct = a && a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
                    return (
                      <li key={q.id} className="list__row gview__quiz">
                        <span className="person-row__main">
                          <span className="person-row__name">{q.title}</span>
                          <span className="list__meta">{a ? `Taken ${formatDateTime(a.submittedAt)}` : `${q.questions?.length ?? 0} questions`}</span>
                        </span>
                        {a ? (
                          <span className={`chip ${pct >= 60 ? 'chip--ok' : 'chip--danger'}`}>
                            {a.score}/{a.total} · {pct}%
                          </span>
                        ) : (
                          <span className="chip">Not taken</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
