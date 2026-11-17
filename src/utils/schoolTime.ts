/**
 * The school is in Baku (UTC+4, no daylight saving), and so is every time the backend shows: its emails and
 * notifications say "14:00 +04:00" and its 1:1 days and deadlines are Baku days. So "14:00" typed or shown anywhere in the app
 * means 14:00 in Baku, whatever time zone the person's computer is set to. Everything that turns a typed date and
 * time into a moment (or the other way round) goes through here, never through the browser's own zone.
 */
export const SCHOOL_TIME_ZONE = 'Asia/Baku'
export const SCHOOL_OFFSET_MS = 4 * 3_600_000

/** The moment of a school-time wall clock. `month` counts from 0 like Date; days and hours may overflow into the next. */
export function schoolDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute, second, ms) - SCHOOL_OFFSET_MS)
}

/** The school-time wall clock of a moment. `month` counts from 0 and `weekday` from Sunday (0), like Date. */
export function schoolParts(at: Date) {
  const t = new Date(at.getTime() + SCHOOL_OFFSET_MS)
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    weekday: t.getUTCDay(),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DD" in school time. */
export function schoolDateKey(at: Date): string {
  const p = schoolParts(at)
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`
}

/** "HH:MM" in school time (24 hours). */
export function schoolClock(at: Date): string {
  const p = schoolParts(at)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** Calendar days from one moment's school day to another's. */
export function schoolDayNumber(at: Date): number {
  const p = schoolParts(at)
  return Math.round(Date.UTC(p.year, p.month, p.day) / 86_400_000)
}
