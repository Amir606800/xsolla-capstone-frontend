import { useMemo, useState } from 'react'
import { ALL, FilterChips, FilterMenu } from '../../../components/filter/FilterMenu'
import type { FilterGroup } from '../../../components/filter/FilterMenu'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useAdminLectureReviews } from '../../../hooks/useAdminLectureReviews'
import { useCourses } from '../../../hooks/useCourses'
import { formatShortDate } from '../../../utils/date'
import { ALL_LECTURE_REVIEWS, byLecturer, filterLectureReviews, lecturesOf } from '../../../utils/lectureAnalytics'
import type { LectureFilter, LectureShow } from '../../../utils/lectureAnalytics'
import { latestWeekFirst, weekNamer } from '../../../utils/weekNames'
import { LectureReviewCard } from './LectureReviewCard'
import './reviews.css'

const PAGE = 20
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Admin: what students say about each lecture (the form they fill after it), each review with its scores and comments.
 * Filter by week, lecturer, lecture, words or kind (low scores, with a comment). No averages or summaries here: those are
 * on the Analytics pages. Read-only. Only admins see these: the lecturers do not, which the form tells the students
 * ("your answers go to the school team, not to the lecturer").
 */
export default function AdminLectureReviewsPage() {
  const { status, reviews, reload } = useAdminLectureReviews()
  const { modules } = useCourses()
  const [filter, setFilter] = useState<LectureFilter>(ALL_LECTURE_REVIEWS)
  const [shown, setShown] = useState(PAGE)
  const set = (patch: Partial<LectureFilter>) => {
    setFilter((f) => ({ ...f, ...patch }))
    setShown(PAGE)
  }

  /** "Week 5 · Go Basics" from the course; the server's own title when the course does not know the module. */
  const week = useMemo(
    () => weekNamer(modules, new Map(reviews.flatMap((r) => (r.lecture.moduleId ? [[r.lecture.moduleId, r.lecture.moduleTitle] as const] : [])))),
    [modules, reviews],
  )
  const weeks = useMemo(() => latestWeekFirst(reviews.flatMap((r) => (r.lecture.moduleId ? [r.lecture.moduleId] : [])), modules), [modules, reviews])
  const hasUnweeked = reviews.some((r) => !r.lecture.moduleId)

  const rows = useMemo(() => filterLectureReviews(reviews, filter), [reviews, filter])
  const lecturerChoices = useMemo(() => byLecturer(reviews), [reviews])
  const lectures = useMemo(() => lecturesOf(reviews), [reviews])
  const kinds = useMemo(() => {
    const base = { ...filter, show: 'all' as LectureShow }
    return (show: LectureShow) => filterLectureReviews(reviews, { ...base, show }).length
  }, [reviews, filter])

  // what can be filtered by: the week, the lecturer and the lecture
  const filterGroups: FilterGroup[] = [
    {
      id: 'week',
      label: 'Week',
      value: filter.moduleId,
      options: [
        { value: ALL, label: 'All weeks' },
        ...weeks.map((id) => ({ value: id, label: week(id) })),
        ...(hasUnweeked ? [{ value: 'none', label: 'Lectures with no week' }] : []),
      ],
    },
    {
      id: 'lecturer',
      label: 'Lecturer',
      value: String(filter.lecturer),
      options: [{ value: ALL, label: 'All lecturers' }, ...lecturerChoices.map((g) => ({ value: String(g.lecturerId ?? 'none'), label: g.name }))],
    },
    {
      id: 'lecture',
      label: 'Lecture',
      value: filter.lecture,
      options: [{ value: ALL, label: 'All lectures' }, ...lectures.map((x) => ({ value: x.key, label: `${x.title} · ${formatShortDate(x.startsAt)}` }))],
    },
  ]
  const choose = (id: string, value: string) =>
    set(id === 'week' ? { moduleId: value } : id === 'lecture' ? { lecture: value } : { lecturer: value === ALL || value === 'none' ? value : Number(value) })


  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Lecture reviews</h1>
          <p className="page-subtitle">What students say about each lecture, grouped by lecturer.</p>
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
          <p>The server cannot list the lecture reviews yet.</p>
          <p className="admin-muted">Students&apos; feedback appears here as soon as it can (GET /lecture-feedback for the admin).</p>
        </div>
      )}

      {status === 'ready' && reviews.length === 0 && (
        <p className="admin-empty">No lecture reviews yet. Students can rate a lecture from 10 minutes before it ends until 7 days after.</p>
      )}

      {status === 'ready' && reviews.length > 0 && (
        <>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Search student, lecture, lecturer or comment"
                aria-label="Search lecture reviews"
                value={filter.query}
                onChange={(e) => set({ query: e.target.value })}
              />
            </label>
            <FilterMenu groups={filterGroups} onChange={choose} onClear={() => set({ moduleId: 'all', lecturer: 'all', lecture: 'all' })} />
          </div>

          <FilterChips groups={filterGroups} onChange={choose} />

          <div className="admin-segmented" role="group" aria-label="Kind of review">
            {(
              [
                ['all', 'All'],
                ['low', 'Low scores'],
                ['comments', 'With a comment'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter.show === value} onClick={() => set({ show: value })}>
                {label} <span className="admin-segmented__count">{kinds(value)}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="admin-empty">
              <p>No reviews match.</p>
              <button type="button" className="admin-btn" onClick={() => set(ALL_LECTURE_REVIEWS)}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <section className="admin-page" aria-labelledby="lectures-list">
                <h2 id="lectures-list" className="admin-section-title">
                  Reviews
                </h2>
                <p className="admin-muted" aria-live="polite">
                  {rows.length === reviews.length ? plural(rows.length, 'review') : `${rows.length} of ${plural(reviews.length, 'review')}`}, newest first
                </p>
                <ul className="admin-reviews" aria-label="Reviews">
                  {rows.slice(0, shown).map((r) => (
                    <LectureReviewCard key={r.id} review={r} />
                  ))}
                </ul>
                {rows.length > shown && (
                  <button type="button" className="admin-btn admin-reviews__more" onClick={() => setShown((n) => n + PAGE)}>
                    Show more ({rows.length - shown} left)
                  </button>
                )}
              </section>
            </>
          )}
        </>
      )}
    </section>
  )
}
