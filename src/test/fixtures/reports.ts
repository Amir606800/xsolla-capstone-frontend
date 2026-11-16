import { publish } from '../../sync/bus'
import type { AdminReport, ReportChange, ReportPerson } from '../../types/report'

/**
 * Offline stand-in for the reports table (backend docs/reports.md): what people report in the demo, kept in this browser
 * (localStorage `reports_demo`), newest first. A few made-up reports are there from the start so the admin's Reports page
 * has something to show; one of them is already resolved.
 */
const KEY = 'reports_demo'
const ADMIN: ReportPerson = { id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }

function seed(now: Date): AdminReport[] {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString()
  return [
    {
      id: 'r-demo-3',
      subject: 'A mentor: Rashad Aliyev · Missed two 1:1s',
      message: 'About: A mentor (Rashad Aliyev)\n\nOur last two 1:1s did not happen and nobody told us. I booked both times.',
      status: 'open',
      reporter: { id: 101, name: 'Leyla Hasanova', email: 'leyla.hasanova@example.com', roles: ['student'] },
      createdAt: ago(5),
    },
    {
      id: 'r-demo-2',
      subject: 'A student: Kamran Rzayev · Copied the HTTP server task',
      message: "About: A student (Kamran Rzayev)\n\nHis HTTP server hand-in is the same as another team's, line by line.",
      status: 'open',
      reporter: { id: 901, name: 'Aysel Mammadova', email: 'mentor@xsolla.school', roles: ['mentor'] },
      createdAt: ago(30),
    },
    {
      id: 'r-demo-1',
      subject: 'The school · No heating in room 3',
      message: 'About: The school\n\nRoom 3 has been cold all week during the lectures.',
      status: 'resolved',
      reporter: { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] },
      adminNote: 'The heating was repaired on Tuesday.',
      resolvedBy: ADMIN,
      resolvedAt: ago(70),
      createdAt: ago(96),
    },
  ]
}

function load(now: Date = new Date()): AdminReport[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AdminReport[]
  } catch {
    /* unreadable: start again from the demo reports */
  }
  const first = seed(now)
  save(first, true)
  return first
}

/** `seeding`: the first copy of the demo data is not news, so nobody is told. */
function save(list: AdminReport[], seeding = false): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    if (!seeding) publish(['reports'])
  } catch {
    /* storage blocked: changes last until the page reloads */
  }
}

export function listReports(now: Date = new Date()): AdminReport[] {
  return [...load(now)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function addReport(subject: string, message: string, reporter?: ReportPerson, now: Date = new Date()): AdminReport {
  const s = subject.trim()
  const m = message.trim()
  if (!s || !m) throw new Error('Write a subject and a message.')
  const report: AdminReport = {
    id: `r-${now.getTime().toString(36)}`,
    subject: s,
    message: m,
    status: 'open',
    reporter: reporter ?? null,
    createdAt: now.toISOString(),
  }
  save([report, ...load(now)])
  return report
}

/** Admin: mark resolved or open again, and/or write the note. Resolving again keeps who resolved it first. */
export function changeReport(id: string, change: ReportChange, admin: ReportPerson = ADMIN, now: Date = new Date()): AdminReport {
  if (change.status === undefined && change.adminNote === undefined) throw new Error('Nothing to change.')
  if ((change.adminNote ?? '').length > 2000) throw new Error('Keep the note under 2000 characters.')
  const list = load(now)
  const found = list.find((r) => r.id === id)
  if (!found) throw new Error('This report no longer exists.')
  let next: AdminReport = { ...found }
  if (change.adminNote !== undefined) {
    const note = change.adminNote.trim()
    if (note) next.adminNote = note
    else delete next.adminNote
  }
  if (change.status === 'resolved' && found.status !== 'resolved')
    next = { ...next, status: 'resolved', resolvedBy: admin, resolvedAt: now.toISOString() }
  if (change.status === 'open') {
    next = { ...next, status: 'open' }
    delete next.resolvedBy
    delete next.resolvedAt
  }
  save(list.map((r) => (r.id === id ? next : r)))
  return next
}

export function removeReport(id: string, now: Date = new Date()): void {
  const list = load(now)
  if (!list.some((r) => r.id === id)) throw new Error('This report no longer exists.')
  save(list.filter((r) => r.id !== id))
}
