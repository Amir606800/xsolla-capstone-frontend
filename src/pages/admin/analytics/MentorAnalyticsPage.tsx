import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { StandingPill } from '../../../components/StandingPill'
import { useAdminReviews } from '../../../hooks/useAdminReviews'
import { useAiSummary, useMentorAnalytics } from '../../../hooks/useAnalytics'
import { useDirectory } from '../../../hooks/useDirectory'
import { useStudentReviews } from '../../../hooks/useStudentReviews'
import { formatDateTime } from '../../../utils/date'
import { NO_SESSION_LABEL, TOPIC_LABEL } from '../../../utils/mentorReview'
import { currentCounts, inPeriod, percent, ratingSplit, ratingVerdict, standingsByStudent } from '../../../utils/personAnalytics'
import { reasonCounts, STATEMENT_SHORT, summarise, topicCounts } from '../../../utils/reviewAnalytics'
import { STANDING_LABEL } from '../../../utils/standing'
import { AiSummaryCard } from './AiSummaryCard'
import { LoadProblem, ScoreBars, SegmentedBar, StackedStandingChart } from './AnalyticsCharts'
import { AnalyticsShell } from './AnalyticsShell'
import { GlanceCard } from './GlanceCard'

const BACK = { to: '/admin/analytics/mentors', label: 'Mentor analytics' }

/**
 * Admin: one mentor. First what their students say about them (the overall rating of the weekly mentor reviews), then
 * the AI summary of those reviews, then how their team is doing now and the details behind both.
 */
export default function MentorAnalyticsPage() {
  const params = useParams()
  const id = Number(params.mentorId)
  const mentorId = Number.isInteger(id) && id > 0 ? id : null
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const report = useMentorAnalytics(mentorId, from, to)
  const reviews = useAdminReviews()
  const grades = useStudentReviews()
  const directory = useDirectory()
  const summary = useAiSummary('mentors', mentorId, from, to)

  const mine = useMemo(
    () => reviews.reviews.filter((r) => r.mentorId === mentorId && inPeriod(r.submittedAt, from, to)),
    [reviews.reviews, mentorId, from, to],
  )
  const numbers = useMemo(() => summarise(mine), [mine])
  const split = ratingSplit(mine.map((r) => r.overall))
  const standings = useMemo(() => standingsByStudent(grades.reviews), [grades.reviews])
  const teams = directory.teams.filter((t) => t.mentorId === mentorId)
  const names = new Map(directory.users.map((u) => [u.id, u.name]))
  const teamIds = teams.flatMap((t) => t.studentIds)
  const now = currentCounts(teamIds, standings)
  const students = teamIds
    .map((sid) => ({
      id: sid,
      name: names.get(sid) ?? standings.get(sid)?.name ?? `Student #${sid}`,
      standing: standings.get(sid),
    }))
    .sort((a, b) => (b.standing?.severity ?? 0) - (a.standing?.severity ?? 0) || a.name.localeCompare(b.name))
  const attention = students.filter((s) => (s.standing?.severity ?? 0) > 0).length

  if (mentorId === null || (report.status === 'ready' && !report.data)) {
    return (
      <AnalyticsShell
        eyebrow={BACK}
        title="Mentor not found"
        subtitle="That mentor does not exist, or no longer holds the mentor role."
      >
        <Link className="admin-btn analytics-start" to={BACK.to}>
          <Icon name="back" size={16} /> Back to mentors
        </Link>
      </AnalyticsShell>
    )
  }

  const data = report.data
  const name = data?.mentor.name ?? names.get(mentorId) ?? 'Mentor'
  const teamName = teams.map((t) => t.name).join(', ')
  const reviewsKnown = reviews.status === 'ready'
  const verdict = reviewsKnown
    ? ratingVerdict(numbers.overall, numbers.count, 'this mentor')
    : {
        tone: 'none' as const,
        title: reviews.status === 'loading' ? 'Loading the reviews…' : 'Reviews unavailable',
        text: reviews.status === 'loading' ? '' : 'The server cannot list the mentor reviews, so the rating cannot be shown.',
      }

  return (
    <AnalyticsShell
      eyebrow={BACK}
      title={name}
      subtitle={[teamName && `Mentor of ${teamName}`, data?.mentor.email].filter(Boolean).join(' · ') || undefined}
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
          label: 'Overall ratings',
          center: numbers.overall === null ? '—' : numbers.overall.toFixed(1),
          sub: 'of 5 overall',
          slices: [
            { key: 'positive', label: 'Rated 4–5', value: split.positive, tone: 'good' },
            { key: 'neutral', label: 'Rated 3', value: split.neutral, tone: 'warn' },
            { key: 'negative', label: 'Rated 1–2', value: split.negative, tone: 'bad' },
          ],
        }}
        tiles={[
          { label: 'Reviews', value: String(numbers.count), hint: `${numbers.withComment} with a comment` },
          {
            label: '1:1s held',
            value: percent(numbers.sessionRate),
            hint: numbers.count ? `${numbers.sessions} of ${numbers.count} weeks, as students report` : undefined,
          },
          {
            label: 'Team on track',
            value: teamIds.length ? `${now.green} of ${teamIds.length}` : '—',
            hint: teamIds.length ? (attention ? `${attention} need attention` : 'nobody at risk') : 'no team',
          },
          { label: 'Team', value: teamName || '—', hint: teamIds.length ? `${teamIds.length} students` : undefined },
        ]}
      />

      <AiSummaryCard
        state={summary}
        source="the reviews students wrote about this mentor"
        missing="The server cannot write mentor summaries yet."
      />

      <section className="admin-panel" aria-label="Their students now">
        <h2 className="admin-section-title">Their students now</h2>
        <p className="admin-muted analytics-note">
          Each student by the grade of their latest graded week, with the program rules applied.
        </p>
        {directory.status === 'loading' || grades.status === 'loading' ? (
          <Loading className="admin-muted">Loading the team…</Loading>
        ) : teamIds.length === 0 ? (
          <p className="admin-muted">This mentor has no team.</p>
        ) : (
          <>
            <SegmentedBar
              label="The team now"
              parts={[
                { key: 'green', label: STANDING_LABEL.green, value: now.green, tone: 'good' },
                { key: 'yellow', label: STANDING_LABEL.yellow, value: now.yellow, tone: 'warn' },
                { key: 'red', label: STANDING_LABEL.red, value: now.red, tone: 'bad' },
                { key: 'none', label: 'Not graded yet', value: now.none, tone: 'none' },
              ]}
            />
            <ul className="analytics-roster" aria-label="Team members">
              {students.map((s) => (
                <li key={s.id}>
                  <Link to={`/admin/analytics/students/${s.id}`} className="analytics-roster__name">
                    {s.name}
                  </Link>
                  {s.standing?.summary.current ? (
                    <StandingPill level={s.standing.summary.current} />
                  ) : (
                    <span className="admin-pill">Not graded yet</span>
                  )}
                  {s.standing && s.standing.severity > 0 && (
                    <span className="analytics-roster__why">
                      {s.standing.verdict.title}: {s.standing.verdict.text}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {report.status === 'loading' && <Loading className="admin-muted">Loading the mentor's charts…</Loading>}
      {report.status === 'error' && <LoadProblem error={report.error} onRetry={report.reload} />}
      {data && (
        <section className="admin-panel" aria-label="Students' weekly standing">
          <h2 className="admin-section-title">Their students week by week</h2>
          {data.attribution === 'current_roster' && (
            <p className="admin-muted analytics-note">
              Uses the mentor's current team. Past weeks are not attributed to the mentor students had at the time.
            </p>
          )}
          <StackedStandingChart
            weeks={data.weeks}
            label="The mentor's students by week"
            emptyText="No modules opened in this period."
          />
        </section>
      )}

      <div className="analytics-pair">
        {data && (
          <section className="admin-panel" aria-label="What students say">
            <h2 className="admin-section-title">What students say</h2>
            <p className="admin-muted analytics-note">
              The four statements of the weekly review, 1–5, asked only when a 1:1 took place.
            </p>
            <ScoreBars
              label="Student feedback by dimension"
              scores={data.feedback.map((f) => ({
                key: f.dimension,
                label: f.dimension === 'time' ? 'Time management' : STATEMENT_SHORT[f.dimension],
                average: f.average,
                count: f.count,
              }))}
            />
          </section>
        )}
        {reviewsKnown && (
          <section className="admin-panel" aria-label="1:1 sessions">
            <h2 className="admin-section-title">1:1 sessions</h2>
            {numbers.count === 0 ? (
              <p className="admin-muted">No reviews in this period.</p>
            ) : (
              <>
                <SegmentedBar
                  label="Weeks with a 1:1"
                  parts={[
                    { key: 'held', label: 'Had a 1:1', value: numbers.sessions, tone: 'good' },
                    { key: 'none', label: 'No 1:1', value: numbers.count - numbers.sessions, tone: 'bad' },
                  ]}
                />
                <TopList
                  title="Why there was no 1:1"
                  rows={reasonCounts(mine).map((r) => ({ label: NO_SESSION_LABEL[r.reason], count: r.count }))}
                />
                <TopList
                  title="What the 1:1s were about"
                  rows={topicCounts(mine).map((t) => ({ label: TOPIC_LABEL[t.topic], count: t.count }))}
                />
              </>
            )}
          </section>
        )}
      </div>
    </AnalyticsShell>
  )
}

/** A short "how often" list, most often first. Nothing when there is nothing to count. */
function TopList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  if (rows.length === 0) return null
  return (
    <div className="analytics-toplist">
      <h3>{title}</h3>
      <ul aria-label={title}>
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <strong>{r.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
