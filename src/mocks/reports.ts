/**
 * Offline stand-in for the reports table: what people report in the demo, kept in this browser (localStorage
 * `reports_demo`), newest first. The real server keeps them for the admins (backend docs/reports.md).
 */
export interface StoredReport {
  id: string
  subject: string
  message: string
  createdAt: string
  reporter?: { id: number; name: string }
  status: 'open' | 'resolved'
}

const KEY = 'reports_demo'

export function listReports(): StoredReport[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredReport[]) : []
  } catch {
    return []
  }
}

export function addReport(subject: string, message: string, reporter?: { id: number; name: string }, now: Date = new Date()): StoredReport {
  const s = subject.trim()
  const m = message.trim()
  if (!s || !m) throw new Error('Write a subject and a message.')
  const report: StoredReport = {
    id: `r-${now.getTime().toString(36)}`,
    subject: s,
    message: m,
    createdAt: now.toISOString(),
    ...(reporter ? { reporter } : {}),
    status: 'open',
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([report, ...listReports()]))
  } catch {
    /* storage blocked: the report is only acknowledged */
  }
  return report
}
