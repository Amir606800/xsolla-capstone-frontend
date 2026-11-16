const schoolDate = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Baku', month: 'short', day: 'numeric' })

/** "Sep 21": the module's opening date as a school date (never the browser's time zone). */
export const formatWeekDate = (iso: string) => schoolDate.format(new Date(iso))

/** "Week 3" out of "Week 3 · HTTP and APIs" (or the whole title when it has no such start), for narrow labels. */
export const shortWeek = (title: string) => /^week \d+/i.exec(title)?.[0] ?? title

/** "Week 5 · React": a week's name with its number, whether or not the module title already starts with it. */
export const weekTitle = (week: number, title?: string) =>
  title && /^week \d+/i.test(title) ? title : `Week ${week}${title ? ` · ${title}` : ''}`

/** A whole-number percentage of the total; 0 when there is no total. */
export const shareOf = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100))

/** "3 on track, 1 falling behind of 4": every part in words, for a chart's accessible name. */
export function describeParts(parts: { label: string; value: number }[]): string {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return `${parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(', ')} of ${total}`
}
