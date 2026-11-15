import { describe, expect, it } from 'vitest'
import { foldedGroups, groupOfPath, shouldFold, toggleFolded } from './navFold'

describe('shouldFold: only a menu that does not fit folds', () => {
  it('fits: no folding', () => {
    expect(shouldFold(700, 600)).toBe(false)
    expect(shouldFold(700, 700)).toBe(false)
    expect(shouldFold(700, 701)).toBe(false) // a pixel of slack
  })
  it('too tall: folds', () => expect(shouldFold(500, 640)).toBe(true))
  it('a screen with no measured height (not laid out yet) never folds', () => {
    expect(shouldFold(0, 640)).toBe(false)
    expect(shouldFold(-4, 640)).toBe(false)
  })
})

describe('groupOfPath', () => {
  const groups = [
    { id: 'Course', paths: ['/admin/modules', '/admin/calendar'] },
    { id: 'People', paths: ['/admin/students', '/admin/teams'] },
    { id: 'Feedback', paths: ['/admin/mentor-reviews', '/admin/lecture-reviews'] },
  ]
  it('finds the group of a page and of a page inside a section', () => {
    expect(groupOfPath(groups, '/admin/teams')).toBe('People')
    expect(groupOfPath(groups, '/admin/modules/m3')).toBe('Course')
    expect(groupOfPath(groups, '/admin/lecture-reviews')).toBe('Feedback')
  })
  it('a page of no group (the overview, the profile) is in none', () => {
    expect(groupOfPath(groups, '/admin')).toBeNull()
    expect(groupOfPath(groups, '/admin/profile')).toBeNull()
  })
  it('does not mistake a longer name for a section (/admin/teams-old is not /admin/teams)', () => {
    expect(groupOfPath(groups, '/admin/teams-old')).toBeNull()
  })
  it('the longest link wins', () => {
    const g = [
      { id: 'A', paths: ['/team'] },
      { id: 'B', paths: ['/team/grading'] },
    ]
    expect(groupOfPath(g, '/team/grading/x')).toBe('B')
  })
})

describe('foldedGroups and toggleFolded', () => {
  const ids = ['Course', 'People', 'Feedback']
  it('before any choice, everything is folded except the group of the current page', () => {
    expect(foldedGroups(null, ids, 'People')).toEqual(['Course', 'Feedback'])
    expect(foldedGroups(null, ids, null)).toEqual(ids)
  })
  it('after a choice, the choice stands (groups that no longer exist are forgotten)', () => {
    expect(foldedGroups(['Feedback', 'Gone'], ids, 'People')).toEqual(['Feedback'])
    expect(foldedGroups([], ids, 'People')).toEqual([])
  })
  it('toggling folds an open group and opens a folded one', () => {
    expect(toggleFolded(['Course'], 'People')).toEqual(['Course', 'People'])
    expect(toggleFolded(['Course', 'People'], 'Course')).toEqual(['People'])
  })
})
