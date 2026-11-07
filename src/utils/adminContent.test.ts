import { describe, expect, it } from 'vitest'
import type { AssignmentItem, CourseModule, QuizItem, ResourceItem } from '../types/course'
import { contentsLine, itemAuthor, itemSummary, keepMeta, moduleDates, moduleDeleteWarning } from './adminContent'

const task: AssignmentItem = {
  id: 'a1',
  moduleId: 'm1',
  type: 'assignment',
  title: 'CLI tool',
  dueAt: '2026-11-09T18:00:00',
  requirements: ['Tests', 'README'],
}
const link: ResourceItem = { id: 'r1', moduleId: 'm1', type: 'resource', title: 'MDN', kind: 'link', url: 'https://developer.mozilla.org/en-US/' }
const file: ResourceItem = { id: 'r2', moduleId: 'm1', type: 'resource', title: 'Slides', kind: 'pdf', file: { name: 'slides.pdf', sizeBytes: 10 } }
const quiz: QuizItem = { id: 'q1', moduleId: 'm1', type: 'quiz', title: 'Check', questions: [{ id: 'x', prompt: '?', options: ['a', 'b'], correct: 0 }] }
const module = (items: CourseModule['items'], over: Partial<CourseModule> = {}): CourseModule => ({ id: 'm1', position: 1, title: 'Go', items, ...over })

describe('admin content text', () => {
  it('summarises each kind of item in one line', () => {
    expect(itemSummary(task)).toMatch(/^Due .+ · 2 requirements$/)
    expect(itemSummary({ ...task, requirements: undefined })).not.toContain('requirement')
    expect(itemSummary(link)).toBe('Link · developer.mozilla.org')
    expect(itemSummary(file)).toBe('PDF · slides.pdf')
    expect(itemSummary(quiz)).toBe('1 question')
    expect(itemSummary({ ...quiz, questions: [], dueAt: '2026-11-09T18:00:00' })).toMatch(/^0 questions · due /)
  })

  it('counts what a module holds and shows its dates', () => {
    expect(contentsLine(module([task, link, file, quiz]))).toBe('1 task · 2 resources · 1 quiz')
    expect(moduleDates(module([]))).toBe('No dates')
    expect(moduleDates(module([], { opensAt: '2026-11-02T00:00:00', closesAt: '2026-11-08T23:59:00' }))).toMatch(/^\w+ \d+ – \w+ \d+$/)
  })

  it('warns what goes with a deleted module', () => {
    expect(moduleDeleteWarning(module([]))).toBe('It has no content.')
    expect(moduleDeleteWarning(module([task, quiz]))).toBe('Its 1 task · 0 resources · 1 quiz are deleted with it. Work students already handed in is kept.')
  })

  it('an item is by its own author when known, else by the module lecturer', () => {
    expect(itemAuthor(task, module([], { createdBy: 900 }))).toBe(900)
    expect(itemAuthor({ ...task, createdBy: 907 }, module([], { createdBy: 900 }))).toBe(907)
  })

  it('an edit keeps the author and the hidden flag the form does not know about', () => {
    const before = { ...task, createdBy: 907, hidden: true }
    expect(keepMeta(before, { ...task, title: 'New' })).toMatchObject({ title: 'New', createdBy: 907, hidden: true })
    expect(keepMeta(task, { ...task, title: 'New' })).not.toHaveProperty('hidden')
    expect(keepMeta(undefined, task)).toBe(task)
  })
})
