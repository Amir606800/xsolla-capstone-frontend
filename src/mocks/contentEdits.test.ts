import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import type { AssignmentItem } from '../types/course'
import { addModule, listEvents, listModules, putEvent, putItem, putModule, removeEvent, removeItem, removeModule } from './contentEdits'

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

  it('an admin deletes a whole module: it is gone for everyone, and nothing more can be added to it', () => {
    removeModule('m3', NOW)
    expect(listModules(NOW).map((m) => m.id)).not.toContain('m3')
    expect(listModules(NOW)).toHaveLength(11)
    expect(() => putModule('m3', { title: 'x' }, NOW)).toThrow('does not exist')
    expect(() => putItem(task({ moduleId: 'm3' }), NOW)).toThrow('does not exist')
    expect(() => removeModule('m3', NOW)).toThrow('does not exist')
  })

  it('an admin adds a module after the last one; it takes items, edits and deletes like the rest', () => {
    const { id, modules } = addModule({ title: 'Kubernetes', description: 'Pods' }, 1000, NOW)
    expect(modules).toHaveLength(13)
    expect(mod(id)).toMatchObject({ title: 'Kubernetes', description: 'Pods', position: 13, createdBy: 1000, items: [] })
    putItem(task({ id: 'k-1', moduleId: id }), NOW)
    putModule(id, { title: 'K8s' }, NOW)
    expect(mod(id)).toMatchObject({ title: 'K8s', items: [expect.objectContaining({ id: 'k-1' })] })
    // a second one goes after it, even after a demo module is deleted
    removeModule('m12', NOW)
    const second = addModule({ title: 'Helm' }, 1000, new Date(NOW.getTime() + 1000))
    expect(mod(second.id).position).toBe(14)
    removeModule(id, NOW)
    expect(listModules(NOW).some((m) => m.id === id)).toBe(false)
  })

  it('a week can be given to another lecturer', () => {
    putModule('m1', { createdBy: 902 }, NOW)
    expect(mod('m1').createdBy).toBe(902)
    expect(mod('m3').createdBy).toBe(900)
  })

  it('a week can have no lecturer, and that is kept', () => {
    putModule('m1', { createdBy: null }, NOW)
    expect(mod('m1').createdBy).toBeUndefined()
    expect(JSON.parse(localStorage.getItem('course_edits')!).modules.m1.createdBy).toBeNull()
    putModule('m1', { createdBy: 902 }, NOW)
    expect(mod('m1').createdBy).toBe(902)
  })

  it('demo modules know their lecturer and when they were created', () => {
    expect(mod('m1')).toMatchObject({ createdBy: 900 })
    expect(mod('m2')).toMatchObject({ createdBy: 902 })
    expect(new Date(mod('m1').createdAt!).getTime()).toBeLessThan(new Date(mod('m1').opensAt!).getTime())
    expect(mod('m5').items.filter((i) => i.type === 'quiz').every((q) => q.createdBy === 907)).toBe(true)
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
