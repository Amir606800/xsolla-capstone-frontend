import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useStudentAnalytics } from '../../../hooks/useAnalytics'
import { formatDateTime } from '../../../utils/date'
import { AnalyticsPeriod } from './AnalyticsPeriod'
import { AccuracyChart, SubmissionStatusChart } from './AnalyticsCharts'
import './analytics.css'

/** Admin: one student's deadline compliance and quiz accuracy. */
export default function StudentAnalyticsPage() {
  const params = useParams()
  const id = Number(params.studentId)
  const studentId = Number.isInteger(id) && id > 0 ? id : null
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const report = useStudentAnalytics(studentId, from, to)

  if (report.status === 'ready' && !report.data) {
    return (
      <section className="admin-page">
        <header className="admin-page__head">
          <h1 className="page-title">Student not found</h1>
          <p className="page-subtitle">That student does not exist, or no longer holds the student role.</p>
        </header>
        <Link className="admin-btn" to="/admin/analytics/students">
          <Icon name="back" size={16} /> Back to students
        </Link>
      </section>
    )
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <p className="admin-eyebrow">
          <Link to="/admin/analytics/students">Student analytics</Link>
        </p>
        <h1 className="page-title">{report.data?.student.name ?? 'Student'}</h1>
        {report.data && <p className="page-subtitle">Student #{report.data.student.id}</p>}
      </header>

      {report.status === 'loading' && <Loading className="admin-muted">Loading this student's analytics…</Loading>}

      {report.status === 'error' && (
        <div className="admin-empty">
          <p>{report.error}</p>
          <div className="analytics-actions">
            <button type="button" className="admin-btn" onClick={report.reload}>
              Try again
            </button>
            <Link className="admin-btn" to="/admin/analytics/students">
              Back to students
            </Link>
          </div>
        </div>
      )}

      {report.status === 'ready' && report.data && (
        <>
          <div className="admin-toolbar">
            <AnalyticsPeriod from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
            <Link className="admin-btn analytics-back" to="/admin/analytics/students">
              <Icon name="back" size={16} /> Back to students
            </Link>
          </div>
          <p className="admin-muted analytics-updated">
            {report.data.period.from} to {report.data.period.to} · updated {formatDateTime(report.data.generatedAt)}
          </p>

          <div className="admin-panel">
            <h2 className="admin-section-title">Assignment submission status</h2>
            <p className="admin-muted analytics-note">Assignments whose deadline has passed, in modules the student is enrolled in.</p>
            <SubmissionStatusChart
              status={report.data.status}
              emptyText="No assignments were due in this period."
            />
          </div>

          <div className="admin-panel">
            <h2 className="admin-section-title">Quiz accuracy by module</h2>
            <AccuracyChart quizzes={report.data.quizzes} emptyText="No quiz attempts in this period." />
          </div>
        </>
      )}
    </section>
  )
}
