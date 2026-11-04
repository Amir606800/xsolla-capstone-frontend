import { describe, expect, it } from 'vitest'
import { dayOfMonth, formatShortDate, formatTimeLeft, monthShort } from './date'

const NOW = new Date('2026-11-04T12:00:00Z')
const shift = (ms: number) => new Date(NOW.getTime() + ms).toISOString()
const H = 3_600_000
const D = 24 * H

describe('formatTimeLeft', () => {
  it.each([
    [30 * 60_000, 'due now'],
    [-30 * 60_000, 'just overdue'],
    [5 * H, 'in 5 hours'],
    [H, 'in 1 hour'],
    [D, 'in 1 day'],
    [3 * D + 2 * H, 'in 3 days'],
    [-2 * H, '2 hours overdue'],
    [-10 * D, '10 days overdue'],
  ])('%d ms -> %s', (offset, expected) => {
    expect(formatTimeLeft(shift(offset), NOW)).toBe(expected)
  })
})

describe('date parts', () => {
  const iso = new Date(2026, 11, 7, 12).toISOString() // local noon, Dec 7

  it('formats month, day and short date', () => {
    expect(monthShort(iso)).toBe('Dec')
    expect(dayOfMonth(iso)).toBe(7)
    expect(formatShortDate(iso)).toBe('Dec 7')
  })
})
