// Formatters are created once; Intl construction is comparatively expensive.
const monthFmt = new Intl.DateTimeFormat('en', { month: 'short' })
const fullFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

const dateTimeFmt = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const clockFmt = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "18:00" */
export function formatClockTime(iso: string): string {
  return clockFmt.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago", then a short date ("Oct 12"). */
export function formatRelative(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now' // also covers timestamps slightly in the future
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return fullFmt.format(new Date(iso))
}

export function monthShort(iso: string): string {
  return monthFmt.format(new Date(iso))
}

export function dayOfMonth(iso: string): number {
  return new Date(iso).getDate()
}

export function formatShortDate(iso: string): string {
  return fullFmt.format(new Date(iso))
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** "in 3 days", "in 5 hours", "2 days overdue", "due now". */
export function formatTimeLeft(iso: string, now: Date): string {
  const diff = new Date(iso).getTime() - now.getTime()
  const abs = Math.abs(diff)
  const days = Math.floor(abs / DAY)
  const hours = Math.max(1, Math.floor(abs / HOUR))
  const unit = days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`
  if (abs < HOUR) return diff >= 0 ? 'due now' : 'just overdue'
  return diff >= 0 ? `in ${unit}` : `${unit} overdue`
}
