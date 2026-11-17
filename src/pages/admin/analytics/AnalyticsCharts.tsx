import type { ReactNode } from 'react'
import type { AnalyticsWeek, AssignmentStatus, QuizAccuracy } from '../../../types/analytics'
import type { Tone } from '../../../utils/personAnalytics'
import { describeParts, formatWeekDate, shareOf, shortWeek } from './chartFormat'

/** Every chart's numbers as a table, folded away under the chart until asked for. */
export function NumbersTable({ children }: { children: ReactNode }) {
  return (
    <details className="analytics-numbers">
      <summary>Show the numbers</summary>
      {children}
    </details>
  )
}

const STANDING = [
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'red', label: 'Red' },
] as const

/** Weekly Green/Yellow/Red columns. A week with no grades is an empty slot, not three zero segments. */
export function StackedStandingChart({ weeks, label, emptyText }: { weeks: AnalyticsWeek[]; label: string; emptyText: string }) {
  if (weeks.length === 0) return <p className="admin-muted">{emptyText}</p>
  const max = Math.max(1, ...weeks.map((w) => w.total))
  const summary = weeks
    .map((w) =>
      w.total === 0
        ? `${w.moduleTitle}: no grades recorded`
        : `${w.moduleTitle}: ${w.green} green, ${w.yellow} yellow, ${w.red} red of ${w.total} students`,
    )
    .join('; ')

  return (
    <>
      <div className="analytics-weeks" role="img" aria-label={summary}>
        <span className="analytics-weeks__axis" aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </span>
        {weeks.map((w) => (
          <div className="analytics-week" key={w.moduleId}>
            <span className="analytics-week__total">{w.total === 0 ? '' : `${shareOf(w.green, w.total)}%`}</span>
            <div className="analytics-week__plot">
              {w.total === 0 ? (
                <span
                  className="analytics-week__none"
                  title={`${w.moduleTitle} · ${formatWeekDate(w.opensAt)}: no grades recorded`}
                >
                  —
                </span>
              ) : (
                <div className="analytics-week__stack" style={{ height: `${(w.total / max) * 100}%` }}>
                  {STANDING.map((s) => {
                    const count = w[s.key]
                    if (count === 0) return null
                    return (
                      <span
                        key={s.key}
                        className={`analytics-week__seg analytics-fill--${s.key}`}
                        style={{ flexGrow: count }}
                        title={`${w.moduleTitle} · ${s.label}: ${count} of ${w.total} students (${shareOf(count, w.total)}%) · week of ${formatWeekDate(w.opensAt)}`}
                      />
                    )
                  })}
                </div>
              )}
            </div>
            <span className="analytics-week__label" title={`${w.moduleTitle} · week of ${formatWeekDate(w.opensAt)}`}>
              {shortWeek(w.moduleTitle)}
            </span>
          </div>
        ))}
      </div>
      <ul className="analytics-legend" aria-label={`${label} legend`}>
        {STANDING.map((s) => (
          <li key={s.key}>
            <span className={`analytics-dot analytics-fill--${s.key}`} aria-hidden="true" />
            {s.label}
          </li>
        ))}
        <li>The figure over each bar is that week's share of green.</li>
      </ul>
      <NumbersTable>
        <table className="admin-table analytics-table">
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Green</th>
              <th scope="col">Yellow</th>
              <th scope="col">Red</th>
              <th scope="col">Graded</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.moduleId}>
                <th scope="row">
                  {w.moduleTitle} <span className="admin-table__muted">{formatWeekDate(w.opensAt)}</span>
                </th>
                {w.total === 0 ? (
                  <td colSpan={4} className="admin-table__muted">
                    No grades recorded
                  </td>
                ) : (
                  <>
                    <td className="admin-table__num">{w.green}</td>
                    <td className="admin-table__num">{w.yellow}</td>
                    <td className="admin-table__num">{w.red}</td>
                    <td className="admin-table__num">{w.total}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </NumbersTable>
    </>
  )
}

export interface Part {
  key: string
  label: string
  value: number
  tone: Tone
}

/**
 * One whole split into a few parts, as a tall bar: each part's share is printed on it where it fits, and the legend
 * below names the parts with their counts.
 */
export function SegmentedBar({ parts, label }: { parts: Part[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <div className="segbar">
      <div className="segbar__bar" role="img" aria-label={`${label}: ${describeParts(parts)}`}>
        {parts.map((p) =>
          p.value > 0 ? (
            <span
              key={p.key}
              className={`segbar__part donut-fill--${p.tone}`}
              style={{ flexGrow: p.value }}
              title={`${p.label}: ${p.value} of ${total} (${shareOf(p.value, total)}%)`}
            >
              {shareOf(p.value, total) >= 12 ? `${shareOf(p.value, total)}%` : ''}
            </span>
          ) : null,
        )}
      </div>
      <ul className="analytics-legend" aria-label={`${label} legend`}>
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`analytics-dot donut-fill--${p.tone}`} aria-hidden="true" />
            {p.label} <strong>{p.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

const SUBMISSION = [
  { key: 'onTime', label: 'Submitted on time', tone: 'good' },
  { key: 'late', label: 'Submitted late', tone: 'warn' },
  { key: 'missing', label: 'Not submitted', tone: 'bad' },
] as const

/** A student's passed deadlines: on time, late, missed. */
export function SubmissionStatusChart({ status, emptyText }: { status: AssignmentStatus; emptyText: string }) {
  if (status.eligible === 0) return <p className="admin-muted">{emptyText}</p>
  const total = status.eligible
  return (
    <>
      <SegmentedBar
        parts={SUBMISSION.map((s) => ({ key: s.key, label: s.label, value: status[s.key], tone: s.tone }))}
        label="Assignment status"
      />
      <NumbersTable>
        <table className="admin-table analytics-table">
          <caption>Assignment submission status ({total} eligible assignments)</caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Assignments</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {SUBMISSION.map((s) => (
              <tr key={s.key}>
                <th scope="row">{s.label}</th>
                <td className="admin-table__num">{status[s.key]}</td>
                <td className="admin-table__num">{shareOf(status[s.key], total)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Eligible total</th>
              <td className="admin-table__num">{total}</td>
              <td className="admin-table__num">100%</td>
            </tr>
          </tfoot>
        </table>
      </NumbersTable>
    </>
  )
}

/** Accuracy per module, fixed 0-100%. Modules without a scored attempt are named, never drawn as 0%. */
export function AccuracyChart({ quizzes, emptyText }: { quizzes: QuizAccuracy[]; emptyText: string }) {
  if (quizzes.length === 0) return <p className="admin-muted">{emptyText}</p>

  return (
    <>
      <ul className="analytics-bars" aria-label="Quiz accuracy by module">
        {quizzes.map((q) => (
          <li key={q.moduleId}>
            <span className="analytics-bars__label">{q.moduleTitle}</span>
            <span className="analytics-bars__track">
              {q.accuracy === null ? (
                <span className="analytics-bars__nothing">No scored answers</span>
              ) : (
                <span
                  className="analytics-bars__fill"
                  style={{ width: `${q.accuracy}%` }}
                  title={`${q.moduleTitle}: ${q.accuracy}% · ${q.scoreTotal} of ${q.possibleTotal} points · ${q.attemptCount} attempt${q.attemptCount === 1 ? '' : 's'}`}
                />
              )}
            </span>
            <span className="analytics-bars__value">{q.accuracy === null ? '—' : `${q.accuracy}%`}</span>
          </li>
        ))}
      </ul>
      <p className="admin-muted analytics-note">Points earned out of points possible over every attempt in the module, 0–100%.</p>
      <NumbersTable>
        <table className="admin-table analytics-table">
          <caption>Quiz accuracy by module</caption>
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Points</th>
              <th scope="col">Accuracy</th>
              <th scope="col">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((q) => (
              <tr key={q.moduleId}>
                <th scope="row">
                  {q.moduleTitle} <span className="admin-table__muted">{formatWeekDate(q.opensAt)}</span>
                </th>
                <td className="admin-table__num">
                  {q.scoreTotal} / {q.possibleTotal}
                </td>
                <td className="admin-table__num">{q.accuracy === null ? 'No scored answers' : `${q.accuracy}%`}</td>
                <td className="admin-table__num">{q.attemptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </NumbersTable>
    </>
  )
}

export interface Score {
  key: string
  label: string
  average: number | null
  count: number
}

/** A few 1-5 ratings, each on the same fixed 1-5 axis with the number of answers behind it. */
export function ScoreBars({ scores, label }: { scores: Score[]; label: string }) {
  return (
    <>
      <ul className="analytics-bars analytics-bars--scale" aria-label={label}>
        {scores.map((s) => (
          <li key={s.key}>
            <span className="analytics-bars__label">{s.label}</span>
            <span className="analytics-bars__track">
              {s.average === null ? (
                <span className="analytics-bars__nothing">No responses</span>
              ) : (
                <span
                  className="analytics-bars__fill"
                  style={{ width: `${((s.average - 1) / 4) * 100}%` }}
                  title={`${s.label}: ${s.average.toFixed(1)} of 5 from ${s.count} response${s.count === 1 ? '' : 's'}`}
                />
              )}
            </span>
            <span className="analytics-bars__value">{s.average === null ? 'n=0' : `${s.average.toFixed(1)} · n=${s.count}`}</span>
          </li>
        ))}
      </ul>
      <div className="analytics-axis" aria-hidden="true">
        <span />
        <span className="analytics-axis__ticks">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </span>
        <span />
      </div>
      <NumbersTable>
        <table className="admin-table analytics-table">
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Average (1–5)</th>
              <th scope="col">Responses</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.key}>
                <th scope="row">{s.label}</th>
                <td className="admin-table__num">{s.average === null ? 'No responses' : s.average.toFixed(1)}</td>
                <td className="admin-table__num">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </NumbersTable>
    </>
  )
}

/** Small shared building blocks for the pages' loading and failure states. */
export function LoadProblem({ error, onRetry, children }: { error: string | null; onRetry: () => void; children?: ReactNode }) {
  return (
    <div className="admin-empty">
      <p>{error ?? 'Could not load analytics.'}</p>
      <div className="analytics-actions">
        <button type="button" className="admin-btn" onClick={onRetry}>
          Try again
        </button>
        {children}
      </div>
    </div>
  )
}
