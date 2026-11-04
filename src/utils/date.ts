// Formatters are created once; Intl construction is comparatively expensive.
const monthFmt = new Intl.DateTimeFormat('en', { month: 'short' })
const fullFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

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
