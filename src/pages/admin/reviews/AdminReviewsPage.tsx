import { useMemo, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useAdminReviews, useMissingReviews } from '../../../hooks/useAdminReviews'
import { useCourses } from '../../../hooks/useCourses'
import { useSort } from '../../../hooks/useSort'
import { REVIEW_STATEMENTS } from '../../../types/mentorReview'
import { NO_SESSION_LABEL, TOPIC_LABEL } from '../../../utils/mentorReview'
import {
  ALL_REVIEWS,
  byMentor,
  filterReviews,
  formatPercent,
  formatScore,
  LOW_SCORE,
  reasonCounts,
  STATEMENT_SHORT,
  summarise,
  topicCounts,
} from '../../../utils/reviewAnalytics'
import type { ReviewFilter, ReviewShow } from '../../../utils/reviewAnalytics'
import { ALL, FilterChips, FilterMenu } from '../../../components/filter/FilterMenu'
import type { FilterGroup } from '../../../components/filter/FilterMenu'
import { latestWeekFirst, weekNamer } from '../../../utils/weekNames'
import { SortableTh } from '../SortableTh'
import { Bars } from './Bars'
import { ReviewCard } from './ReviewCard'
import './reviews.css'

const PAGE = 20
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Admin: what students say about their mentors. Every weekly review in one place: totals, a table that compares the
 * mentors, what the 1:1 sessions were about, and each review with its comment. Filter by week, mentor, words or kind
 * (low scores, with a comment, no session). It is read-only: a review cannot be changed once it is sent. The mentors
 * do not see these pages (the form tells students their answers go to the school team, not to the mentor).
 */
export default function AdminReviewsPage() {
  const { status, reviews, reload } = useAdminReviews()
  const { modules } = useCourses()
  const [filter, setFilter] = useState<ReviewFilter>(ALL_REVIEWS)
  const [shown, setShown] = useState(PAGE)
  const set = (patch: Partial<ReviewFilter>) => {
    setFilter((f) => ({ ...f, ...patch }))
    setShown(PAGE)
  }

  /** "Week 5 · Go Basics" from the course; the server's own title when the course does not know the module. */
  const week = useMemo(() => weekNamer(modules, new Map(reviews.map((r) => [r.moduleId, r.moduleTitle]))), [modules, reviews])
  const weeks = useMemo(() => latestWeekFirst(reviews.map((r) => r.moduleId), modules), [modules, reviews])
  const mentors = useMemo(() => byMentor(reviews).map((m) => ({ id: m.mentorId, name: m.mentorName })), [reviews])

  // what can be filtered by: the week and the mentor
  const filterGroups: FilterGroup[] = [
    { id: 'week', label: 'Week', value: filter.moduleId, options: [{ value: ALL, label: 'All weeks' }, ...weeks.map((id) => ({ value: id, label: week(id) }))] },
    {
      id: 'mentor',
      label: 'Mentor',
      value: String(filter.mentorId),
      options: [{ value: ALL, label: 'All mentors' }, ...mentors.map((x) => ({ value: String(x.id), label: x.name }))],
    },
  ]
  const choose = (id: string, value: string) => set(id === 'week' ? { moduleId: value } : { mentorId: value === ALL ? 'all' : Number(value) })

  const rows = useMemo(() => filterReviews(reviews, filter), [reviews, filter])
  const summary = useMemo(() => summarise(rows), [rows])
  // the mentor table compares mentors, so the mentor filter does not narrow it
  const table = useMemo(() => byMentor(filterReviews(reviews, { ...filter, mentorId: 'all' })), [reviews, filter])
  const topics = useMemo(() => topicCounts(rows), [rows])
  const reasons = useMemo(() => reasonCounts(rows), [rows])
  // the counts on the kind buttons follow the other filters
  const kinds = useMemo(() => {
    const base = { ...filter, show: 'all' as ReviewShow }
    return (show: ReviewShow) => filterReviews(reviews, { ...base, show }).length
  }, [reviews, filter])
  const students = new Set(rows.map((r) => r.studentId)).size

  // with one week chosen: who has not sent it yet (follows the mentor and the words, not the kind of review)
  const missingAll = useMissingReviews(filter.moduleId, reviews)
  const missing = useMemo(() => {
    const q = filter.query.trim().toLowerCase()
    return (missingAll ?? []).filter(
      (m) =>
        (filter.mentorId === 'all' || m.mentorId === filter.mentorId) &&
        (!q || [m.studentName, m.mentorName, m.teamName].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [missingAll, filter.mentorId, filter.query])

  const { sorted: mentorRows, sort, toggle } = useSort(
    table,
    {
      mentor: (m) => m.mentorName,
      reviews: (m) => m.count,
      sessions: (m) => m.sessionRate,
      overall: (m) => m.overall,
      clarity: (m) => m.ratings.clarity,
      engagement: (m) => m.ratings.engagement,
      comfort: (m) => m.ratings.comfort,
      time: (m) => m.ratings.time,
      low: (m) => m.low,
    },
    { key: 'overall', dir: 'asc' },
  )


  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Mentor reviews</h1>
          <p className="page-subtitle">What students say about their mentor, week by week.</p>
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
          <p>The server cannot list the mentor reviews yet.</p>
          <p className="admin-muted">Students&apos; reviews appear here as soon as it can (GET /mentor-reviews for the admin).</p>
        </div>
      )}

      {status === 'ready' && reviews.length === 0 && (
        <p className="admin-empty">No reviews yet. Students send one each weekend for the running week.</p>
      )}

      {status === 'ready' && reviews.length > 0 && (
        <>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Search student, mentor or comment"
                aria-label="Search reviews"
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
                ['low', `Low scores`],
                ['comments', 'With a comment'],
                ['no-session', 'No session'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter.show === value} onClick={() => set({ show: value })}>
                {label} <span className="admin-segmented__count">{kinds(value)}</span>
              </button>
            ))}
          </div>

          <ul className="admin-tiles" aria-label="Summary">
            <li>
              <div className="admin-tile">
                <span className="admin-tile__label">Reviews</span>
                <span className="admin-tile__value">{summary.count}</span>
                <span className="admin-tile__hint">{plural(students, 'student')}</span>
              </div>
            </li>
            <li>
              <div className="admin-tile">
                <span className="admin-tile__label">Average rating</span>
                <span className="admin-tile__value">{summary.overall === null ? '—' : `${formatScore(summary.overall)} / 5`}</span>
                <span className="admin-tile__hint">Overall satisfaction</span>
              </div>
            </li>
            <li>
              <div className="admin-tile">
                <span className="admin-tile__label">Sessions held</span>
                <span className="admin-tile__value">{formatPercent(summary.sessionRate)}</span>
                <span className="admin-tile__hint">
                  {summary.sessions} of {summary.count} reviews
                </span>
              </div>
            </li>
            <li>
              <div className="admin-tile">
                <span className="admin-tile__label">Low scores</span>
                <span className="admin-tile__value">{summary.low}</span>
                <span className="admin-tile__hint">Overall {LOW_SCORE} or less</span>
              </div>
            </li>
          </ul>

          {filter.moduleId !== 'all' && Array.isArray(missingAll) && (
            <section className="admin-panel" aria-labelledby="reviews-missing">
              <h2 id="reviews-missing" className="admin-section-title">
                Not sent yet ({missing.length})
              </h2>
              {missing.length === 0 ? (
                <p className="admin-muted">
                  {missingAll.length === 0 ? `Everyone has sent the review of ${week(filter.moduleId)}.` : 'None of them match the filters.'}
                </p>
              ) : (
                <>
                  <p className="admin-muted">
                    {plural(missing.length, 'student has', 'students have')} not sent the review of {week(filter.moduleId)}.
                  </p>
                  <ul className="admin-missing" aria-label="Students who have not sent the review">
                    {missing.map((m) => (
                      <li key={m.studentId}>
                        <strong>{m.studentName}</strong>
                        <span className="admin-muted">
                          {m.teamName ? `${m.teamName} · ` : ''}mentor {m.mentorName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {rows.length === 0 ? (
            <div className="admin-empty">
              <p>No reviews match.</p>
              <button type="button" className="admin-btn" onClick={() => set(ALL_REVIEWS)}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <section className="admin-page" aria-labelledby="reviews-mentors">
                <h2 id="reviews-mentors" className="admin-section-title">
                  By mentor
                </h2>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <caption className="sr-only">Reviews by mentor</caption>
                    <thead>
                      <tr>
                        <SortableTh label="Mentor" sortKey="mentor" sort={sort} onSort={toggle} />
                        <SortableTh label="Reviews" sortKey="reviews" sort={sort} onSort={toggle} />
                        <SortableTh label="Sessions" sortKey="sessions" sort={sort} onSort={toggle} />
                        <SortableTh label="Overall" sortKey="overall" sort={sort} onSort={toggle} />
                        {REVIEW_STATEMENTS.map((s) => (
                          <SortableTh key={s} label={STATEMENT_SHORT[s]} sortKey={s} sort={sort} onSort={toggle} />
                        ))}
                        <SortableTh label="Low" sortKey="low" sort={sort} onSort={toggle} />
                      </tr>
                    </thead>
                    <tbody>
                      {mentorRows.map((m) => (
                        <tr key={m.mentorId} className={filter.mentorId === m.mentorId ? 'is-selected' : undefined}>
                          <td>
                            <button
                              type="button"
                              className="admin-table__title admin-reviews__mentor"
                              aria-pressed={filter.mentorId === m.mentorId}
                              onClick={() => set({ mentorId: filter.mentorId === m.mentorId ? 'all' : m.mentorId })}
                              title={filter.mentorId === m.mentorId ? 'Show every mentor' : `Only the reviews about ${m.mentorName}`}
                            >
                              {m.mentorName}
                            </button>
                            {m.teamName && <span className="admin-table__sub">{m.teamName}</span>}
                          </td>
                          <td className="admin-table__num">{m.count}</td>
                          <td className="admin-table__num">{formatPercent(m.sessionRate)}</td>
                          <td className="admin-table__num">
                            <strong>{formatScore(m.overall)}</strong>
                          </td>
                          {REVIEW_STATEMENTS.map((s) => (
                            <td key={s} className="admin-table__num">
                              {formatScore(m.ratings[s])}
                            </td>
                          ))}
                          <td className="admin-table__num">{m.low || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {(topics.length > 0 || reasons.length > 0) && (
                <div className="admin-reviews__insights">
                  {topics.length > 0 && (
                    <section className="admin-panel" aria-labelledby="reviews-topics">
                      <h2 id="reviews-topics" className="admin-section-title">
                        What the sessions were about
                      </h2>
                      <Bars label="Topics of the sessions" rows={topics.map((t) => ({ key: t.topic, text: TOPIC_LABEL[t.topic], count: t.count }))} />
                    </section>
                  )}
                  {reasons.length > 0 && (
                    <section className="admin-panel" aria-labelledby="reviews-reasons">
                      <h2 id="reviews-reasons" className="admin-section-title">
                        Why there was no session
                      </h2>
                      <Bars label="Reasons for no session" rows={reasons.map((r) => ({ key: r.reason, text: NO_SESSION_LABEL[r.reason], count: r.count }))} />
                    </section>
                  )}
                </div>
              )}

              <section className="admin-page" aria-labelledby="reviews-list">
                <h2 id="reviews-list" className="admin-section-title">
                  Reviews
                </h2>
                <p className="admin-muted" aria-live="polite">
                  {rows.length === reviews.length ? plural(rows.length, 'review') : `${rows.length} of ${plural(reviews.length, 'review')}`}, newest first
                </p>
                <ul className="admin-reviews" aria-label="Reviews">
                  {rows.slice(0, shown).map((r) => (
                    <ReviewCard key={r.id} review={r} week={week(r.moduleId)} />
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
