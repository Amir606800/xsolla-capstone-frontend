import { useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useAnalyticsPeople } from '../../../hooks/useAnalytics'
import './analytics.css'

/** Admin: search the students or mentors and open one person's analytics. */
export default function AnalyticsPeoplePage({ role }: { role: 'students' | 'mentors' }) {
  const [search, setSearch] = useState('')
  const list = useAnalyticsPeople(role, search)
  const person = role === 'students' ? 'student' : 'mentor'

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">{role === 'students' ? 'Student analytics' : 'Mentor analytics'}</h1>
        <p className="page-subtitle">
          {role === 'students'
            ? 'Search for a student to see their submissions and quiz accuracy.'
            : 'Search for a mentor to see their feedback and their students’ standing.'}
        </p>
      </header>

      <div className="admin-toolbar">
        <label className="admin-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder={`Search ${role} by name or email`}
            aria-label={`Search ${role}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Link className="admin-btn analytics-back" to="/admin/analytics">
          <Icon name="back" size={16} /> Overview
        </Link>
      </div>

      {list.status === 'loading' && <Loading className="admin-muted">Loading {role}…</Loading>}

      {list.status === 'error' && (
        <div className="admin-empty">
          <p>{list.error}</p>
          <button type="button" className="admin-btn" onClick={list.reload}>
            Try again
          </button>
        </div>
      )}

      {list.status === 'ready' && list.people.length === 0 && (
        <div className="admin-empty">
          <p>{search.trim() ? `No ${role} match “${search.trim()}”.` : `No ${role} found.`}</p>
        </div>
      )}

      {list.status === 'ready' && list.people.length > 0 && (
        <>
          <ul className="analytics-people" aria-label={`${role === 'students' ? 'Students' : 'Mentors'}`}>
            {list.people.map((p) => (
              <li key={p.id}>
                <Link to={`/admin/analytics/${role}/${p.id}`}>
                  <span className="analytics-people__name">{p.name}</span>
                  {p.email && <span className="analytics-people__email">{p.email}</span>}
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
          {!list.done && (
            <button type="button" className="admin-btn analytics-more" onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? `Loading more ${role}…` : `Show more ${role}`}
            </button>
          )}
        </>
      )}

      <p className="admin-muted analytics-note">Showing up to 20 {person}s per page, requested from the server.</p>
    </section>
  )
}
