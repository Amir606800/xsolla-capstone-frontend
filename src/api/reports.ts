import type { AdminReport, ReportChange, ReportPerson, ReportStatus } from '../types/report'
import { rolesFrom } from '../utils/roles'
import { authedRequest } from './authed'
import { ApiError } from './http'

/**
 * Reports to the school's admins (backend docs/reports.md).
 *   POST   /reports        anyone signed in: { subject (1-200), message (1-5000) } -> 201 { id, subject, message, created_at }
 *   GET    /reports        admin: every report, newest first (filters exist on the server; the page filters itself)
 *   GET    /reports/summary  admin: { open, resolved, total }
 *   PATCH  /reports/{id}   admin: { status?, admin_note? } -> the report
 *   DELETE /reports/{id}   admin: 204
 * 422 answers list every problem in `details` (the ApiError message joins them).
 */
export interface SentReport {
  id: string
  subject: string
  message: string
  createdAt: string
}

interface SentDto {
  id: number | string
  subject: string
  message: string
  created_at: string
}

interface PersonDto {
  id: number | string
  name: string
  email?: string
  roles?: string[] | null
}

export interface ReportDto extends SentDto {
  status: string
  reporter: PersonDto | null
  admin_note?: string | null
  resolved_by?: PersonDto | null
  resolved_at?: string | null
}

/** A server without the routes: the page says so instead of failing. */
const missingRoute = (e: unknown) =>
  e instanceof ApiError && (e.status === 405 || e.status === 501 || (e.status === 404 && e.code !== 'not_found'))

const person = (p: PersonDto): ReportPerson => ({
  id: Number(p.id),
  name: p.name,
  ...(p.email ? { email: p.email } : {}),
  ...(p.roles?.length ? { roles: rolesFrom(p.roles) } : {}),
})

export function mapReport(d: ReportDto): AdminReport {
  const note = d.admin_note?.trim()
  return {
    id: String(d.id),
    subject: d.subject,
    message: d.message,
    status: (d.status === 'resolved' ? 'resolved' : 'open') as ReportStatus,
    reporter: d.reporter ? person(d.reporter) : null,
    ...(note ? { adminNote: note } : {}),
    ...(d.resolved_by ? { resolvedBy: person(d.resolved_by) } : {}),
    ...(d.resolved_at ? { resolvedAt: d.resolved_at } : {}),
    createdAt: d.created_at,
  }
}

/** Anyone: send a report. */
export async function sendReport(subject: string, message: string, reporter?: ReportPerson): Promise<SentReport> {
  void reporter // the server knows the sender from the session
  const d = await authedRequest<SentDto>('/reports', { method: 'POST', body: { subject, message } })
  return { id: String(d.id), subject: d.subject, message: d.message, createdAt: d.created_at }
}

/** Admin: every report, newest first; `null` when the server has no such route yet. */
export async function fetchReports(): Promise<AdminReport[] | null> {
  try {
    return ((await authedRequest<ReportDto[] | null>('/reports')) ?? []).map(mapReport)
  } catch (e) {
    if (missingRoute(e)) return null
    throw e
  }
}

/** Admin: how many reports are still open (for the sidebar); 0 when the server cannot say. */
export async function fetchOpenReportCount(): Promise<number> {
  try {
    return (await authedRequest<{ open?: number }>('/reports/summary')).open ?? 0
  } catch {
    return 0
  }
}

/** Admin: mark resolved or open again, and/or change the note. Answers the report as it is now. */
export async function updateReport(id: string, change: ReportChange, admin?: ReportPerson): Promise<AdminReport> {
  void admin // the server records who resolved it from the session
  const body = {
    ...(change.status ? { status: change.status } : {}),
    ...(change.adminNote !== undefined ? { admin_note: change.adminNote } : {}),
  }
  return mapReport(await authedRequest<ReportDto>(`/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body }))
}

/** Admin: delete a report for good. */
export async function deleteReport(id: string): Promise<void> {
  await authedRequest<unknown>(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
