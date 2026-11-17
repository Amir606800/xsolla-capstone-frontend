import { useMemo, useState } from 'react'
import { ALL, FilterChips, FilterMenu } from '../../../components/filter/FilterMenu'
import type { FilterGroup } from '../../../components/filter/FilterMenu'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useAdminReports } from '../../../hooks/useAdminReports'
import type { Role } from '../../../types/user'
import { REPORT_ABOUT } from '../../../utils/report'
import { ALL_REPORTS, countByStatus, filterReports } from '../../../utils/reportInbox'
import type { ReportFilter, ReportShow } from '../../../utils/reportInbox'
import { ReportItem } from './ReportItem'
import '../reviews/reviews.css'
import './reports.css'

const PAGE = 20
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const SENDERS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'mentor', label: 'Mentors' },
  { value: 'lecturer', label: 'Lecturers' },
  { value: 'admin', label: 'Admins' },
]

/**
 * Admin: the problems people reported (the red flag in the LMS header, or the card on their profile). The open ones
 * come first; the admin reads each one, marks it resolved with a note on what was done, opens it again, or deletes it.
 */
export default function AdminReportsPage() {
  const { status, reports, reload, change, remove } = useAdminReports()
  const [filter, setFilter] = useState<ReportFilter>(ALL_REPORTS)
  const [shown, setShown] = useState(PAGE)
  const set = (patch: Partial<ReportFilter>) => {
    setFilter((f) => ({ ...f, ...patch }))
    setShown(PAGE)
  }

  const filterGroups: FilterGroup[] = [
    { id: 'sender', label: 'Sent by', value: filter.role, options: SENDERS.map((s) => ({ value: s.value, label: s.label })) },
    {
      id: 'about',
      label: 'About',
      value: filter.about,
      options: [
        { value: ALL, label: 'Anything' },
        ...REPORT_ABOUT.map((a) => ({ value: a.key, label: a.label })),
        { value: 'unknown', label: 'Not said' },
      ],
    },
  ]
  const choose = (id: string, value: string) =>
    set(id === 'sender' ? { role: value as ReportFilter['role'] } : { about: value as ReportFilter['about'] })

  const rows = useMemo(() => filterReports(reports, filter), [reports, filter])
  const counts = useMemo(() => countByStatus(reports, filter), [reports, filter])
  const open = reports.filter((r) => r.status === 'open').length

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Problems students and staff reported.{' '}
            {status === 'ready' && (open === 0 ? 'Nothing is open.' : `${plural(open, 'report is', 'reports are')} open.`)}
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={reload}>
          <Icon name="reset" size={16} /> Refresh
        </button>
      </header>

      {status === 'loading' && <Loading className="admin-muted">Loading the reports…</Loading>}

      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The reports could not be loaded.</p>
          <button type="button" className="admin-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'unavailable' && (
        <div className="admin-empty" role="status">
          <p>The server cannot list the reports yet.</p>
        </div>
      )}

      {status === 'ready' && reports.length === 0 && (
        <p className="admin-empty">No reports yet. Students and staff send them with the red flag at the top of the LMS.</p>
      )}

      {status === 'ready' && reports.length > 0 && (
        <>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Search subject, message, sender or note"
                aria-label="Search reports"
                value={filter.query}
                onChange={(e) => set({ query: e.target.value })}
              />
            </label>
            <FilterMenu groups={filterGroups} onChange={choose} onClear={() => set({ role: 'all', about: 'all' })} />
          </div>

          <FilterChips groups={filterGroups} onChange={choose} />

          <div className="admin-segmented" role="group" aria-label="Status">
            {(
              [
                ['open', 'Open'],
                ['resolved', 'Resolved'],
                ['all', 'All'],
              ] as [ReportShow, string][]
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter.show === value} onClick={() => set({ show: value })}>
                {label} <span className="admin-segmented__count">{counts[value]}</span>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="admin-empty">
              <p>
                {filter.show === 'open' && filter.role === 'all' && filter.about === 'all' && !filter.query.trim()
                  ? 'No open reports: everything has been handled.'
                  : 'No reports match.'}
              </p>
              <button type="button" className="admin-btn" onClick={() => set({ ...ALL_REPORTS, show: 'all' })}>
                Show every report
              </button>
            </div>
          ) : (
            <>
              <p className="admin-muted" aria-live="polite">
                {plural(rows.length, 'report')}
                {filter.show === 'all' ? ', open ones first' : ''}, newest first
              </p>
              <ul className="admin-reports" aria-label="Reports">
                {rows.slice(0, shown).map((r) => (
                  <ReportItem key={r.id} report={r} onChange={(what) => change(r.id, what)} onDelete={() => remove(r.id)} />
                ))}
              </ul>
              {rows.length > shown && (
                <button type="button" className="admin-btn admin-reviews__more" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({rows.length - shown} left)
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
