import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { WeekGradeItem } from '../../components/staff/mentor/WeekGradeItem'
import { WorkItem } from '../../components/staff/mentor/WorkItem'
import { useCourses } from '../../hooks/useCourses'
import { useMyTeam } from '../../hooks/useMyTeam'
import { useTeamStandings } from '../../hooks/useTeamStandings'
import { useTeamSubmissions } from '../../hooks/useTeamSubmissions'
import { formatDateTime, formatShortDate } from '../../utils/date'
import {
  defaultWeek,
  handedIn,
  indexStandings,
  indexSubmissions,
  rowId,
  taskRows,
  tasksOf,
  ungradedCount,
  weekGradeOf,
  weekPhase,
} from '../../utils/review'
import { STANDING_LABEL } from '../../utils/standing'
import '../../styles/ui.css'
import '../../components/module/module.css'
import '../../components/authoring/authoring.css'
import '../../components/staff/staff.css'
import './mentor.css'
import { Loading } from '../../components/loading/Loading'

/**
 * MENTOR: grading. Each week every student gets ONE grade - green, yellow or red - for the week as
 * a whole; the week's tasks are not graded, the mentor reads the work and may comment on it.
 * The week, the open grade and the open piece of work live in the URL
 * (`?week=m5&grade=101`, `?week=m5&open=m5-a1~101`), so the dashboard can link straight to them.
 */
export default function GradingPage() {
  const courses = useCourses()
  const myTeam = useMyTeam()
  const work = useTeamSubmissions()
  const grades = useTeamStandings()
  const [params, setParams] = useSearchParams()
  const [saved, setSaved] = useState('')

  const students = useMemo(() => myTeam.team?.members ?? [], [myTeam.team])
  const modules = useMemo(() => [...courses.modules].sort((a, b) => a.position - b.position), [courses.modules])
  const workIndex = useMemo(() => indexSubmissions(work.submissions), [work.submissions])
  const gradeIndex = useMemo(() => indexStandings(grades.standings), [grades.standings])
  const now = courses.now

  const fallback = useMemo(() => defaultWeek(modules, students, gradeIndex, now), [modules, students, gradeIndex, now])
  const week = modules.find((m) => m.id === params.get('week')) ?? fallback
  const openWork = params.get('open')
  const openGrade = params.get('grade')

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const parts = [courses, myTeam, work, grades]
  const loading = parts.some((p) => p.status === 'loading')
  const failed = parts.some((p) => p.status === 'error')
  const phase = week ? weekPhase(week, now) : 'upcoming'
  const theirWeeks = (studentId: number) =>
    grades.standings.filter((s) => s.studentId === studentId).sort((a, b) => a.week - b.week)

  return (
    <section className="module grading">
      <div>
        <h1 className="page-title">Grading</h1>
        <p className="page-subtitle">Give each student a grade for the week, and comment on their work</p>
      </div>

      {loading && (
        <Loading className="module__state">Loading your team&apos;s weeks…</Loading>
      )}
      {!loading && failed && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load your team&apos;s weeks.</p>
          <button type="button" className="btn" onClick={() => {
              for (const p of parts) if (p.status === 'error') p.reload()
            }}>
            Try again
          </button>
        </div>
      )}

      {!loading && !failed && week && (
        <>
          <nav className="grading__weeks" aria-label="Weeks">
            {modules.map((m) => {
              const due = weekPhase(m, now) === 'finished' ? ungradedCount(m, students, gradeIndex, now) : 0
              return (
                <button
                  key={m.id}
                  type="button"
                  className="grading__week"
                  aria-pressed={m.id === week.id}
                  aria-label={`Week ${m.position}${due ? `, ${due} to grade` : ''}`}
                  onClick={() => {
                    setSaved('')
                    setParam({ week: m.id, open: null, grade: null })
                  }}
                >
                  Week {m.position}
                  {due > 0 && (
                    <span className="grading__badge" aria-hidden="true">
                      {due}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="grading__head">
            <h2 className="grading__title">
              Week {week.position} · {week.title}
            </h2>
            {week.opensAt && week.closesAt && (
              <span className="pill">
                {formatShortDate(week.opensAt)} - {formatShortDate(week.closesAt)}
                {phase === 'running' ? ' · running now' : phase === 'upcoming' ? ' · not started' : ''}
              </span>
            )}
          </div>

          {saved && (
            <p className="editor__status" role="status">
              {saved}
            </p>
          )}

          {phase === 'upcoming' ? (
            <p className="card card__empty">This week has not started yet. Its grades and work show up here once it opens.</p>
          ) : (
            <>
              <section className="card" aria-labelledby="week-grades-title">
                <header className="card__head">
                  <span className="card__icon card__icon--accent">
                    <Icon name="grades" size={20} />
                  </span>
                  <h3 id="week-grades-title" className="grading__task">
                    Week grades
                  </h3>
                  <span className="pill">
                    {students.length - ungradedCount(week, students, gradeIndex, now)} of {students.length} graded
                  </span>
                </header>
                <p className="grading__hint">
                  One grade per student for the whole week: green when on track, yellow when falling behind,
                  red when there was no real progress or no report.
                  {phase === 'running' && ' The week is still running; grades are usually given at its end.'}
                </p>
                <ul className="list" aria-label={`Week ${week.position} grades`}>
                  {students.map((s) => (
                    <WeekGradeItem
                      key={`${week.id}-${s.id}`}
                      student={s}
                      week={week.position}
                      grade={weekGradeOf(gradeIndex, s.id, week.position)}
                      theirWeeks={theirWeeks(s.id)}
                      work={handedIn(week, s, workIndex)}
                      open={openGrade === String(s.id)}
                      onToggle={() => setParam({ grade: openGrade === String(s.id) ? null : String(s.id) })}
                      onSave={async (level, note) => {
                        await grades.gradeWeek(s.id, week.position, level, note)
                        setSaved(`${s.name}: week ${week.position} graded ${STANDING_LABEL[level].toLowerCase()}.`)
                        setParam({ grade: null })
                      }}
                    />
                  ))}
                </ul>
              </section>

              <h3 className="grading__section">Tasks this week</h3>
              <p className="grading__hint grading__hint--plain">
                Tasks are not graded. Read what each student handed in and leave a comment if it helps them.
              </p>
              {tasksOf(week).length === 0 ? (
                <p className="card card__empty">This week has no tasks.</p>
              ) : (
                tasksOf(week).map((task) => (
                  <section key={task.id} className="card" aria-labelledby={`task-${task.id}`}>
                    <header className="card__head">
                      <span className="card__icon">
                        <Icon name="tasks" size={20} />
                      </span>
                      <h4 id={`task-${task.id}`} className="grading__task">
                        {task.title}
                      </h4>
                      <span className="pill">Due {formatDateTime(task.dueAt)}</span>
                    </header>
                    <ul className="list" aria-label={`${task.title}: students`}>
                      {taskRows(task, students, workIndex, now).map((row) => {
                        const id = rowId(task.id, row.student.id)
                        return (
                          <WorkItem
                            key={id}
                            row={row}
                            open={openWork === id}
                            onToggle={() => setParam({ open: openWork === id ? null : id })}
                            onComment={async (text) => {
                              await work.comment(row.student.id, task.id, text)
                              setSaved(`Comment saved on ${row.student.name}'s ${task.title}.`)
                            }}
                          />
                        )
                      })}
                    </ul>
                  </section>
                ))
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
