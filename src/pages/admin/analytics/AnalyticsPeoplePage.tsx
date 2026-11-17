import { useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { StandingPill } from '../../../components/StandingPill'
import { useAnalyticsPeople } from '../../../hooks/useAnalytics'
import type { AnalyticsRole } from '../../../types/analytics'
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
  // students show the colour of the AVERAGE of their week grades beside their name (the server works it out), so one
  // bad week after many good ones does not paint the whole student red
  const students = role === 'students'

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
              return (
                <li key={p.id}>
                  <Link to={`/admin/analytics/${role}/${p.id}`}>
                    <span className="analytics-people__name">{p.name}</span>
                    {p.email && <span className="analytics-people__email">{p.email}</span>}
                    {students &&
                      (p.gradeLevel && p.gradeAverage !== undefined ? (
                        <span className="analytics-people__grade">
                          <StandingPill level={p.gradeLevel} />
                          <span
                            className="analytics-people__average"
                            title={`Average of ${p.gradedWeeks ?? ''} graded weeks (red 1, yellow 2, green 3)`}
                          >
                            avg {p.gradeAverage.toFixed(1)}
                          </span>
                        </span>
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
