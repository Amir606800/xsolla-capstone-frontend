import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { StandingPill } from '../../../components/StandingPill'
import { useAnalyticsPeople } from '../../../hooks/useAnalytics'
import { useStudentReviews } from '../../../hooks/useStudentReviews'
import type { AnalyticsRole } from '../../../types/analytics'
import { standingsByStudent } from '../../../utils/personAnalytics'
import { AnalyticsShell } from './AnalyticsShell'

const TEXT: Record<AnalyticsRole, { title: string; subtitle: string; person: string; list: string }> = {
  students: {
    title: 'Student analytics',
    subtitle: 'Pick a student to see how they are doing: their standing, the AI summary of their feedback, hand-ins and quizzes.',
    person: 'student',
    list: 'Students',
  },
  mentors: {
    title: 'Mentor analytics',
    subtitle:
      'Pick a mentor to see what their students say about them, how their team is doing, and the AI summary of their reviews.',
    person: 'mentor',
    list: 'Mentors',
  },
  lecturers: {
    title: 'Lecturer analytics',
    subtitle: 'Pick a lecturer to see how students rate their lectures, the pace, and the AI summary of the feedback.',
    person: 'lecturer',
    list: 'Lecturers',
  },
}

/** Admin: search the students, mentors or lecturers and open one person's analytics. */
export default function AnalyticsPeoplePage({ role }: { role: AnalyticsRole }) {
  const [search, setSearch] = useState('')
  const list = useAnalyticsPeople(role, search)
  const text = TEXT[role]
  // students show how they stand now beside their name (the grades are loaded once for the whole list)
  const grades = useStudentReviews(role === 'students')
  const standings = useMemo(() => (role === 'students' ? standingsByStudent(grades.reviews) : null), [role, grades.reviews])

  return (
    <AnalyticsShell title={text.title} subtitle={text.subtitle}>
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
          <ul className="analytics-people" aria-label={text.list}>
            {list.people.map((p) => {
              const now = standings?.get(p.id)
              return (
                <li key={p.id}>
                  <Link to={`/admin/analytics/${role}/${p.id}`}>
                    <span className="analytics-people__name">{p.name}</span>
                    {p.email && <span className="analytics-people__email">{p.email}</span>}
                    {standings &&
                      (now?.summary.current ? (
                        <StandingPill level={now.summary.current} />
                      ) : (
                        <span className="admin-pill">Not graded yet</span>
                      ))}
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </li>
              )
            })}
          </ul>
          {!list.done && (
            <button type="button" className="admin-btn analytics-start" onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? `Loading more ${role}…` : `Show more ${role}`}
            </button>
          )}
        </>
      )}

      <p className="admin-muted analytics-note">Showing up to 20 {text.person}s at a time.</p>
    </AnalyticsShell>
  )
}
