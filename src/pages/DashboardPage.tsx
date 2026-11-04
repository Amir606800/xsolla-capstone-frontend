import { useMemo } from 'react'
import { DeadlinesCard } from '../components/dashboard/DeadlinesCard'
import { JourneyPath } from '../components/dashboard/JourneyPath'
import { RecentGradesCard } from '../components/dashboard/RecentGradesCard'
import { ScoreCard } from '../components/dashboard/ScoreCard'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useCourses } from '../hooks/useCourses'
import { overallStats, recentGrades, upcomingDeadlines } from '../utils/progress'
import '../styles/ui.css'
import '../components/dashboard/dashboard.css'

export default function DashboardPage() {
  const { user } = useAuth()
  const { status, modules, now, reload } = useCourses()

  const stats = useMemo(() => overallStats(modules, now), [modules, now])
  const deadlines = useMemo(() => upcomingDeadlines(modules, now, 5), [modules, now])
  const grades = useMemo(() => recentGrades(modules, 4), [modules])

  return (
    <section className="dash">
      <h1 className="page-title">Welcome, {user?.name}</h1>
      <p className="page-subtitle">Let&apos;s see what&apos;s on your plate</p>

      {status === 'loading' && (
        <p className="dash__state" role="status">
          Loading your course…
        </p>
      )}

      {status === 'error' && (
        <div className="dash__state" role="alert">
          <p>We couldn&apos;t load your course.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <section className="card card--progress" aria-labelledby="progress-title">
            <header className="card__head">
              <span className="card__icon card__icon--accent">
                <Icon name="check" size={20} />
              </span>
              <h2 id="progress-title">Progress</h2>
            </header>
            <div className="progress">
              <ScoreCard stats={stats} />
              <div className="progress__path">
                <JourneyPath modules={modules} now={now} />
              </div>
            </div>
          </section>

          <div className="dash__grid">
            <DeadlinesCard entries={deadlines} now={now} />
            <RecentGradesCard entries={grades} />
          </div>
        </>
      )}
    </section>
  )
}
