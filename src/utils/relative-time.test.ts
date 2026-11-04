import { describe, expect, it } from 'vitest'
import { buildMockNotifications } from '../mocks/notifications'
import { formatRelative } from './date'

const NOW = new Date(2026, 10, 5, 12, 0)
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelative', () => {
  it.each([
    [0, 'just now'],
    [30_000, 'just now'],
    [-5 * MIN, 'just now'], // slightly in the future (clock skew) must not read "-5 min ago"
    [MIN, '1 min ago'],
    [59 * MIN, '59 min ago'],
    [HOUR, '1 hour ago'],
    [5 * HOUR, '5 hours ago'],
    [23 * HOUR + 59 * MIN, '23 hours ago'],
    [DAY, '1 day ago'],
    [6 * DAY, '6 days ago'],
  ])('%d ms ago -> %s', (ms, expected) => {
    expect(formatRelative(ago(ms), NOW)).toBe(expected)
  })

  it('switches to a calendar date after a week', () => {
    expect(formatRelative(ago(7 * DAY), NOW)).toBe('Oct 29')
    expect(formatRelative(ago(40 * DAY), NOW)).toBe('Sep 26')
  })
})

describe('buildMockNotifications', () => {
  const list = buildMockNotifications(NOW)

  it('has 4 unread and 4 read, with unique ids', () => {
    expect(list).toHaveLength(8)
    expect(list.filter((n) => !n.readAt)).toHaveLength(4)
    expect(new Set(list.map((n) => n.id)).size).toBe(8)
  })

  it('never has a read time before the creation time, or a creation time in the future', () => {
    for (const n of list) {
      expect(n.createdAt <= NOW.toISOString()).toBe(true)
      if (n.readAt) expect(n.readAt >= n.createdAt).toBe(true)
    }
  })

  it('links only to routes that exist in the app', () => {
    for (const n of list) expect(n.link).toMatch(/^\/(courses\/m\d+|calendar)$/)
  })
})
