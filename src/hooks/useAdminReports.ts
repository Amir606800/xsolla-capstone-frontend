import { useCallback, useEffect, useState } from 'react'
import { deleteReport, fetchOpenReportCount, fetchReports, updateReport } from '../api/reports'
import type { AdminReport, ReportChange } from '../types/report'
import { keepIfSame } from '../utils/same'
import type { ReviewsStatus } from './useAdminReviews'
import { useAuth } from './useAuth'
import { useLive } from './useLive'

/**
 * The admin's reports: loaded once, then kept in step (a report sent in another tab, or by somebody else on the next
 * poll, shows up by itself). `unavailable` = the server has no report routes yet.
 */
export function useAdminReports() {
  const { user } = useAuth()
  const [status, setStatus] = useState<ReviewsStatus>('loading')
  const [reports, setReports] = useState<AdminReport[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    fetchReports().then(
      (rows) => {
        if (!alive) return
        setReports(rows ?? [])
        setStatus(rows === null ? 'unavailable' : 'ready')
      },
      () => alive && setStatus('error'),
    )
    return () => {
      alive = false
    }
  }, [attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  const refresh = useCallback(() => {
    fetchReports().then(
      (rows) => {
        if (rows) setReports(keepIfSame(rows))
      },
      () => undefined,
    )
  }, [])
  useLive(['reports'], refresh, { enabled: status === 'ready' })

  /** Resolve, open again or write the note; the list shows what the server answered. Rejects on failure. */
  const change = useCallback(
    async (id: string, what: ReportChange) => {
      const admin = user ? { id: user.id, name: user.name, email: user.email, roles: user.roles } : undefined
      const next = await updateReport(id, what, admin)
      setReports((prev) => prev.map((r) => (r.id === id ? next : r)))
    },
    [user],
  )

  const remove = useCallback(async (id: string) => {
    await deleteReport(id)
    setReports((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { status, reports, reload, change, remove }
}

/** How many reports are open, for the badge in the admin sidebar. Kept in step like the page. */
export function useOpenReportCount(): number {
  const [open, setOpen] = useState(0)
  const load = useCallback(() => {
    fetchOpenReportCount().then(setOpen, () => undefined)
  }, [])
  useEffect(load, [load])
  useLive(['reports'], load)
  return open
}
