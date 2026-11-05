import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import type { AssignmentItem } from '../types/course'
import { listEvents, listModules, putEvent, putItem, putModule, removeEvent, removeItem } from './contentEdits'

const NOW = new Date(2026, 10, 4, 12, 0)
const mod = (id: string) => listModules(NOW).find((m) => m.id === id)!
const task = (patch: Partial<AssignmentItem> = {}): AssignmentItem => ({
  id: 'new-task',
  moduleId: 'm7',
  type: 'assignment',
  title: 'Indexes',
  dueAt: new Date(2026, 10, 13, 18).toISOString(),
  ...patch,
})

describe('course edits', () => {
  it('without edits the demo course is unchanged', () => {
    expect(listModules(NOW)).toHaveLength(12)
    expect(mod('m6').items).toHaveLength(4)
  })

  it('adds a new item to its module, after the existing ones, and keeps it', () => {
    putItem(task(), NOW)
    const items = mod('m7').items
    expect(items[items.length - 1]).toMatchObject({ id: 'new-task', title: 'Indexes' })
    expect(listModules(NOW).flatMap((m) => m.items).filter((i) => i.id === 'new-task')).toHaveLength(1)
  })

  it('edits an existing item in place and keeps the student work on it', () => {
    const before = mod('m6').items.find((i) => i.id === 'm6-a1') as AssignmentItem
    expect(before.submission).toBeDefined()
    putItem({ ...before, title: 'CLI tool v2' }, NOW)
    const after = mod('m6').items.find((i) => i.id === 'm6-a1') as AssignmentItem
    expect(after.title).toBe('CLI tool v2')
    expect(after.submission).toEqual(before.submission)
    expect(mod('m6').items.map((i) => i.id)).toEqual(['m6-r1', 'm6-r2', 'm6-a1', 'm6-a2']) // same place
  })

  it('never stores student work with the lecturer edit', () => {
    putItem(task({ submission: { submittedAt: 'x' } }), NOW)
    const saved = JSON.parse(localStorage.getItem('course_edits')!)
    expect(saved.items['new-task'].submission).toBeUndefined()
  })

  it('moves an item to another module', () => {
    const t = mod('m6').items.find((i) => i.id === 'm6-a2')!
    putItem({ ...t, moduleId: 'm7' }, NOW)
    expect(mod('m6').items.some((i) => i.id === 'm6-a2')).toBe(false)
    expect(mod('m7').items.some((i) => i.id === 'm6-a2')).toBe(true)
  })

  it('deletes demo items and new ones', () => {
    putItem(task(), NOW)
    removeItem('new-task', NOW)
    removeItem('m6-r1', NOW)
    expect(mod('m7').items.some((i) => i.id === 'new-task')).toBe(false)
    expect(mod('m6').items.some((i) => i.id === 'm6-r1')).toBe(false)
  })

  it('changes module details', () => {
    putModule('m7', { title: 'SQL', description: 'Queries' }, NOW)
    expect(mod('m7')).toMatchObject({ title: 'SQL', description: 'Queries', position: 7 })
    expect(() => putModule('m99', { title: 'x' }, NOW)).toThrow('does not exist')
    expect(() => putItem(task({ moduleId: 'm99' }), NOW)).toThrow('does not exist')
  })

  it('survives broken storage', () => {
    localStorage.setItem('course_edits', '{not json')
    expect(listModules(NOW)).toHaveLength(12)
  })
})

describe('event edits', () => {
  const lecture: CalendarEvent = {
    id: 'ev-1',
    title: 'Guest lecture',
    kind: 'lecture',
    startsAt: new Date(2026, 10, 10, 14).toISOString(),
    endsAt: new Date(2026, 10, 10, 16).toISOString(),
  }

  it('adds, edits and deletes events', () => {
    const base = listEvents(NOW).length
    putEvent(lecture, NOW)
    expect(listEvents(NOW)).toHaveLength(base + 1)
    putEvent({ ...lecture, title: 'Guest talk' }, NOW)
    expect(listEvents(NOW).find((e) => e.id === 'ev-1')?.title).toBe('Guest talk')
    removeEvent('ev-1', NOW)
    expect(listEvents(NOW)).toHaveLength(base)
  })

  it('can change or remove the demo events too', () => {
    const team = listEvents(NOW).find((e) => e.id === 'team-1')!
    putEvent({ ...team, location: 'Room 2' }, NOW)
    expect(listEvents(NOW).find((e) => e.id === 'team-1')?.location).toBe('Room 2')
    removeEvent('team-1', NOW)
    expect(listEvents(NOW).some((e) => e.id === 'team-1')).toBe(false)
  })
})
