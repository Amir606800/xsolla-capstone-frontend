import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useAdminLectureReviews } from '../../../hooks/useAdminLectureReviews'
import { useAiSummary, useLectureExpected } from '../../../hooks/useAnalytics'
import { useDirectory } from '../../../hooks/useDirectory'
import { formatShortDate } from '../../../utils/date'
import { LECTURE_SCORES, PACE_LABEL, summariseLectures } from '../../../utils/lectureAnalytics'
import {
  inPeriod,
  lectureRows,
  percent,
  ratingSplit,
  ratingVerdict,
  responseRate,
  reviewsOfLecturer,
} from '../../../utils/personAnalytics'
import { hasRole } from '../../../utils/roles'
import { AiSummaryCard } from './AiSummaryCard'
import { LoadProblem, ScoreBars, SegmentedBar } from './AnalyticsCharts'
import { AnalyticsShell } from './AnalyticsShell'
import { shareOf } from './chartFormat'
import { GlanceCard } from './GlanceCard'

const BACK = { to: '/admin/analytics/lecturers', label: 'Lecturer analytics' }

/**
 * Admin: one lecturer. The server has no lecturer analytics, so this page is made from the lecture feedback (every
 * answer about the lectures of the weeks this person teaches, GET /lecture-feedback) and the expected answers per lecture
 * (GET /lecture-feedback/summary). First how students rate the lectures, then the AI summary, then the scores, the pace
 * and every lecture.
 */
export default function LecturerAnalyticsPage() {
  const params = useParams()
  const id = Number(params.lecturerId)
  const lecturerId = Number.isInteger(id) && id > 0 ? id : null
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const feedback = useAdminLectureReviews()
  const expected = useLectureExpected()
  const directory = useDirectory()
  const summary = useAiSummary('lecturers', lecturerId, from, to)

  const mine = useMemo(
    () =>
      lecturerId === null
        ? []
        : reviewsOfLecturer(feedback.reviews, lecturerId).filter((r) => inPeriod(r.lecture.startsAt, from, to)),
    [feedback.reviews, lecturerId, from, to],
  )
  const numbers = useMemo(() => summariseLectures(mine), [mine])
  const lectures = useMemo(() => lectureRows(mine, expected.data ?? {}), [mine, expected.data])
  const rate = responseRate(lectures)
  const answered = lectures.filter((l) => l.expected !== null)
  const split = ratingSplit(mine.map((r) => r.overall))

  const person = directory.users.find((u) => u.id === lecturerId)
  const named = feedback.reviews.flatMap((r) => r.lecturers).find((l) => l.id === lecturerId)
  const unknown =
    directory.status === 'ready' && feedback.status !== 'loading' && !(person && hasRole(person, 'lecturer')) && !named
  if (lecturerId === null || unknown) {
    return (
      <AnalyticsShell
        eyebrow={BACK}
        title="Lecturer not found"
        subtitle="That lecturer does not exist, or no longer holds the lecturer role."
      >
        <Link className="admin-btn analytics-start" to={BACK.to}>
          <Icon name="back" size={16} /> Back to lecturers
        </Link>
      </AnalyticsShell>
    )
  }

  const name = person?.name ?? named?.name ?? 'Lecturer'
  const known = feedback.status === 'ready'
  const verdict = known
    ? ratingVerdict(numbers.scores.overall, numbers.reviews, 'these lectures')
    : {
        tone: 'none' as const,
        title: feedback.status === 'loading' ? 'Loading the lecture feedback…' : 'Lecture feedback unavailable',
        text: feedback.status === 'loading' ? '' : 'The server cannot list the lecture feedback, so the ratings cannot be shown.',
      }

  return (
    <AnalyticsShell
      eyebrow={BACK}
      title={name}
      subtitle={['Lecturer', person?.email].filter(Boolean).join(' · ')}
      period={{
        from,
        to,
        onChange: (f, t) => {
          setFrom(f)
          setTo(t)
        },
      }}
    >
      <GlanceCard
        verdict={verdict}
        ring={{
          label: 'Overall lecture ratings',
          center: numbers.scores.overall === null ? '—' : numbers.scores.overall.toFixed(1),
          sub: 'of 5 overall',
          slices: [
            { key: 'positive', label: 'Rated 4–5', value: split.positive, tone: 'good' },
            { key: 'neutral', label: 'Rated 3', value: split.neutral, tone: 'warn' },
            { key: 'negative', label: 'Rated 1–2', value: split.negative, tone: 'bad' },
          ],
        }}
        tiles={[
          { label: 'Lectures rated', value: String(numbers.lectures), hint: `${numbers.reviews} answers` },
          {
            label: 'Pace just right',
            value: percent(numbers.justRight),
            hint: numbers.reviews ? `${numbers.pace.too_fast} too fast · ${numbers.pace.too_slow} too slow` : undefined,
          },
          {
            label: 'Students who answered',
            value: percent(rate),
            hint: answered.length
              ? `${answered.reduce((n, l) => n + l.responses, 0)} of ${answered.reduce((n, l) => n + (l.expected ?? 0), 0)} possible`
              : 'not known',
          },
          {
            label: 'Confidence after',
            value: numbers.scores.confidence === null ? '—' : numbers.scores.confidence.toFixed(1),
            hint: 'of 5: how ready students feel for the task',
          },
        ]}
      />

      <AiSummaryCard
        state={summary}
        source="the feedback students gave on these lectures"
        missing="The server cannot write lecturer summaries yet. The ratings and lectures below still work."
      />

      {feedback.status === 'loading' && <Loading className="admin-muted">Loading the lecture feedback…</Loading>}
      {feedback.status === 'error' && <LoadProblem error="The lecture feedback could not be loaded." onRetry={feedback.reload} />}
      {feedback.status === 'unavailable' && <p className="admin-empty">The server cannot list the lecture feedback yet.</p>}

      {known && (
        <>
          <div className="analytics-pair">
            <section className="admin-panel" aria-label="Scores">
              <h2 className="admin-section-title">Scores</h2>
              <p className="admin-muted analytics-note">Each question of the lecture form, 1–5.</p>
              <ScoreBars
                label="Lecture scores"
                scores={LECTURE_SCORES.map((s) => ({
                  key: s.key,
                  label: s.label,
                  average: numbers.scores[s.key],
                  count: numbers.reviews,
                }))}
              />
            </section>
            <section className="admin-panel" aria-label="Pace">
              <h2 className="admin-section-title">Pace</h2>
              {numbers.reviews === 0 ? (
                <p className="admin-muted">No answers in this period.</p>
              ) : (
                <SegmentedBar
                  label="Pace"
                  parts={[
                    { key: 'too_slow', label: PACE_LABEL.too_slow, value: numbers.pace.too_slow, tone: 'warn' },
                    { key: 'just_right', label: PACE_LABEL.just_right, value: numbers.pace.just_right, tone: 'good' },
                    { key: 'too_fast', label: PACE_LABEL.too_fast, value: numbers.pace.too_fast, tone: 'bad' },
                  ]}
                />
              )}
            </section>
          </div>

          <section className="admin-panel" aria-label="Lecture by lecture">
            <h2 className="admin-section-title">Lecture by lecture</h2>
            <p className="admin-muted analytics-note">Newest first. Answers: the students who answered out of those who could.</p>
            {lectures.length === 0 ? (
              <p className="admin-muted">No lecture of this lecturer was rated in this period.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table analytics-table">
                  <caption className="sr-only">Every rated lecture, newest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Lecture</th>
                      <th scope="col">Date</th>
                      <th scope="col">Answers</th>
                      <th scope="col">Overall</th>
                      <th scope="col">Just right</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lectures.map((l) => (
                      <tr key={l.key}>
                        <th scope="row">
                          {l.title} {l.moduleTitle && <span className="admin-table__muted">{l.moduleTitle}</span>}
                        </th>
                        <td>{formatShortDate(l.startsAt)}</td>
                        <td className="admin-table__num">
                          {l.expected === null ? l.responses : `${l.responses} / ${l.expected}`}
                        </td>
                        <td className="admin-table__num">{l.overall === null ? '—' : l.overall.toFixed(1)}</td>
                        <td className="admin-table__num">{shareOf(l.pace.just_right, l.responses)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AnalyticsShell>
  )
}
