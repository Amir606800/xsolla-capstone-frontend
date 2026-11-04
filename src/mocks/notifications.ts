import type { AppNotification } from '../types/notification'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** Mock notifications for a student, relative to `now`: 4 unread, 4 already read. */
export function buildMockNotifications(now: Date = new Date()): AppNotification[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const read = (ms: number) => ago(ms - 5 * MIN)

  return [
    {
      id: 'n1',
      type: 'graded',
      message: 'Your task "Routing app" was graded: 94/100',
      link: '/courses/m5',
      createdAt: ago(2 * HOUR),
      readAt: null,
    },
    {
      id: 'n2',
      type: 'deadline',
      message: 'Deadline soon: "HTTP server" is due in 4 days',
      link: '/courses/m6',
      createdAt: ago(3 * HOUR),
      readAt: null,
    },
    {
      id: 'n3',
      type: 'material',
      message: 'New material uploaded: "Go Basics - lecture slides"',
      link: '/courses/m6',
      createdAt: ago(1 * DAY),
      readAt: null,
    },
    {
      id: 'n4',
      type: 'meeting',
      message: '1:1 with your mentor is scheduled for Thursday at 15:00',
      link: '/calendar',
      createdAt: ago(1 * DAY + 2 * HOUR),
      readAt: null,
    },
    {
      id: 'n5',
      type: 'task',
      message: 'New task assigned: "CLI tool"',
      link: '/courses/m6',
      createdAt: ago(3 * DAY),
      readAt: read(3 * DAY),
    },
    {
      id: 'n6',
      type: 'event',
      message: 'An off-campus day was added to the calendar',
      link: '/calendar',
      createdAt: ago(4 * DAY),
      readAt: read(4 * DAY),
    },
    {
      id: 'n7',
      type: 'graded',
      message: 'Feedback was added to "State management"',
      link: '/courses/m5',
      createdAt: ago(6 * DAY),
      readAt: read(6 * DAY),
    },
    {
      id: 'n8',
      type: 'task',
      message: 'New task assigned: "Components"',
      link: '/courses/m5',
      createdAt: ago(12 * DAY),
      readAt: read(12 * DAY),
    },
  ]
}
