import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { gradeNotesKept, mentorSeesTeamWork } from '../../api/capabilities'
import { hasBackend } from '../../api/http'
import { fetchTeamQuizResults } from '../../api/quizResults'
import type { TeamQuizResults } from '../../api/quizResults'
import { useCourses } from '../../hooks/useCourses'
import { useMyTeam } from '../../hooks/useMyTeam'
import { useTeamStandings } from '../../hooks/useTeamStandings'
import { useTeamSubmissions } from '../../hooks/useTeamSubmissions'
import { formatShortDate } from '../../utils/date'
import { defaultWeek, indexStandings, indexSubmissions, studentWeek, ungradedCount, weekPhase } from '../../utils/review'
import { STANDING_LABEL } from '../../utils/standing'
import { StudentCard, StudentWeekView } from './GradingStudents'
import '../../styles/ui.css'
import '../../components/module/module.css'
import '../../components/authoring/authoring.css'
import '../../components/staff/staff.css'
import './mentor.css'
import { Loading } from '../../components/loading/Loading'

/**
 * MENTOR: grading, student by student. Pick a week: every student of the team is a card (their week grade, every week as a
 * dot, the work handed in, what is new or missing, the quizzes). Open a card for that student's week: their tasks with
 * what they handed in and the comment, the week grade and the quizzes, with arrows to the next student.
 * Everything lives in the URL (`?week=m5&student=101&open=m5-a1~101`) so the dashboard can link straight to it; the older
 * links `?grade=101` and `?open=m5-a1~101` (without `student`) open that student too.
 */
export default function GradingPage() {
  const courses = useCourses()
  const myTeam = useMyTeam()
  const work = useTeamSubmissions()
  const grades = useTeamStandings()
  const [params, setParams] = useSearchParams()
  const [saved, setSaved] = useState('')
  const [quizResults, setQuizResults] = useState<TeamQuizResults | null>(null)

  const students = useMemo(() => myTeam.team?.members ?? [], [myTeam.team])
  const modules = useMemo(() => [...courses.modules].sort((a, b) => a.position - b.position), [courses.modules])
  const workIndex = useMemo(() => indexSubmissions(work.submissions), [work.submissions])
  const gradeIndex = useMemo(() => indexStandings(grades.standings), [grades.standings])
  const now = courses.now

  // how the students did on the quizzes (not available from the real server yet: then nothing is shown)
  const ids = students.map((s) => s.id).join(',')
  useEffect(() => {
    let cancelled = false
    fetchTeamQuizResults(ids ? ids.split(',').map(Number) : []).then(
      (r) => !cancelled && setQuizResults(r),
      () => !cancelled && setQuizResults(null),
    )
    return () => {
      cancelled = true
    }
  }, [ids, courses.modules])

  const fallback = useMemo(() => defaultWeek(modules, students, gradeIndex, now), [modules, students, gradeIndex, now])
  const week = modules.find((m) => m.id === params.get('week')) ?? fallback
  const openWork = params.get('open')
  // the student whose page is open: `student`, or the older links that open a grade or a piece of work
  const studentParam = params.get('student') ?? params.get('grade') ?? openWork?.split('~')[1] ?? null
  const student = students.find((s) => String(s.id) === studentParam)

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }
  const openStudent = (id: number | null) => {
    setSaved('')
    setParam({ student: id === null ? null : String(id), grade: null, open: null })
    window.scrollTo?.({ top: 0 })
  }

  const parts = [courses, myTeam, work, grades]
  const loading = parts.some((p) => p.status === 'loading')
  const failed = parts.some((p) => p.status === 'error')
  const phase = week ? weekPhase(week, now) : 'upcoming'
  const seesWork = mentorSeesTeamWork()
  const theirWeeks = (studentId: number) => grades.standings.filter((s) => s.studentId === studentId).sort((a, b) => a.week - b.week)

  const graded = week ? students.length - ungradedCount(week, students, gradeIndex, now) : 0
  const freshTotal = week && seesWork ? students.reduce((n, s) => n + studentWeek(week, s, workIndex, now).fresh, 0) : 0

  return (
    <section className="module grading">
      <div>
        <h1 className="page-title">Grading</h1>
        <p className="page-subtitle">Pick a week, then a student: grade their week and comment on their work</p>
      </div>

      {loading && <Loading className="module__state">Loading your team&apos;s weeks…</Loading>}
      {!loading && failed && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load your team&apos;s weeks.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              for (const p of parts) if (p.status === 'error') p.reload()
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !failed && !myTeam.team && (
        <p className="card card__empty">You do not look after a team yet, so there is no one to grade. An admin gives each team its mentor.</p>
      )}

      {!loading && !failed && myTeam.team && !week && (
        <p className="card card__empty">
          There are no weeks to grade yet.
          {hasBackend() && ' The server shows you only the weeks you are enrolled in: ask an admin to add you to the course weeks.'}
        </p>
      )}

      {!loading && !failed && myTeam.team && week && (
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

          {student ? (
            <StudentWeekView
              student={student}
              students={students}
              week={week}
              modules={modules}
              grades={gradeIndex}
              theirWeeks={theirWeeks(student.id)}
              workIndex={workIndex}
              seesWork={seesWork}
              gradeDetails={gradeNotesKept()}
              quizResults={quizResults}
              now={now}
              openWork={openWork}
              onBack={() => openStudent(null)}
              onStudent={openStudent}
              onWeek={(id) => {
                setSaved('')
                setParam({ week: id, open: null, grade: null })
              }}
              onToggleWork={(id) => setParam({ open: openWork === id ? null : id })}
              onComment={async (taskId, title, text) => {
                await work.comment(student.id, taskId, text)
                setSaved(`Comment saved on ${student.name}'s ${title}.`)
              }}
              onGrade={async (level, note) => {
                await grades.gradeWeek(student.id, week.position, level, note)
                setSaved(`${student.name}: week ${week.position} graded ${STANDING_LABEL[level].toLowerCase()}.`)
              }}
            />
          ) : phase === 'upcoming' ? (
            <p className="card card__empty">This week has not started yet. Its grades and work show up here once it opens.</p>
          ) : (
            <>
              <p className="grading__summary-line">
                <strong>
                  {graded} of {students.length}
                </strong>{' '}
                graded
                {seesWork && (
                  <>
                    {' · '}
                    <strong>{freshTotal}</strong> new {freshTotal === 1 ? 'hand-in' : 'hand-ins'} without a comment
                  </>
                )}
                {phase === 'running' && ' · the week is still running'}
              </p>
              <ul className="gcards" aria-label={`Week ${week.position} students`}>
                {students.map((s) => (
                  <StudentCard
                    key={s.id}
                    student={s}
                    week={week}
                    modules={modules}
                    grades={gradeIndex}
                    workIndex={workIndex}
                    seesWork={seesWork}
                    quizResults={quizResults}
                    now={now}
                    onOpen={() => openStudent(s.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
