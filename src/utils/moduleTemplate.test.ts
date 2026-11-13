import { describe, expect, it, vi } from 'vitest'
import type { CourseModule } from '../types/course'
import { runImport } from './moduleImport'
import { buildTemplate, countTemplate, parseTemplate, planImport } from './moduleTemplate'

const at = (month: number, day: number, h = 0, m = 0) => new Date(2026, month - 1, day, h, m).toISOString()
const course: CourseModule[] = [
  {
    id: 'a',
    position: 1,
    title: 'Week 1',
    description: 'Start',
    opensAt: at(11, 2),
    closesAt: at(11, 8, 23, 59),
    items: [
      { id: 't1', moduleId: 'a', type: 'assignment', title: 'Kata', requirements: ['Tests'], dueAt: at(11, 6, 18) },
      { id: 'l1', moduleId: 'a', type: 'resource', kind: 'link', title: 'Docs', url: 'https://go.dev/doc/' },
      { id: 'f1', moduleId: 'a', type: 'resource', kind: 'pdf', title: 'Slides', fileId: '5' },
    ],
  },
  {
    id: 'b',
    position: 2,
    title: 'Week 2',
    opensAt: at(11, 9),
    closesAt: at(11, 15, 23, 59),
    items: [{ id: 'q1', moduleId: 'b', type: 'quiz', title: 'Quiz', questions: [{ id: 'x', prompt: '2+2?', options: ['3', '4'], correct: 1 }] }],
  },
  { id: 'c', position: 3, title: 'No dates', items: [] },
]

describe('the module template', () => {
  it('keeps dates relative to week 1 and says what could not go into the file', () => {
    const t = buildTemplate(course)
    expect(t.modules.map((m) => [m.title, m.opens.day, m.closes.day, m.closes.time])).toEqual([
      ['Week 1', 0, 6, '23:59'],
      ['Week 2', 7, 13, '23:59'],
    ])
    expect(t.modules[0].items).toEqual([
      { type: 'task', title: 'Kata', requirements: ['Tests'], due: { day: 4, time: '18:00' } },
      { type: 'link', title: 'Docs', url: 'https://go.dev/doc/' },
    ])
    expect(t.left_out).toEqual({ files: 1, modulesWithoutDates: 1 })
  })

  it('a file made from a course reads back, and makes the same course for another start day', () => {
    const parsed = parseTemplate(JSON.stringify(buildTemplate(course)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(countTemplate(parsed.template)).toEqual({ modules: 2, tasks: 1, links: 1, quizzes: 1 })
    const plan = planImport(parsed.template, '2027-02-01')
    expect(plan[0].opensAt).toBe(new Date(2027, 1, 1, 0, 0).toISOString())
    expect(plan[0].closesAt).toBe(new Date(2027, 1, 7, 23, 59).toISOString())
    expect(plan[0].items[0]).toMatchObject({ type: 'assignment', title: 'Kata', dueAt: new Date(2027, 1, 5, 18, 0).toISOString() })
    expect(plan[1].items[0]).toMatchObject({ type: 'quiz', questions: [{ prompt: '2+2?', correct: 1 }] })
  })

  it('refuses a file that is not a template, with a reason', () => {
    const bad = (x: unknown) => {
      const r = parseTemplate(typeof x === 'string' ? x : JSON.stringify(x))
      return r.ok ? 'ok' : r.error
    }
    expect(bad('not json')).toMatch(/not valid JSON/)
    expect(bad({ hello: 1 })).toMatch(/not a module template/)
    const good = JSON.parse(JSON.stringify(buildTemplate(course)))
    expect(bad({ ...good, version: 9 })).toMatch(/version 9/)
    expect(bad({ ...good, modules: [] })).toMatch(/no modules/)
    expect(bad({ ...good, modules: [{ ...good.modules[0], closes: { day: -1, time: '10:00' } }] })).toMatch(/closes before it opens/)
    expect(bad({ ...good, modules: [{ ...good.modules[0], items: [{ type: 'link', title: 'x', url: 'javascript:alert(1)' }] }] })).toMatch(/http/)
    expect(bad({ ...good, modules: [{ ...good.modules[0], items: [{ type: 'task', title: 'x', due: { day: 1, time: '25:00' } }] }] })).toMatch(/due date/)
  })
})

describe('runImport', () => {
  const plan = planImport(JSON.parse(JSON.stringify(buildTemplate(course))), '2027-02-01')
  let n = 0
  const newId = (p: string) => `${p}-${++n}`

  it('makes every module and its items, giving the items new ids under the new module', async () => {
    const written: { id: string; moduleId: string; type: string }[] = []
    const res = await runImport(
      plan,
      { createModule: vi.fn(async (p) => `mod-${p.title}`), writeItem: async (i) => void written.push({ id: i.id, moduleId: i.moduleId, type: i.type }) },
      newId,
    )
    expect(res).toMatchObject({ modules: 2, tasks: 1, links: 1, quizzes: 1, skipped: [] })
    expect(written.map((w) => [w.moduleId, w.type])).toEqual([['mod-Week 1', 'assignment'], ['mod-Week 1', 'resource'], ['mod-Week 2', 'quiz']])
    expect(written.every((w) => !/^\d+$/.test(w.id))).toBe(true) // app-made ids = "create"
  })

  it('an item the server refuses is listed and the rest carry on; a module that fails stops the import', async () => {
    const res = await runImport(
      plan,
      {
        createModule: async (p) => {
          if (p.title === 'Week 2') throw new Error('Closes must be after opens')
          return 'm1'
        },
        writeItem: async (i) => {
          if (i.type === 'resource') throw new Error('not supported')
        },
      },
      newId,
    )
    expect(res.modules).toBe(1)
    expect(res.tasks).toBe(1)
    expect(res.skipped).toEqual(['"Docs" in "Week 1": not supported'])
    expect(res.stoppedAt).toEqual({ title: 'Week 2', reason: 'Closes must be after opens' })
  })
})
