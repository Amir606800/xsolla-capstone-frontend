import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { fetchModules } from '../api/courses'
import { fetchTeams, fetchUsers } from '../api/directory'
import { fetchEvents } from '../api/events'
import { fetchBroadcasts } from '../api/notifications'
import { attentionCount, buildAlerts } from '../utils/adminAlerts'
import type { AdminAlert } from '../utils/adminAlerts'
import { AdminAlertsContext } from './adminAlerts'
import type { LoadStatus } from './courses'

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

  useEffect(() => {
    let alive = true
    Promise.allSettled([fetchModules(), fetchUsers(), fetchTeams(), fetchEvents(), fetchBroadcasts()]).then(
      ([modules, users, teams, events, sent]) => {
        if (!alive) return
        const ok = <T,>(r: PromiseSettledResult<T>, fallback: T) => (r.status === 'fulfilled' ? r.value : fallback)
        const everything = [modules, users, teams, events, sent].every((r) => r.status === 'rejected')
        setAlerts(
          buildAlerts(
            { modules: ok(modules, []), users: ok(users, []), teams: ok(teams, []), events: ok(events, []), sent: ok(sent, []) },
            new Date(),
          ),
        )
        setStatus(everything ? 'error' : 'ready')
      },
    )
    return () => {
      alive = false
    }
    // looked at again on every move to another page, and on "Refresh"
  }, [pathname, attempt])

  const reload = useCallback(() => setAttempt((a) => a + 1), [])
  const value = useMemo(() => ({ status, alerts, attention: attentionCount(alerts), reload }), [status, alerts, reload])
  return <AdminAlertsContext.Provider value={value}>{children}</AdminAlertsContext.Provider>
}
