import { describe, expect, it } from 'vitest'
import type { AdminReport } from '../types/report'
import { ALL_REPORTS, countByStatus, filterReports, messageBody, readSubject } from './reportInbox'

describe('reading a report back', () => {
  it('what it is about and who, from the subject the report form writes; any other subject as it is', () => {
    expect(readSubject('A mentor: Rashad Aliyev · Missed two 1:1s')).toEqual({
      about: 'mentor',
      who: 'Rashad Aliyev',
      title: 'Missed two 1:1s',
    })
    expect(readSubject('The school · No heating')).toEqual({ about: 'school', title: 'No heating' })
    expect(readSubject('Student X misbehaves in class')).toEqual({ title: 'Student X misbehaves in class' })
    expect(messageBody('About: The school\n\nRoom 3 is cold.')).toBe('Room 3 is cold.')
    expect(messageBody('Room 3 is cold.')).toBe('Room 3 is cold.')
  })
})

const report = (id: string, over: Partial<AdminReport> = {}): AdminReport => ({
  id,
  subject: 'The school · Something',
  message: 'Text',
  status: 'open',
  reporter: { id: 1, name: 'Sam', roles: ['student'] },
  createdAt: `2026-11-1${id}T10:00:00Z`,
  ...over,
})
const rows = [
  report('1', { status: 'resolved' }),
  report('2', { subject: 'A student: Murad · Copying', reporter: { id: 9, name: 'Aysel', roles: ['mentor'] } }),
  report('3', { subject: 'Free text subject' }),
]
const ids = (f: Partial<typeof ALL_REPORTS>) => filterReports(rows, { ...ALL_REPORTS, ...f }).map((r) => r.id)

describe('filterReports', () => {
  it('open ones by default, newest first; "all" puts the open ones first', () => {
    expect(ids({})).toEqual(['3', '2'])
    expect(ids({ show: 'all' })).toEqual(['3', '2', '1'])
    expect(ids({ show: 'resolved' })).toEqual(['1'])
  })
  it('by the sender’s role, by what it is about, and by words', () => {
    expect(ids({ role: 'mentor' })).toEqual(['2'])
    expect(ids({ show: 'all', about: 'school' })).toEqual(['1'])
    expect(ids({ about: 'unknown' })).toEqual(['3'])
    expect(ids({ query: 'aysel' })).toEqual(['2'])
  })
  it('counts each status with the other filters applied', () => {
    expect(countByStatus(rows, ALL_REPORTS)).toEqual({ open: 2, resolved: 1, all: 3 })
    expect(countByStatus(rows, { ...ALL_REPORTS, role: 'mentor' })).toEqual({ open: 1, resolved: 0, all: 1 })
  })
})
