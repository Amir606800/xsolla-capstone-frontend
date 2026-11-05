import { describe, expect, it } from 'vitest'
import { mapContentTree, mapSubmission, mapWeeklyStandings } from './mappers'
import type { ApiContentItem, ApiSubmission, ApiWeeklyStanding } from './types'

const tree: ApiContentItem[] = [
  {
    id: 20,
    type: 'section',
    title: 'Module 2',
    position: 2,
    is_visible: true,
    children: [{ id: 21, type: 'assignment', title: 'Landing page', position: 1, is_visible: true, due_at: '2026-11-12T20:00:00Z', max_points: 50 }],
  },
  {
    id: '10', // string ids are accepted too
    type: 'section',
    title: 'Module 1',
    position: 1,
    is_visible: true,
    children: [
      { id: 12, type: 'assignment', title: 'Git workflow', position: 3, is_visible: true, due_at: '2026-11-10T20:00:00Z', max_points: 100 },
      { id: 11, type: 'file', title: 'Slides.PDF', position: 1, is_visible: true, file_id: 55 },
      { id: 13, type: 'file', title: 'notes.txt', position: 2, is_visible: true, file_id: 56 },
      {
        id: 14,
        type: 'section',
        title: 'Extras',
        position: 4,
        is_visible: true,
        children: [{ id: 15, type: 'file', title: 'starter.zip', position: 1, is_visible: true, file_id: 57 }],
      },
      { id: 16, type: 'file', title: 'draft.md', position: 5, is_visible: false, file_id: 58 },
    ],
  },
  { id: 30, type: 'section', title: 'Hidden module', position: 3, is_visible: false, children: [] },
  { id: 31, type: 'file', title: 'root-level.pdf', position: 4, is_visible: true, file_id: 59 },
]

const submission = (over: Partial<ApiSubmission> = {}): ApiSubmission => ({
  id: 7,
  assignment_id: 12,
  text_body: 'done',
  submitted_at: '2026-11-09T18:00:00Z',
  grade: null,
  feedback: null,
  graded_at: null,
  ...over,
})

describe('mapContentTree', () => {
  it('turns visible top-level sections into modules ordered by position', () => {
    const modules = mapContentTree(tree)
    expect(modules.map((m) => [m.id, m.position, m.title])).toEqual([
      ['10', 1, 'Module 1'],
      ['20', 2, 'Module 2'],
    ])
  })

  it('maps files to resources (kind from extension) and assignments, in position order', () => {
    const [m1] = mapContentTree(tree)
    expect(m1.items.map((i) => [i.id, i.type])).toEqual([
      ['11', 'resource'],
      ['13', 'resource'],
      ['12', 'assignment'],
      ['15', 'resource'], // flattened from nested section
    ])
    expect(m1.items[0]).toMatchObject({ kind: 'pdf', moduleId: '10', title: 'Slides.PDF' })
    expect(m1.items[1]).toMatchObject({ kind: 'link' }) // unknown extension
    expect(m1.items[3]).toMatchObject({ kind: 'zip' })
    expect(m1.items[2]).toMatchObject({
      dueAt: '2026-11-10T20:00:00Z',
      moduleId: '10',
    })
  })

  it('drops invisible items and root-level non-section items', () => {
    const ids = mapContentTree(tree).flatMap((m) => [m.id, ...m.items.map((i) => i.id)])
    expect(ids).not.toContain('16') // invisible file
    expect(ids).not.toContain('30') // invisible module
    expect(ids).not.toContain('31') // root-level file
  })

  it('attaches the student submission to its assignment (and only that one)', () => {
    const [m1, m2] = mapContentTree(tree, { '12': submission({ feedback: 'Nice', graded_at: '2026-11-10T09:00:00Z' }) })
    const git = m1.items.find((i) => i.id === '12')
    expect(git).toMatchObject({
      submission: { submittedAt: '2026-11-09T18:00:00Z', feedback: 'Nice', gradedAt: '2026-11-10T09:00:00Z' },
    })
    expect(m2.items[0]).not.toHaveProperty('submission')
  })

  it('handles an empty tree', () => {
    expect(mapContentTree([])).toEqual([])
  })
})

describe('mapSubmission', () => {
  it('maps nulls to undefined so "graded" is gradedAt !== undefined', () => {
    const s = mapSubmission(submission())
    expect(s).toEqual({ submittedAt: '2026-11-09T18:00:00Z', textBody: 'done' })
    expect(s.gradedAt).toBeUndefined()
  })

  it('maps feedback and the time it was graded', () => {
    const s = mapSubmission(submission({ feedback: 'Nice', graded_at: '2026-11-10T09:00:00Z' }))
    expect(s).toMatchObject({ feedback: 'Nice', gradedAt: '2026-11-10T09:00:00Z' })
  })

  it('has no grade value: the rating is given per week, not per task', () => {
    const s = mapSubmission(submission({ grade: 'green', graded_at: '2026-11-10T09:00:00Z' }))
    expect(s).not.toHaveProperty('grade')
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
    const out = mapWeeklyStandings([row({ week: 2, level: 'yellow', note: 'Catch up' }), row({ week: 1 })])
    expect(out).toEqual([
      { week: 1, level: 'green', assessedAt: '2026-11-07T18:00:00Z' },
      { week: 2, level: 'yellow', assessedAt: '2026-11-07T18:00:00Z', note: 'Catch up' },
    ])
  })

  it('accepts any letter case', () => {
    expect(mapWeeklyStandings([row({ level: 'RED' })])[0].level).toBe('red')
  })

  it('drops a row with a level it does not know instead of guessing', () => {
    expect(mapWeeklyStandings([row({ level: 'blue' }), row({ week: 2, level: '90' })])).toEqual([])
  })
})
