import { describe, expect, it } from 'vitest'
import { STUDENT_NAV } from '../config/nav'
import { buildMockModules } from '../mocks/courses'
import { isModuleLocked } from './progress'
import { buildSearchItems, filterSearchItems } from './search'

const NOW = new Date(2026, 10, 5, 12)
const modules = buildMockModules(NOW)
const student = (m: (typeof modules)[number]) => isModuleLocked(m, NOW)
const everyone = () => false

describe('buildSearchItems', () => {
  it('includes every page from the navigation', () => {
    const pages = buildSearchItems(STUDENT_NAV, modules, student).filter((i) => i.group === 'Pages')
    expect(pages.map((p) => p.label)).toEqual(['Dashboard', 'My courses', 'Tasks', 'Calendar', 'Grades', 'My team'])
    expect(pages.find((p) => p.label === 'Calendar')?.to).toBe('/calendar')
  })

  it('includes open modules with their number, and their assignments with the module as hint', () => {
    const items = buildSearchItems(STUDENT_NAV, modules, student)
    const m6 = items.find((i) => i.id === 'module:m6')!
    expect(m6).toMatchObject({ group: 'Modules', label: 'Go Basics', hint: 'Module 6', to: '/courses/m6' })
    const task = items.find((i) => i.label === 'HTTP server')!
    expect(task).toMatchObject({ group: 'Assignments', hint: 'Go Basics', to: '/courses/m6' })
  })

  it('leaves locked modules AND their assignments out completely (no leaking)', () => {
    const items = buildSearchItems(STUDENT_NAV, modules, student)
    expect(items.some((i) => i.id === 'module:m7')).toBe(false)
    expect(items.some((i) => i.label === 'Schema design')).toBe(false) // a module 7 task
    expect(items.some((i) => i.hint === 'Databases & SQL')).toBe(false)
  })

  it('includes everything for viewers who are not locked out', () => {
    const items = buildSearchItems(STUDENT_NAV, modules, everyone)
    expect(items.filter((i) => i.group === 'Modules')).toHaveLength(12)
    expect(items.some((i) => i.label === 'Schema design')).toBe(true)
  })

  it('gives every item a unique id', () => {
    const items = buildSearchItems(STUDENT_NAV, modules, everyone)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})

describe('filterSearchItems', () => {
  const items = buildSearchItems(STUDENT_NAV, modules, student)

  it('with no query shows pages and open modules only (a quick launcher)', () => {
    const list = filterSearchItems(items, '')
    expect(list.some((i) => i.group === 'Assignments')).toBe(false)
    expect(list[0].group).toBe('Pages')
    expect(list.some((i) => i.group === 'Modules')).toBe(true)
    expect(filterSearchItems(items, '   ')).toEqual(list) // whitespace counts as empty
  })

  it('matches case-insensitively on the label', () => {
    expect(filterSearchItems(items, 'CALENDAR').map((i) => i.label)).toContain('Calendar')
    expect(filterSearchItems(items, 'http')[0].label).toBe('HTTP server')
  })

  it('also matches the hint (the module of an assignment)', () => {
    const list = filterSearchItems(items, 'git')
    // "Git workflow" / "Team setup" belong to "Onboarding & Git"
    expect(list.map((i) => i.label)).toEqual(expect.arrayContaining(['Onboarding & Git', 'Git workflow', 'Team setup']))
  })

  it('orders by group (pages, modules, assignments), then best match first', () => {
    const list = filterSearchItems(items, 'go')
    const groups = list.map((i) => i.group)
    expect(groups).toEqual([...groups].sort((a, b) => ['Pages', 'Modules', 'Assignments'].indexOf(a) - ['Pages', 'Modules', 'Assignments'].indexOf(b)))

    const assignments = list.filter((i) => i.group === 'Assignments')
    // labels that START with the query come before those that merely contain it / match the hint
    const startsWith = assignments.findIndex((i) => i.label.toLowerCase().startsWith('go'))
    const hintOnly = assignments.findIndex((i) => !i.label.toLowerCase().includes('go'))
    if (startsWith !== -1 && hintOnly !== -1) expect(startsWith).toBeLessThan(hintOnly)
  })

  it('finds nothing for gibberish and never throws on special characters', () => {
    expect(filterSearchItems(items, 'zzzzqqq')).toEqual([])
    expect(() => filterSearchItems(items, '(*[\\')).not.toThrow()
    expect(filterSearchItems(items, '(*[\\')).toEqual([])
  })

  it('does not find tasks of locked modules even when searching for them by name', () => {
    expect(filterSearchItems(items, 'schema')).toEqual([])
    expect(filterSearchItems(items, 'docker')).toEqual([])
  })

  it('respects the limit', () => {
    expect(filterSearchItems(items, 'a', 5)).toHaveLength(5)
  })
})
