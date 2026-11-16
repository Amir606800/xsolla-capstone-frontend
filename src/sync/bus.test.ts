import { describe, expect, it, vi } from 'vitest'
import { publish, subscribe, topicsForPath } from './bus'

const later = () => new Promise<void>((resolve) => queueMicrotask(resolve))

describe('the sync bus', () => {
  it('tells the listeners of a topic, and only those', async () => {
    const courses = vi.fn()
    const events = vi.fn()
    const stopCourses = subscribe(['courses'], courses)
    const stopEvents = subscribe(['events'], events)
    publish(['courses'])
    await later()
    expect(courses).toHaveBeenCalledTimes(1)
    expect(events).not.toHaveBeenCalled()
    stopCourses()
    stopEvents()
  })

  it('merges what is published in the same moment into one message', async () => {
    const seen = vi.fn()
    const stop = subscribe(['courses', 'standings'], seen)
    publish(['courses'])
    publish(['standings', 'courses'])
    await later()
    expect(seen).toHaveBeenCalledTimes(1)
    expect([...seen.mock.calls[0][0]].sort()).toEqual(['courses', 'standings'])
    stop()
  })

  it('stops telling a listener that has stopped', async () => {
    const seen = vi.fn()
    subscribe(['slots'], seen)()
    publish(['slots'])
    await later()
    expect(seen).not.toHaveBeenCalled()
  })
})

describe('which topics a request changes', () => {
  it.each([
    ['/modules/3', ['courses', 'notifications']],
    ['/modules/3/enrollments/9/grade', ['courses', 'standings', 'notifications']],
    ['/submissions/4/comment', ['courses', 'notifications', 'standings']],
    ['/events/12', ['events', 'notifications']],
    ['/mentor-slots/5/book', ['slots', 'notifications']],
    ['/mentor-reviews', ['reviews']],
    ['/lecture-feedback', ['feedback']],
    ['/notifications/broadcast', ['notifications']],
    ['/users/7', ['directory', 'courses']],
    ['/users/7/profile', ['profile', 'directory']],
    ['/teams/2', ['directory', 'standings']],
    ['/auth/login', []],
  ])('%s', (path, topics) => {
    expect(topicsForPath(path)).toEqual(topics)
  })

  it('treats a route it does not know as a change of everything', () => {
    expect(topicsForPath('/something-new').length).toBeGreaterThan(5)
  })

  it('ignores the query string', () => {
    expect(topicsForPath('/events?from=2026-11-01')).toEqual(['events', 'notifications'])
  })
})
