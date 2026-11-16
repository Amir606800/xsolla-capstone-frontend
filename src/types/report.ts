import type { Role } from './user'

/** A report to the school's admins (backend docs/reports.md). Only admins read them. */
export type ReportStatus = 'open' | 'resolved'

export interface ReportPerson {
  id: number
  name: string
  email?: string
  roles?: Role[]
}

export interface AdminReport {
  id: string
  subject: string
  message: string
  status: ReportStatus
  /** Null once the sender's account was deleted (the report stays). */
  reporter: ReportPerson | null
  /** What the admin wrote about how it was handled. */
  adminNote?: string
  resolvedBy?: ReportPerson
  resolvedAt?: string
  createdAt: string
}

/** What PATCH /reports/{id} changes; a field left out stays as it is. `adminNote: ''` removes the note. */
export interface ReportChange {
  status?: ReportStatus
  adminNote?: string
}
