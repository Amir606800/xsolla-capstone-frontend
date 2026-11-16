import { addReport } from '../mocks/reports'
import { authedRequest } from './authed'
import { hasBackend } from './http'

/**
 * Sending a report to the school's admins (backend docs/reports.md). Anyone signed in may send one; only admins read
 * them. The server answers 422 with every problem in `details` (the ApiError message joins them), 401 when signed out.
 *   POST /reports { subject (1-200), message (1-5000) }  ->  201 { id, subject, message, created_at }
 * Offline, the report is kept in this browser.
 */
export interface SentReport {
  id: string
  subject: string
  message: string
  createdAt: string
}

interface ReportDto {
  id: number | string
  subject: string
  message: string
  created_at: string
}

const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function sendReport(subject: string, message: string, reporter?: { id: number; name: string }): Promise<SentReport> {
  if (hasBackend()) {
    const d = await authedRequest<ReportDto>('/reports', { method: 'POST', body: { subject, message } })
    return { id: String(d.id), subject: d.subject, message: d.message, createdAt: d.created_at }
  }
  await wait()
  return addReport(subject, message, reporter)
}
