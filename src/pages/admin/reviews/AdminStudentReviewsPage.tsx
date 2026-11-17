import { useMemo, useState } from 'react'
import { ALL, FilterChips, FilterMenu } from '../../../components/filter/FilterMenu'
import type { FilterGroup } from '../../../components/filter/FilterMenu'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useCourses } from '../../../hooks/useCourses'
import { useStudentReviews } from '../../../hooks/useStudentReviews'
import { STANDING_LABEL } from '../../../utils/standing'
import { ALL_STUDENT_REVIEWS, filterStudentReviews, mentorsOf } from '../../../utils/studentReviews'
import type { StudentReviewFilter, StudentShow } from '../../../utils/studentReviews'
import { latestWeekFirst, weekNamer } from '../../../utils/weekNames'
import { StudentReviewCard } from './StudentReviewCard'
import './reviews.css'

const PAGE = 20
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Admin: what the mentors say about their students. Every weekly grade (green, yellow or red) with the module feedback the
 * mentor wrote, in one list. Filter by week, mentor, words or grade. Read-only: a mentor gives and changes grades on their
 * own Grading page. No averages here: the numbers are on the Analytics pages.
 */
export default function AdminStudentReviewsPage() {
  const { status, reviews, reload } = useStudentReviews()
  const { modules } = useCourses()
  const [filter, setFilter] = useState<StudentReviewFilter>(ALL_STUDENT_REVIEWS)
  const [shown, setShown] = useState(PAGE)
  const set = (patch: Partial<StudentReviewFilter>) => {
    setFilter((f) => ({ ...f, ...patch }))
    setShown(PAGE)
  }

  /** "Week 5 · Go Basics" from the course; the server's own title when the course does not know the module. */
  const week = useMemo(() => weekNamer(modules, new Map(reviews.map((r) => [r.moduleId, r.moduleTitle]))), [modules, reviews])
  const weeks = useMemo(() => latestWeekFirst(reviews.map((r) => r.moduleId), modules), [modules, reviews])
  const mentors = useMemo(() => mentorsOf(reviews), [reviews])

  const filterGroups: FilterGroup[] = [
    { id: 'week', label: 'Week', value: filter.moduleId, options: [{ value: ALL, label: 'All weeks' }, ...weeks.map((id) => ({ value: id, label: week(id) }))] },
    {
      id: 'mentor',
      label: 'Mentor',
      value: String(filter.mentorId),
      options: [{ value: ALL, label: 'All mentors' }, ...mentors.map((m) => ({ value: String(m.id), label: m.name }))],
    },
  ]
  const choose = (id: string, value: string) => set(id === 'week' ? { moduleId: value } : { mentorId: value === ALL ? 'all' : Number(value) })

  const rows = useMemo(() => filterStudentReviews(reviews, filter), [reviews, filter])
  // the counts on the grade buttons follow the other filters
  const count = useMemo(() => {
    const base = { ...filter, show: 'all' as StudentShow }
    return (show: StudentShow) => filterStudentReviews(reviews, { ...base, show }).length
  }, [reviews, filter])

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Student reviews</h1>
          <p className="page-subtitle">What the mentors say about their students, week by week.</p>
        </div>
        <button type="button" className="admin-btn" onClick={reload}>
          <Icon name="reset" size={16} /> Refresh
        </button>
      </header>

      {status === 'loading' && <Loading className="admin-muted">Loading the reviews…</Loading>}

      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The reviews could not be loaded.</p>
          <button type="button" className="admin-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'unavailable' && (
        <div className="admin-empty" role="status">
          <p>The server does not let this account read the weekly grades yet.</p>
          <p className="admin-muted">The mentors&apos; reviews of their students appear here as soon as it does (GET /modules/:id/enrollments).</p>
        </div>
      )}

      {status === 'ready' && reviews.length === 0 && <p className="admin-empty">No student reviews yet. Mentors grade each student&apos;s week from their Grading page.</p>}

      {status === 'ready' && reviews.length > 0 && (
        <>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Search student, mentor, team or feedback"
                aria-label="Search student reviews"
                value={filter.query}
                onChange={(e) => set({ query: e.target.value })}
              />
            </label>
            <FilterMenu groups={filterGroups} onChange={choose} onClear={() => set({ moduleId: 'all', mentorId: 'all' })} />
          </div>

          <FilterChips groups={filterGroups} onChange={choose} />

          <div className="admin-segmented" role="group" aria-label="Kind of review">
            {(
              [
                ['all', 'All'],
                ['red', STANDING_LABEL.red],
                ['yellow', STANDING_LABEL.yellow],
                ['green', STANDING_LABEL.green],
                ['comments', 'With feedback'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter.show === value} onClick={() => set({ show: value })}>
                {label} <span className="admin-segmented__count">{count(value)}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="admin-empty">
              <p>No reviews match.</p>
              <button type="button" className="admin-btn" onClick={() => set(ALL_STUDENT_REVIEWS)}>
                Clear filters
              </button>
            </div>
          ) : (
            <section className="admin-page" aria-labelledby="student-reviews-list">
              <h2 id="student-reviews-list" className="admin-section-title">
                Reviews
              </h2>
              <p className="admin-muted" aria-live="polite">
                {rows.length === reviews.length ? plural(rows.length, 'review') : `${rows.length} of ${plural(reviews.length, 'review')}`}, newest first
              </p>
              <ul className="admin-reviews" aria-label="Reviews">
                {rows.slice(0, shown).map((r) => (
                  <StudentReviewCard key={r.id} review={r} week={week(r.moduleId)} />
                ))}
              </ul>
              {rows.length > shown && (
                <button type="button" className="admin-btn admin-reviews__more" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({rows.length - shown} left)
                </button>
              )}
            </section>
          )}
        </>
      )}
    </section>
  )
}
