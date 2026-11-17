import type { AdminReport, ReportStatus } from '../types/report'
import type { Role } from '../types/user'
import { REPORT_ABOUT } from './report'
import type { ReportAbout } from './report'

/**
 * The admin's Reports page. The server keeps a subject and a message only; the app's report form writes the subject as
 * "A mentor: Rashad Aliyev · Missed two 1:1s", so what it is about and who can be read back from it. A subject written
 * some other way is shown as it is.
 */
export interface ReportHeading {
  about?: ReportAbout
  who?: string
  title: string
}

export function readSubject(subject: string): ReportHeading {
  for (const a of REPORT_ABOUT) {
    if (!subject.startsWith(a.label)) continue
    const rest = subject.slice(a.label.length)
    const m = /^(?::\s*(.+?))?\s·\s(.+)$/.exec(rest)
    if (m) return { about: a.key, ...(m[1] ? { who: m[1].trim() } : {}), title: m[2].trim() }
  }
  return { title: subject }
}

/** The message without the "About: ..." line the form puts on top (the card shows that already). */
export const messageBody = (message: string) => message.replace(/^About: [^\n]*\n+/, '')

export type ReportShow = ReportStatus | 'all'

export interface ReportFilter {
  show: ReportShow
  /** The sender's role, or 'all'. */
  role: Role | 'all'
  /** What it is about, 'unknown' for subjects the form did not write, or 'all'. */
  about: ReportAbout | 'unknown' | 'all'
  query: string
}

export const ALL_REPORTS: ReportFilter = { show: 'open', role: 'all', about: 'all', query: '' }

/** The reports that pass the filter: open ones first when both are listed, then newest first. */
export function filterReports(reports: AdminReport[], f: ReportFilter): AdminReport[] {
  const q = f.query.trim().toLowerCase()
  return reports
    .filter((r) => {
      if (f.show !== 'all' && r.status !== f.show) return false
      if (f.role !== 'all' && !r.reporter?.roles?.includes(f.role)) return false
      if (f.about !== 'all' && (readSubject(r.subject).about ?? 'unknown') !== f.about) return false
      if (!q) return true
      return [r.subject, r.message, r.reporter?.name, r.reporter?.email, r.adminNote].some((v) => v?.toLowerCase().includes(q))
    })
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1) || b.createdAt.localeCompare(a.createdAt))
}

/** How many reports each status button would show, with the other filters as they are. */
export function countByStatus(reports: AdminReport[], f: ReportFilter): Record<ReportShow, number> {
  const base = filterReports(reports, { ...f, show: 'all' })
  return {
    open: base.filter((r) => r.status === 'open').length,
    resolved: base.filter((r) => r.status === 'resolved').length,
    all: base.length,
  }
}
