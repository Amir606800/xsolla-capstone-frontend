import type { AnalyticsWeek, AssignmentStatus, FeedbackDimension, QuizAccuracy } from '../../../types/analytics'

const schoolDate = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Baku', month: 'short', day: 'numeric' })

/** "Sep 21": the module's opening date as a school date (never the browser's time zone). */
const formatWeekDate = (iso: string) => schoolDate.format(new Date(iso))

const share = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100))

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
        {weeks.map((w) => (
          <div className="analytics-week" key={w.moduleId}>
            <div className="analytics-week__plot">
              {w.total === 0 ? (
                <span className="analytics-week__none" title={`${w.moduleTitle} · ${formatWeekDate(w.opensAt)}: no grades recorded`}>
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
                        title={`${w.moduleTitle} · ${s.label}: ${count} of ${w.total} students (${share(count, w.total)}%) · week of ${formatWeekDate(w.opensAt)}`}
                      />
                    )
                  })}
                </div>
              )}
            </div>
            <span className="analytics-week__label" title={`${w.moduleTitle} · week of ${formatWeekDate(w.opensAt)}`}>
              {w.moduleTitle}
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
        <li className="admin-muted">Each bar counts the students with a recorded grade that week.</li>
      </ul>
      <table className="admin-table analytics-table">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Green</th>
            <th scope="col">Yellow</th>
            <th scope="col">Red</th>
            <th scope="col">Total</th>
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
    </>
  )
}

const SUBMISSION = [
  { key: 'onTime', label: 'Submitted on time', className: 'on-time' },
  { key: 'late', label: 'Submitted late', className: 'late' },
  { key: 'missing', label: 'Not submitted', className: 'missing' },
] as const

/** One horizontal stacked bar for a student's passed deadlines. */
export function SubmissionStatusChart({ status, emptyText }: { status: AssignmentStatus; emptyText: string }) {
  if (status.eligible === 0) return <p className="admin-muted">{emptyText}</p>
  const total = status.eligible

  return (
    <>
      <div className="analytics-status">
        <div className="analytics-status__bar" role="img" aria-label={`${status.onTime} on time, ${status.late} late, ${status.missing} missing of ${total} eligible assignments`}>
          {SUBMISSION.map((s) =>
            status[s.key] > 0 ? (
              <span
                key={s.key}
                className={`analytics-status__seg analytics-fill--${s.className}`}
                style={{ flexGrow: status[s.key] }}
                title={`${s.label}: ${status[s.key]} of ${total} (${share(status[s.key], total)}%)`}
              />
            ) : null,
          )}
        </div>
        <ul className="analytics-legend" aria-label="Assignment status legend">
          {SUBMISSION.map((s) => (
            <li key={s.key}>
              <span className={`analytics-dot analytics-fill--${s.className}`} aria-hidden="true" />
              {s.label} <strong>{status[s.key]}</strong>
            </li>
          ))}
        </ul>
      </div>
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
              <td className="admin-table__num">{share(status[s.key], total)}%</td>
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
      <p className="admin-muted analytics-note">Score accuracy: points earned out of points possible across all attempts in the module. Scale 0–100%.</p>
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
    </>
  )
}

const DIMENSION_LABEL: Record<FeedbackDimension['dimension'], string> = {
  clarity: 'Clarity',
  engagement: 'Engagement',
  comfort: 'Comfort',
  time: 'Time management',
}

/** Four student-rated dimensions on a fixed 1-5 scale. */
export function DimensionChart({ feedback }: { feedback: FeedbackDimension[] }) {
  return (
    <>
      <div className="analytics-bars analytics-bars--scale" aria-label="Feedback by dimension">
        {feedback.map((f) => (
          <div className="analytics-bars__row" key={f.dimension}>
            <span className="analytics-bars__label">{DIMENSION_LABEL[f.dimension]}</span>
            <span className="analytics-bars__track">
              {f.average === null ? (
                <span className="analytics-bars__nothing">No responses</span>
              ) : (
                <span
                  className="analytics-bars__fill"
                  style={{ width: `${((f.average - 1) / 4) * 100}%` }}
                  title={`${DIMENSION_LABEL[f.dimension]}: ${f.average.toFixed(1)} of 5 from ${f.count} response${f.count === 1 ? '' : 's'}`}
                />
              )}
            </span>
            <span className="analytics-bars__value">{f.average === null ? 'n=0' : `${f.average.toFixed(1)} · n=${f.count}`}</span>
          </div>
        ))}
      </div>
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
      <p className="admin-muted analytics-note">Average rating, 1–5, and the number of ratings behind it. Small samples are shown as they are, not as representative.</p>
      <table className="admin-table analytics-table">
        <caption>Student feedback by dimension</caption>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col">Average (1–5)</th>
            <th scope="col">Responses</th>
          </tr>
        </thead>
        <tbody>
          {feedback.map((f) => (
            <tr key={f.dimension}>
              <th scope="row">{DIMENSION_LABEL[f.dimension]}</th>
              <td className="admin-table__num">{f.average === null ? 'No responses' : f.average.toFixed(1)}</td>
              <td className="admin-table__num">{f.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
