import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchModules } from '../../api/courses'
import { fetchTeams, fetchUsers, teamsAreDemoData } from '../../api/directory'
import { fetchEvents } from '../../api/events'
import { Icon } from '../../components/Icon'
import { adminSection } from '../../config/adminNav'
import { useAuth } from '../../hooks/useAuth'
import { type Loaded, type OverviewData, overviewTiles } from '../../utils/adminOverview'

const settle = <T,>(p: PromiseSettledResult<T>): Loaded<T> => (p.status === 'fulfilled' ? { ok: true, value: p.value } : { ok: false })

/** Admin landing page: one count per section, each a link to that section. */
export default function AdminHomePage() {
  const { user } = useAuth()
  const [data, setData] = useState<OverviewData | null>(null)

  useEffect(() => {
    let alive = true
    // each source on its own: one failing (e.g. a route the backend lacks) does not hide the others
    Promise.allSettled([fetchModules(), fetchUsers(), fetchTeams(), fetchEvents()]).then(([modules, users, teams, events]) => {
      if (alive) setData({ modules: settle(modules), users: settle(users), teams: settle(teams), events: settle(events) })
    })
    return () => {
      alive = false
    }
  }, [])

  const tiles = data ? overviewTiles(data, new Date(), { demoTeams: teamsAreDemoData() }) : null

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">Signed in as {user?.name}. Pick a section to manage it.</p>
      </header>

      {!tiles ? (
        <p className="admin-muted" role="status">
          Loading…
        </p>
      ) : (
        <ul className="admin-tiles" aria-label="School at a glance">
          {tiles.map((t) => {
            const s = adminSection(t.key)
            return (
              <li key={t.key}>
                <Link to={s.path} className="admin-tile">
                  <span className="admin-tile__label">
                    <Icon name={s.icon} size={18} /> {s.label}
                  </span>
                  <span className="admin-tile__value">{t.value ?? '—'}</span>
                  <span className={`admin-tile__hint${t.value === null ? ' is-error' : ''}`}>{t.hint}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
