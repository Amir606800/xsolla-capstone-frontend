/** "HH:MM" on the 24-hour clock: hours 00-23, minutes 00-59. */
export const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/

/** What is typed, shaped as "HH:MM" as far as the digits go; letters and colons are ignored ("930" -> "93:0" until it is finished). */
export function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

/** A finished entry as "HH:MM": "9" -> "09:00", "14" -> "14:00", "930" -> "09:30", "0905" -> "09:05". Nothing that is not a time ("25:00", "12:75"). */
export function normalizeTime(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (!d || d.length > 4) return null
  const hours = d.length === 3 ? d.slice(0, 1) : d.slice(0, 2)
  const minutes = d.length <= 2 ? '00' : d.slice(d.length === 3 ? 1 : 2)
  const time = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
  return TIME_24H.test(time) ? time : null
}
