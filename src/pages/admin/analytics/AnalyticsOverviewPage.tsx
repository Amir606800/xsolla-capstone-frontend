import { useState } from 'react'
import { Link } from 'react-router'
import { Loading } from '../../../components/loading/Loading'
import { formatDateTime } from '../../../utils/date'
import { useOverview } from '../../../hooks/useAnalytics'
import { AnalyticsPeriod } from './AnalyticsPeriod'
import { StackedStandingChart } from './AnalyticsCharts'
import './analytics.css'

/** Admin: the school's weekly Green/Yellow/Red distribution. */
export default function AnalyticsOverviewPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const report = useOverview(from, to)

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">How the school's standing is spread across weeks. Grades come from the mentors' weekly review.</p>
      </header>

      <div className="admin-toolbar">
        <AnalyticsPeriod from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <div className="analytics-links">
          <Link className="admin-btn" to="/admin/analytics/students">
            Student analytics
          </Link>
          <Link className="admin-btn" to="/admin/analytics/mentors">
            Mentor analytics
          </Link>
        </div>
      </div>

      {report.status === 'loading' && <Loading className="admin-muted">Loading analytics…</Loading>}

      {report.status === 'error' && (
        <div className="admin-empty">
          <p>{report.error}</p>
          <button type="button" className="admin-btn" onClick={report.reload}>
            Try again
          </button>
        </div>
      )}

      {report.status === 'ready' && report.data && (
        <>
          <p className="admin-muted analytics-updated">
            {report.data.period.from} to {report.data.period.to} · updated {formatDateTime(report.data.generatedAt)}
          </p>
          <div className="admin-panel">
            <h2 className="admin-section-title">Weekly student standing</h2>
            <StackedStandingChart
              weeks={report.data.weeks}
              label="Weekly student standing"
              emptyText="No modules opened in this period."
            />
          </div>
        </>
      )}
    </section>
  )
}
