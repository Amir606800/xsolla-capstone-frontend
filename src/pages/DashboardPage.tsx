import { useCallback, useMemo, useState } from 'react'
import { AddWidgetsModal } from '../components/dashboard/AddWidgetsModal'
import { DashboardWidgets } from '../components/dashboard/DashboardWidgets'
import type { DashboardData } from '../components/dashboard/DashboardWidgetBody'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useCourses } from '../hooks/useCourses'
import { useDashboardLayout } from '../hooks/useDashboardLayout'
import { useModuleAccess } from '../hooks/useModuleAccess'
import { useStandings } from '../hooks/useStandings'
import { hiddenWidgets } from '../utils/dashboardLayout'
import { overallStats, recentActivity, recentGrades, upcomingDeadlines } from '../utils/progress'
import '../styles/ui.css'
import '../components/dashboard/dashboard.css'
import { DashboardSkeleton } from '../components/loading/Skeleton'

export default function DashboardPage() {
  const { user } = useAuth()
  const { status, modules, now, reload } = useCourses()
  const isLocked = useModuleAccess()
  const { layout, reset } = useDashboardLayout()
  const { summary: standing } = useStandings()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  const data = useMemo<DashboardData>(() => {
    // tasks and events of modules that are not open yet stay hidden from students
    const open = modules.filter((m) => !isLocked(m))
    return {
      modules,
      now,
      isLocked,
      stats: overallStats(modules, now),
      standing,
      deadlines: upcomingDeadlines(open, now, 5),
      grades: recentGrades(modules, 4),
      activity: recentActivity(open, now, 6),
    }
  }, [modules, now, isLocked, standing])

  const openAdd = useCallback(() => setAdding(true), [])
  const hiddenCount = hiddenWidgets(layout).length

  return (
    <section className="dash">
      <div className="dash__top">
        <div>
          <h1 className="page-title">Welcome, {user?.name}</h1>
          <p className="page-subtitle">Let&apos;s see what&apos;s on your plate</p>
        </div>

        {status === 'ready' && (
          <div className="dash__tools">
            {editing ? (
              <>
                <button type="button" className="btn btn--ghost" onClick={openAdd}>
                  <Icon name="plus" size={18} />
                  Add widget{hiddenCount > 0 ? ` (${hiddenCount})` : ''}
                </button>
                <button type="button" className="btn btn--ghost" onClick={reset}>
                  <Icon name="reset" size={18} />
                  Reset to default
                </button>
                <button type="button" className="btn" onClick={() => setEditing(false)}>
                  <Icon name="check" size={18} />
                  Done
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                <Icon name="edit" size={18} />
                Edit dashboard
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <p className="dash__hint">
          Drag a widget by its handle or use the arrows to move it, pick a width, or remove it. Changes are saved
          automatically.
        </p>
      )}

      {status === 'loading' && <DashboardSkeleton />}

      {status === 'error' && (
        <div className="dash__state" role="alert">
          <p>We couldn&apos;t load your course.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && <DashboardWidgets data={data} editing={editing} onAddClick={openAdd} />}

      <AddWidgetsModal open={adding} onClose={() => setAdding(false)} />
    </section>
  )
}
