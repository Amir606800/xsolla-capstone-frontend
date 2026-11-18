import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { fetchModules } from '../api/courses'
import { fetchTeams, fetchUsers } from '../api/directory'
import { fetchEvents } from '../api/events'
import { fetchBroadcasts } from '../api/notifications'
import { useLive } from '../hooks/useLive'
import { attentionCount, buildAlerts } from '../utils/adminAlerts'
import { keepIfSame } from '../utils/same'
import type { AdminAlert } from '../utils/adminAlerts'
import { AdminAlertsContext } from './adminAlerts'
import type { LoadStatus } from './courses'
import { serverNow } from '../utils/serverTime'

/**
 * Loads what the admin needs to be told about (the school's data, looked at as a whole) once for the whole
 * admin area, and again after every move to another page, so the badge on the sidebar follows the changes
 * made on the other pages. A source that fails is left out; the rest still count.
 */
export function AdminAlertsProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [attempt, setAttempt] = useState(0)

  // the whole school, looked at as one: what each source gave, and whether all of them failed
  const look = useCallback(
    () =>
      Promise.allSettled([fetchModules(), fetchUsers(), fetchTeams(), fetchEvents(), fetchBroadcasts()]).then(
        ([modules, users, teams, events, sent]) => {
          const ok = <T,>(r: PromiseSettledResult<T>, fallback: T) => (r.status === 'fulfilled' ? r.value : fallback)
          return {
            failed: [modules, users, teams, events, sent].every((r) => r.status === 'rejected'),
            alerts: buildAlerts(
              { modules: ok(modules, []), users: ok(users, []), teams: ok(teams, []), events: ok(events, []), sent: ok(sent, []) },
              serverNow(),
            ),
          }
        },
      ),
    [],
  )

  useEffect(() => {
    let alive = true
    look().then(({ failed, alerts: found }) => {
      if (!alive) return
      setAlerts(keepIfSame(found))
      setStatus(failed ? 'error' : 'ready')
    })
    return () => {
      alive = false
    }
    // looked at again on every move to another page, and on "Refresh"
  }, [pathname, attempt, look])

  // ...and quietly whenever anything is saved, and now and then: the badge on the sidebar follows the changes of other people too
  const refresh = useCallback(() => {
    look().then(({ failed, alerts: found }) => {
      if (!failed) setAlerts(keepIfSame(found))
    })
  }, [look])
  useLive(['courses', 'directory', 'events', 'notifications'], refresh, { enabled: status === 'ready' })

  const reload = useCallback(() => setAttempt((a) => a + 1), [])
  const value = useMemo(() => ({ status, alerts, attention: attentionCount(alerts), reload }), [status, alerts, reload])
  return <AdminAlertsContext.Provider value={value}>{children}</AdminAlertsContext.Provider>
}
