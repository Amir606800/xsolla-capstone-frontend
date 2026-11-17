import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Loading } from '../../../components/loading/Loading'
import { StandingPill } from '../../../components/StandingPill'
import { useAdminLectureReviews } from '../../../hooks/useAdminLectureReviews'
import { useAdminReviews } from '../../../hooks/useAdminReviews'
import { useOverview } from '../../../hooks/useAnalytics'
import { useDirectory } from '../../../hooks/useDirectory'
import { useStudentReviews } from '../../../hooks/useStudentReviews'
import { formatDateTime } from '../../../utils/date'
import { summariseLectures } from '../../../utils/lectureAnalytics'
import {
  currentCounts,
  inPeriod,
  percent,
  reviewsOfLecturer,
  schoolVerdict,
  standingsByStudent,
} from '../../../utils/personAnalytics'
import { average, formatScore, summarise } from '../../../utils/reviewAnalytics'
import { canMentor, hasRole, isStudent } from '../../../utils/roles'
import { STANDING_LABEL } from '../../../utils/standing'
import { LoadProblem, StackedStandingChart } from './AnalyticsCharts'
import { AnalyticsShell } from './AnalyticsShell'
import { GlanceCard } from './GlanceCard'

const score = (n: number | null, count: number) => (n === null ? '—' : `${n.toFixed(1)} · n=${count}`)

/**
 * Admin: the school at a glance. How the students stand now (with the ones who need a look named), the weekly standing
 * over the period, and every mentor and lecturer with the figure that matters most for them, each linking to their page.
 */
export default function AnalyticsOverviewPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const report = useOverview(from, to)
  const grades = useStudentReviews()
  const directory = useDirectory()
  const mentorReviews = useAdminReviews()
  const lectureReviews = useAdminLectureReviews()

  const standings = useMemo(() => standingsByStudent(grades.reviews), [grades.reviews])
  const students = directory.users.filter((u) => isStudent(u) && !u.leftAt)
  const now = currentCounts(
    students.map((s) => s.id),
    standings,
  )
  const attention = [...standings.values()]
    .filter((s) => s.severity > 0 && students.some((u) => u.id === s.studentId))
    .sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name))

  const reviews = mentorReviews.reviews.filter((r) => inPeriod(r.submittedAt, from, to))
  const lectures = lectureReviews.reviews.filter((r) => inPeriod(r.lecture.startsAt, from, to))
  const mentors = directory.users.filter((u) => !u.leftAt && canMentor(u)).sort((a, b) => a.name.localeCompare(b.name))
  const lecturers = directory.users
    .filter((u) => !u.leftAt && hasRole(u, 'lecturer'))
    .sort((a, b) => a.name.localeCompare(b.name))
  const loadingPeople = directory.status === 'loading' || grades.status === 'loading'

  return (
    <AnalyticsShell
      title="Analytics"
      subtitle="How the school is doing: the students' standing, and what students say about their mentors and lectures."
      period={{
        from,
        to,
        onChange: (f, t) => {
          setFrom(f)
          setTo(t)
        },
        note: report.data
          ? `${report.data.period.from} to ${report.data.period.to} · updated ${formatDateTime(report.data.generatedAt)}`
          : undefined,
      }}
    >
      {loadingPeople ? (
        <Loading className="admin-muted">Loading the school…</Loading>
      ) : (
        <GlanceCard
          title="The school at a glance"
          verdict={schoolVerdict(now, attention.length)}
          ring={{
            label: 'Students now',
            center: `${now.green}/${now.green + now.yellow + now.red}`,
            sub: 'graded on track',
            slices: [
              { key: 'green', label: STANDING_LABEL.green, value: now.green, tone: 'good' },
              { key: 'yellow', label: STANDING_LABEL.yellow, value: now.yellow, tone: 'warn' },
              { key: 'red', label: STANDING_LABEL.red, value: now.red, tone: 'bad' },
              { key: 'none', label: 'Not graded yet', value: now.none, tone: 'none' },
            ],
          }}
          tiles={[
            { label: 'Students', value: String(students.length), hint: `${directory.teams.length} teams` },
            { label: 'Need attention', value: String(attention.length), hint: 'removal, at risk or 2+ yellow weeks' },
            {
              label: 'Mentor rating',
              value: formatScore(average(reviews.map((r) => r.overall))),
              hint: `${reviews.length} reviews`,
            },
            {
              label: 'Lecture rating',
              value: formatScore(average(lectures.map((r) => r.overall))),
              hint: `${lectures.length} answers`,
            },
          ]}
        />
      )}

      <section className="admin-panel" aria-label="Needs attention">
        <h2 className="admin-section-title">Needs attention</h2>
        <p className="admin-muted analytics-note">
          Students the program rules flag now: two red weeks in a row, one red week, or a run of yellow weeks.
        </p>
        {grades.status === 'loading' ? (
          <Loading className="admin-muted">Loading the week grades…</Loading>
        ) : grades.status === 'unavailable' ? (
          <p className="admin-muted">The server does not let this account read the weekly grades.</p>
        ) : grades.status === 'error' ? (
          <LoadProblem error="The week grades could not be loaded." onRetry={grades.reload} />
        ) : attention.length === 0 ? (
          <p className="admin-muted">Nobody is at risk right now.</p>
        ) : (
          <ul className="analytics-roster" aria-label="Students who need attention">
            {attention.map((s) => (
              <li key={s.studentId}>
                <Link to={`/admin/analytics/students/${s.studentId}`} className="analytics-roster__name">
                  {s.name}
                </Link>
                {s.summary.current && <StandingPill level={s.summary.current} />}
                <span className="analytics-roster__why">
                  <strong>{s.verdict.title}.</strong> {s.verdict.text}
                </span>
                <span className="admin-muted analytics-roster__team">
                  {[s.teamName, s.mentorName].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-panel" aria-label="Weekly student standing">
        <h2 className="admin-section-title">Weekly student standing</h2>
        <p className="admin-muted analytics-note">Each bar counts the students with a recorded grade that week.</p>
        {report.status === 'loading' && <Loading className="admin-muted">Loading the weeks…</Loading>}
        {report.status === 'error' && <LoadProblem error={report.error} onRetry={report.reload} />}
        {report.status === 'ready' && report.data && (
          <StackedStandingChart
            weeks={report.data.weeks}
            label="Weekly student standing"
            emptyText="No modules opened in this period."
          />
        )}
      </section>

      <div className="analytics-pair">
        <section className="admin-panel" aria-label="Mentors">
          <h2 className="admin-section-title">Mentors</h2>
          <p className="admin-muted analytics-note">A–Z. Rating: the students' overall rating, 1–5, with the number of reviews.</p>
          {directory.status !== 'ready' ? (
            <Loading className="admin-muted">Loading the mentors…</Loading>
          ) : mentors.length === 0 ? (
            <p className="admin-muted">No mentors yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table analytics-table">
                <caption className="sr-only">Every mentor, A–Z, with the students' overall rating</caption>
                <thead>
                  <tr>
                    <th scope="col">Mentor</th>
                    <th scope="col">On track now</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Weeks with a 1:1</th>
                  </tr>
                </thead>
                <tbody>
                  {mentors.map((m) => {
                    const team = directory.teams.filter((t) => t.mentorId === m.id).flatMap((t) => t.studentIds)
                    const c = currentCounts(team, standings)
                    const s = summarise(reviews.filter((r) => r.mentorId === m.id))
                    return (
                      <tr key={m.id}>
                        <th scope="row">
                          <Link to={`/admin/analytics/mentors/${m.id}`}>{m.name}</Link>
                        </th>
                        <td className="admin-table__num">{team.length ? `${c.green} / ${team.length}` : '—'}</td>
                        <td className="admin-table__num">{score(s.overall, s.count)}</td>
                        <td className="admin-table__num">{percent(s.sessionRate)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-panel" aria-label="Lecturers">
          <h2 className="admin-section-title">Lecturers</h2>
          <p className="admin-muted analytics-note">A–Z. Rating: the students' overall rating of the lectures, 1–5, with the number of answers.</p>
          {directory.status !== 'ready' ? (
            <Loading className="admin-muted">Loading the lecturers…</Loading>
          ) : lecturers.length === 0 ? (
            <p className="admin-muted">No lecturers yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table analytics-table">
                <caption className="sr-only">Every lecturer, A–Z, with the students' overall rating of the lectures</caption>
                <thead>
                  <tr>
                    <th scope="col">Lecturer</th>
                    <th scope="col">Lectures</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Pace just right</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturers.map((l) => {
                    const s = summariseLectures(reviewsOfLecturer(lectures, l.id))
                    return (
                      <tr key={l.id}>
                        <th scope="row">
                          <Link to={`/admin/analytics/lecturers/${l.id}`}>{l.name}</Link>
                        </th>
                        <td className="admin-table__num">{s.lectures}</td>
                        <td className="admin-table__num">{score(s.scores.overall, s.reviews)}</td>
                        <td className="admin-table__num">{percent(s.justRight)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AnalyticsShell>
  )
}
