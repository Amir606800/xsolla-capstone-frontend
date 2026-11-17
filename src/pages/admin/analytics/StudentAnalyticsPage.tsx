import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { StandingPill } from '../../../components/StandingPill'
import { WeekTiles } from '../../../components/WeekTiles'
import { useAiSummary, useStudentAnalytics } from '../../../hooks/useAnalytics'
import { useStudentReviews } from '../../../hooks/useStudentReviews'
import { formatDateTime, formatShortDate } from '../../../utils/date'
import { inPeriod, onTimeShare, percent, quizShare, studentVerdict, weeksOf } from '../../../utils/personAnalytics'
import { analyseStandings, STANDING_LABEL } from '../../../utils/standing'
import { AiSummaryCard } from './AiSummaryCard'
import { AccuracyChart, LoadProblem, SubmissionStatusChart } from './AnalyticsCharts'
import { AnalyticsShell } from './AnalyticsShell'
import { weekTitle } from './chartFormat'
import { GlanceCard } from './GlanceCard'

/** The program has twelve weeks. */
const PROGRAM_WEEKS = 12
/** Mentor notes shown before "Show all". */
const NOTES_SHOWN = 4

const BACK = { to: '/admin/analytics/students', label: 'Student analytics' }

/**
 * Admin: one student. First how they are doing (the program rules applied to the mentor's weekly grades), then the AI
 * summary of the feedback they got, then the weeks, hand-ins and quizzes behind it.
 */
export default function StudentAnalyticsPage() {
  const params = useParams()
  const id = Number(params.studentId)
  const studentId = Number.isInteger(id) && id > 0 ? id : null
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [allNotes, setAllNotes] = useState(false)
  const report = useStudentAnalytics(studentId, from, to)
  const grades = useStudentReviews()
  const summary = useAiSummary('students', studentId, from, to)

  const mine = useMemo(
    () => (studentId === null ? [] : grades.reviews.filter((g) => g.studentId === studentId && inPeriod(g.gradedAt, from, to))),
    [grades.reviews, studentId, from, to],
  )
  const standing = useMemo(() => analyseStandings(weeksOf(mine, studentId ?? 0)), [mine, studentId])
  const latest = mine.reduce<(typeof mine)[number] | null>((a, b) => (!a || b.week > a.week ? b : a), null)
  const notes = [...mine].sort((a, b) => b.week - a.week)

  if (studentId === null || (report.status === 'ready' && !report.data)) {
    return (
      <AnalyticsShell
        eyebrow={BACK}
        title="Student not found"
        subtitle="That student does not exist, or no longer holds the student role."
      >
        <Link className="admin-btn analytics-start" to={BACK.to}>
          <Icon name="back" size={16} /> Back to students
        </Link>
      </AnalyticsShell>
    )
  }

  const data = report.data
  const name = data?.student.name ?? latest?.studentName ?? 'Student'
  const status = data?.status
  const onTime = status ? onTimeShare(status) : null
  const quiz = data ? quizShare(data.quizzes) : null
  const points = data?.quizzes.reduce((n, q) => ({ score: n.score + q.scoreTotal, possible: n.possible + q.possibleTotal }), {
    score: 0,
    possible: 0,
  })
  const gradesKnown = grades.status === 'ready'
  const verdict = gradesKnown
    ? studentVerdict(standing)
    : {
        tone: 'none' as const,
        title: grades.status === 'loading' ? 'Loading the week grades…' : 'Week grades unavailable',
        text:
          grades.status === 'loading'
            ? ''
            : 'The server does not let this account read the weekly grades, so the standing cannot be worked out.',
      }
  const subtitle = [latest?.teamName, latest?.mentorName && `mentor ${latest.mentorName}`, data?.student.email]
    .filter(Boolean)
    .join(' · ')

  return (
    <AnalyticsShell
      eyebrow={BACK}
      title={name}
      subtitle={subtitle || undefined}
      period={{
        from,
        to,
        onChange: (f, t) => {
          setFrom(f)
          setTo(t)
        },
        note: data ? `${data.period.from} to ${data.period.to} · updated ${formatDateTime(data.generatedAt)}` : undefined,
      }}
    >
      <GlanceCard
        verdict={verdict}
        ring={{
          label: 'Weeks by grade',
          center: `${standing.counts.green}/${standing.counts.total}`,
          sub: 'weeks green',
          slices: [
            { key: 'green', label: STANDING_LABEL.green, value: standing.counts.green, tone: 'good' },
            { key: 'yellow', label: STANDING_LABEL.yellow, value: standing.counts.yellow, tone: 'warn' },
            { key: 'red', label: STANDING_LABEL.red, value: standing.counts.red, tone: 'bad' },
          ],
        }}
        tiles={[
          {
            label: 'Deadlines met',
            value: report.status === 'loading' ? '…' : percent(onTime),
            hint: status
              ? status.eligible === 0
                ? 'nothing due yet'
                : `${status.onTime} of ${status.eligible} on time`
              : undefined,
          },
          {
            label: 'Quiz accuracy',
            value: report.status === 'loading' ? '…' : percent(quiz),
            hint:
              points && points.possible > 0
                ? `${points.score} of ${points.possible} points`
                : data
                  ? 'no scored quiz'
                  : undefined,
          },
          {
            label: 'Latest grade',
            value: latest ? STANDING_LABEL[latest.level] : '—',
            hint: latest ? `Week ${latest.week}` : 'not graded yet',
          },
          { label: 'Mentor', value: latest?.mentorName ?? '—', hint: latest?.teamName },
        ]}
      />

      <AiSummaryCard
        state={summary}
        source="the mentors' weekly feedback and the comments on hand-ins"
        missing="The server cannot write student summaries yet."
      />

      <section className="admin-panel" aria-label="Week by week">
        <h2 className="admin-section-title">Week by week</h2>
        {grades.status === 'loading' && <Loading className="admin-muted">Loading the week grades…</Loading>}
        {grades.status === 'error' && <LoadProblem error="The week grades could not be loaded." onRetry={grades.reload} />}
        {grades.status === 'unavailable' && (
          <p className="admin-muted">The server does not let this account read the weekly grades.</p>
        )}
        {gradesKnown && (
          <>
            <WeekTiles totalWeeks={PROGRAM_WEEKS} weeks={standing.weeks} />
            {notes.length === 0 ? (
              <p className="admin-muted">No week graded in this period.</p>
            ) : (
              <>
                <ul className="analytics-notes" aria-label="Mentor feedback by week">
                  {(allNotes ? notes : notes.slice(0, NOTES_SHOWN)).map((g) => (
                    <li key={g.id}>
                      <div className="analytics-notes__head">
                        <strong>{weekTitle(g.week, g.moduleTitle)}</strong>
                        <StandingPill level={g.level} />
                        <span className="admin-muted">
                          {g.mentorName ? `${g.mentorName} · ` : ''}
                          {formatShortDate(g.gradedAt)}
                        </span>
                      </div>
                      <p className={g.note ? undefined : 'admin-muted'}>{g.note ?? 'No module feedback.'}</p>
                    </li>
                  ))}
                </ul>
                {notes.length > NOTES_SHOWN && (
                  <button type="button" className="admin-btn analytics-start" onClick={() => setAllNotes((v) => !v)}>
                    {allNotes ? 'Show fewer weeks' : `Show all ${notes.length} weeks`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </section>

      {report.status === 'loading' && <Loading className="admin-muted">Loading hand-ins and quizzes…</Loading>}
      {report.status === 'error' && <LoadProblem error={report.error} onRetry={report.reload} />}
      {data && (
        <div className="analytics-pair">
          <section className="admin-panel" aria-label="Hand-ins">
            <h2 className="admin-section-title">Hand-ins</h2>
            <p className="admin-muted analytics-note">
              Tasks whose deadline has passed, in the weeks the student is enrolled in.
            </p>
            <SubmissionStatusChart status={data.status} emptyText="No task was due in this period." />
          </section>
          <section className="admin-panel" aria-label="Quizzes">
            <h2 className="admin-section-title">Quizzes</h2>
            <AccuracyChart quizzes={data.quizzes} emptyText="No quiz attempts in this period." />
          </section>
        </div>
      )}
    </AnalyticsShell>
  )
}
