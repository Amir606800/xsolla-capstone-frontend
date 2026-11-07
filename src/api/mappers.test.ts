import { describe, expect, it } from 'vitest'
import {
  eventToApi,
  isServerId,
  joinDescription,
  mapEvent,
  mapModules,
  mapSubmission,
  mapWeeklyStandings,
  splitDescription,
  taskToApi,
} from './mappers'
import type { ApiContentItem, ApiModule, ApiSubmission, ApiWeeklyStanding } from './types'

// shapes as the Go backend sends them: numeric ids, flat items, no sections
const modules: ApiModule[] = [
  { id: 2, title: 'Web Fundamentals', description: 'HTML and CSS', created_by: 9, created_at: '2026-10-02T09:00:00Z' },
  { id: 1, title: 'Onboarding & Git', description: '', created_by: 9, created_at: '2026-10-01T09:00:00Z' },
]
const items: Record<string, ApiContentItem[]> = {
  '1': [
    { id: 12, type: 'assignment', title: 'Git workflow', description: 'Branches', position: 2, is_visible: true, file_id: null, due_at: '2026-10-05T18:00:00Z', max_points: 0 },
    { id: 11, type: 'file', title: 'Slides.PDF', description: '', position: 1, is_visible: true, file_id: 55 },
    { id: 13, type: 'file', title: 'draft.md', description: '', position: 3, is_visible: false, file_id: 56 },
    { id: 14, type: 'assignment', title: 'No deadline', description: '', position: 4, is_visible: true, file_id: null },
  ],
  '2': [{ id: 21, type: 'assignment', title: 'Landing page', description: '', position: 0, is_visible: true, file_id: null, due_at: '2026-10-12T18:00:00Z' }],
}

const submission = (over: Partial<ApiSubmission> = {}): ApiSubmission => ({
  id: 7,
  content_item_id: 12,
  student_id: 1,
  text_body: 'done',
  submitted_at: '2026-10-05T10:00:00Z',
  ...over,
})

describe('mapModules', () => {
  it('turns each backend module into a week, numbered in the order they were created', () => {
    const out = mapModules(modules, items)
    expect(out.map((m) => [m.id, m.position, m.title])).toEqual([
      ['1', 1, 'Onboarding & Git'],
      ['2', 2, 'Web Fundamentals'],
    ])
    expect(out[1].description).toBe('HTML and CSS')
    // no week dates in the backend: nothing is locked
    expect(out[0].opensAt).toBeUndefined()
  })

  it('maps the flat items of each module in position order, keeping the real module id on every item', () => {
    const [m1] = mapModules(modules, items)
    expect(m1.items.map((i) => [i.id, i.type, i.moduleId])).toEqual([
      ['11', 'resource', '1'],
      ['12', 'assignment', '1'],
    ])
    expect(m1.items[0]).toMatchObject({ kind: 'pdf', fileId: '55' })
    expect(m1.items[1]).toMatchObject({ dueAt: '2026-10-05T18:00:00Z', description: 'Branches' })
  })

  it('leaves out hidden items and tasks without a deadline', () => {
    const ids = mapModules(modules, items).flatMap((m) => m.items.map((i) => i.id))
    expect(ids).not.toContain('13')
    expect(ids).not.toContain('14')
  })

  it("puts the student's own work on its task only", () => {
    const [m1, m2] = mapModules(modules, items, { '12': submission({ feedback: 'Nice' }) })
    expect(m1.items[1]).toMatchObject({ submission: { submittedAt: '2026-10-05T10:00:00Z', textBody: 'done', feedback: 'Nice' } })
    expect(m2.items[0]).not.toHaveProperty('submission')
  })

  it('handles no modules, and a module without items', () => {
    expect(mapModules([], {})).toEqual([])
    expect(mapModules([modules[0]], {})[0].items).toEqual([])
  })
})

describe('mapSubmission', () => {
  it('maps the files and leaves out what is empty', () => {
    const s = mapSubmission(submission({ text_body: '', files: [{ id: 3, original_name: 'a.zip', mime_type: 'application/zip', size_bytes: 10 }] }))
    expect(s).toEqual({ submittedAt: '2026-10-05T10:00:00Z', files: [{ id: '3', name: 'a.zip', sizeBytes: 10 }] })
  })

  it('has no grade value: the program grades weeks, not tasks', () => {
    expect(mapSubmission(submission({ grade: 80, graded_at: '2026-10-06T09:00:00Z' }))).not.toHaveProperty('grade')
  })
})

describe('task requirements travel inside the description', () => {
  it('round-trips', () => {
    const text = joinDescription('Build it', ['Push to the repo', 'Write a README'])
    expect(splitDescription(text)).toEqual({ description: 'Build it', requirements: ['Push to the repo', 'Write a README'] })
  })

  it('a plain description stays as it is', () => {
    expect(joinDescription('Just text', undefined)).toBe('Just text')
    expect(splitDescription('Just text')).toEqual({ description: 'Just text' })
    expect(splitDescription('')).toEqual({})
  })
})

describe('what is sent', () => {
  it('a task: type, title, description with requirements, due date, max_points 0', () => {
    const body = taskToApi({ id: 'task-x', moduleId: '1', type: 'assignment', title: 'Kata', requirements: ['Tests'], dueAt: '2026-10-09T18:00:00.000Z' })
    expect(body).toMatchObject({ type: 'assignment', title: 'Kata', due_at: '2026-10-09T18:00:00.000Z', max_points: 0, is_visible: true })
    expect(splitDescription(body.description).requirements).toEqual(['Tests'])
  })

  it('an event, with the module id as a number', () => {
    expect(
      eventToApi({ id: 'ev-1', title: 'Lecture', kind: 'lecture', startsAt: 'a', endsAt: 'b', moduleId: '4', location: 'Hall' }),
    ).toEqual({ title: 'Lecture', kind: 'lecture', starts_at: 'a', ends_at: 'b', all_day: false, location: 'Hall', module_id: 4 })
  })

  it('tells server ids from the ones the app makes up', () => {
    expect(isServerId('42')).toBe(true)
    expect(isServerId('task-lx2')).toBe(false)
  })
})

describe('mapEvent', () => {
  it('maps a backend event and its module', () => {
    expect(
      mapEvent({ id: 5, title: 'Guest talk', kind: 'lecture', starts_at: 's', ends_at: 'e', all_day: false, location: null, module_id: 3 }),
    ).toEqual({ id: '5', title: 'Guest talk', kind: 'lecture', startsAt: 's', endsAt: 'e', moduleId: '3' })
  })

  it('shows an unknown kind as a meeting', () => {
    expect(mapEvent({ id: 6, title: 'x', kind: 'party', starts_at: 's', ends_at: 'e', all_day: true }).kind).toBe('meeting')
  })
})

describe('mapWeeklyStandings', () => {
  const row = (over: Partial<ApiWeeklyStanding> = {}): ApiWeeklyStanding => ({
    week: 1,
    level: 'green',
    assessed_at: '2026-11-07T18:00:00Z',
    note: null,
    ...over,
  })

  it('maps rows, sorted by week, and keeps the mentor note', () => {
    expect(mapWeeklyStandings([row({ week: 2, level: 'yellow', note: 'Catch up' }), row({ week: 1 })])).toEqual([
      { week: 1, level: 'green', assessedAt: '2026-11-07T18:00:00Z' },
      { week: 2, level: 'yellow', assessedAt: '2026-11-07T18:00:00Z', note: 'Catch up' },
    ])
  })

  it('drops a level it does not know instead of guessing', () => {
    expect(mapWeeklyStandings([row({ level: 'blue' })])).toEqual([])
  })
})
