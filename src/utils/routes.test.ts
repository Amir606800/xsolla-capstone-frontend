import { describe, expect, it } from 'vitest'
import { buildMockModules } from '../mocks/courses'
import { describeRoute } from './routes'

const modules = buildMockModules(new Date(2026, 10, 5))

describe('describeRoute', () => {
  it.each([
    ['/calendar', 'the Calendar'],
    ['/dashboard', 'the Dashboard'],
    ['/courses', 'My courses'],
    ['/courses/m6', 'Module 6: Go Basics'],
    ['/courses/m6/', 'Module 6: Go Basics'],
    ['/courses/m6?x=1#top', 'Module 6: Go Basics'],
    ['/courses/unknown', 'a course page'],
    ['/something-else', 'another page'],
  ])('%s -> %s', (link, expected) => {
    expect(describeRoute(link, modules)).toBe(expected)
  })

  it('still gives a sensible answer before the courses have loaded', () => {
    expect(describeRoute('/courses/m6', [])).toBe('a course page')
  })
})
