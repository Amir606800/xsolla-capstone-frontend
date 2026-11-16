import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useMentorAnalytics } from '../../../hooks/useAnalytics'
import { formatDateTime } from '../../../utils/date'
import { AnalyticsPeriod } from './AnalyticsPeriod'
import { DimensionChart, StackedStandingChart } from './AnalyticsCharts'
import './analytics.css'

/** Admin: one mentor's student feedback and their students' weekly standing. */
export default function MentorAnalyticsPage() {
  const params = useParams()
  const id = Number(params.mentorId)
  const mentorId = Number.isInteger(id) && id > 0 ? id : null
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const report = useMentorAnalytics(mentorId, from, to)

  if (report.status === 'ready' && !report.data) {
    return (
      <section className="admin-page">
        <header className="admin-page__head">
          <h1 className="page-title">Mentor not found</h1>
          <p className="page-subtitle">That mentor does not exist, or no longer holds the mentor role.</p>
        </header>
        <Link className="admin-btn" to="/admin/analytics/mentors">
          <Icon name="back" size={16} /> Back to mentors
        </Link>
      </section>
    )
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <p className="admin-eyebrow">
          <Link to="/admin/analytics/mentors">Mentor analytics</Link>
        </p>
        <h1 className="page-title">{report.data?.mentor.name ?? 'Mentor'}</h1>
        {report.data && <p className="page-subtitle">Mentor #{report.data.mentor.id}</p>}
      </header>

      {report.status === 'loading' && <Loading className="admin-muted">Loading this mentor's analytics…</Loading>}

      {report.status === 'error' && (
        <div className="admin-empty">
          <p>{report.error}</p>
          <div className="analytics-actions">
            <button type="button" className="admin-btn" onClick={report.reload}>
              Try again
            </button>
            <Link className="admin-btn" to="/admin/analytics/mentors">
              Back to mentors
            </Link>
          </div>
        </div>
      )}

      {report.status === 'ready' && report.data && (
        <>
          <div className="admin-toolbar">
            <AnalyticsPeriod from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <Link className="admin-btn analytics-back" to="/admin/analytics/mentors">
              <Icon name="back" size={16} /> Back to mentors
            </Link>
          </div>
          <p className="admin-muted analytics-updated">
            {report.data.period.from} to {report.data.period.to} · updated {formatDateTime(report.data.generatedAt)}
          </p>

          <div className="admin-panel">
            <h2 className="admin-section-title">Student feedback by dimension</h2>
            <DimensionChart feedback={report.data.feedback} />
          </div>

          <div className="admin-panel">
            <h2 className="admin-section-title">Students' weekly standing</h2>
            {report.data.attribution === 'current_roster' && (
              <p className="admin-muted analytics-note">
                Uses the mentor's current team. Past weeks are not attributed to the mentor students had at the time.
              </p>
            )}
            <StackedStandingChart
              weeks={report.data.weeks}
              label="The mentor's students by week"
              emptyText="No modules opened in this period."
            />
          </div>
        </>
      )}
    </section>
  )
}
