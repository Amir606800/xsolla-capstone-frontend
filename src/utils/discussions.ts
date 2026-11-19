import type { CalendarEvent } from '../types/calendar'
import type { Discussion } from '../types/discussion'
import { schoolDate } from './schoolTime'
import { toMinutes } from './slots'

const MIN_MINUTES = 10
const MAX_MINUTES = 4 * 60

/** A message for the mentor when the times cannot make a discussion, else null. */
export function talkTimeError(date: string, start: string, end: string, now: Date): string | null {
  const from = toMinutes(start)
  const to = toMinutes(end)
  if (from === null || to === null) return 'Pick a start and an end time.'
  if (to <= from) return 'The end time must be after the start time.'
  if (to - from < MIN_MINUTES) return `A discussion lasts at least ${MIN_MINUTES} minutes.`
  if (to - from > MAX_MINUTES) return 'A discussion lasts at most 4 hours.'
  const [y, mo, d] = date.split('-').map(Number)
  if (schoolDate(y, mo - 1, d, 0, from) <= now) return 'That time has already passed. Pick a time in the future.'
  return null
}

/** The talks as calendar entries: a mentor sees one per talk (with every student invited), a student their own. */
export function discussionEvents(list: Discussion[], viewer: { isMentor: boolean }): CalendarEvent[] {
  const byBatch = new Map<string, Discussion[]>()
  for (const d of list) byBatch.set(d.batchId, [...(byBatch.get(d.batchId) ?? []), d])

  return [...byBatch.values()].map((rows) => {
    const first = rows[0]
    const names = rows.map((r) => r.studentName).filter(Boolean)
    return {
      id: `talk-${first.id}`,
      title: first.title,
      kind: 'discussion',
      startsAt: first.startsAt,
      endsAt: first.endsAt,
      description: [viewer.isMentor ? `A discussion with ${names.join(', ')}.` : `A discussion with ${first.mentorName}.`, first.note]
        .filter(Boolean)
        .join(' '),
      attendees: viewer.isMentor
        ? rows.map((r) => ({ id: r.studentId, name: r.studentName, email: '' }))
        : [{ id: first.mentorId, name: first.mentorName, email: '' }],
    } satisfies CalendarEvent
  })
}
