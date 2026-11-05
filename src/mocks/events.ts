import type { CalendarEvent } from '../types/calendar'

/**
 * Mock calendar events, built around `now`. Deliberately sparse so the
 * calendar stays readable: one lecture on Monday each week, one team sync and one off-campus day. Times are local.
 */
export function buildMockEvents(now: Date = new Date()): CalendarEvent[] {
  const day = (offset: number, h = 0, m = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, h, m).toISOString()

  // Monday of the current week (local), as a day offset from today
  const mondayOffset = -((now.getDay() + 6) % 7)

  const events: CalendarEvent[] = []

  // Weekly lecture: Monday 10:00-12:00, from 2 weeks back to 4 weeks ahead
  for (let week = -2; week <= 4; week++) {
    events.push({
      id: `lec-${week}`,
      title: 'Lecture',
      kind: 'lecture',
      startsAt: day(mondayOffset + week * 7, 10),
      endsAt: day(mondayOffset + week * 7, 12),
      location: 'Main hall',
      description: 'Weekly lecture for the current module.',
    })
  }

  // One team sync this Friday and one off-campus day next Friday
  events.push(
    {
      id: 'team-1',
      title: 'Team sync',
      kind: 'meeting',
      startsAt: day(mondayOffset + 4, 14),
      endsAt: day(mondayOffset + 4, 14, 45),
      location: 'Online',
      description: 'Short sync with your team about the current project.',
    },
    {
      id: 'off-1',
      title: 'Off-campus day',
      kind: 'off-campus',
      startsAt: day(mondayOffset + 11, 0),
      endsAt: day(mondayOffset + 11, 23, 59),
      allDay: true,
      description: 'No classes - the school is closed for an off-site activity.',
    },
  )

  return events
}
