import { describe, expect, it } from 'vitest'
import {
  eventToApi,
  mapGoogleEvent,
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

  it('maps a link with its address; a link without one is left out', () => {
    const [m] = mapModules([modules[1]], {
      '1': [
        { id: 30, type: 'link', title: 'Go docs', description: 'Read', position: 1, is_visible: true, url: 'https://go.dev/doc/' },
        { id: 31, type: 'link', title: 'Broken', description: '', position: 2, is_visible: true, url: null },
      ],
    })
    expect(m.items).toEqual([{ id: '30', moduleId: '1', type: 'resource', title: 'Go docs', kind: 'link', url: 'https://go.dev/doc/', description: 'Read' }])
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

  it('numbers the weeks in the order they open, not the order they were made in', () => {
    const made = (id: number, created: string, opens: string) => ({ id, title: `W${id}`, created_by: 9, created_at: created, opens_at: opens, closes_at: '2027-06-01T00:00:00Z' })
    const out = mapModules(
      [made(1, '2026-10-01T09:00:00Z', '2026-11-16T00:00:00Z'), made(2, '2026-10-02T09:00:00Z', '2026-11-02T00:00:00Z'), made(3, '2026-10-03T09:00:00Z', '2026-11-09T00:00:00Z')],
      {},
    )
    expect(out.map((m) => [m.id, m.position])).toEqual([['2', 1], ['3', 2], ['1', 3]])
  })

  it('weeks that open together keep the order they were made in; a week without an opening date goes last', () => {
    const out = mapModules(
      [
        { id: 5, title: 'No date', created_by: 9, created_at: '2026-10-01T00:00:00Z' },
        { id: 4, title: 'B', created_by: 9, created_at: '2026-10-03T00:00:00Z', opens_at: '2026-11-02T00:00:00Z' },
        { id: 3, title: 'A', created_by: 9, created_at: '2026-10-02T00:00:00Z', opens_at: '2026-11-02T00:00:00Z' },
      ],
      {},
    )
    expect(out.map((m) => m.id)).toEqual(['3', '4', '5'])
  })

  it('the lecturer of a week is the assigned one; who made the module (an admin) is never taken for it', () => {
    expect(mapModules(modules, items)[0]).not.toHaveProperty('createdBy')
    expect(mapModules([{ ...modules[1], lecturer_id: 12 }], items)[0]).toMatchObject({ createdBy: 12, createdAt: '2026-10-01T09:00:00Z' })
    expect(mapModules([{ ...modules[1], lecturer_id: null }], items)[0]).not.toHaveProperty('createdBy')
  })

  it('for admins: hidden items are kept and marked hidden', () => {
    const [m1] = mapModules(modules, items, {}, { includeHidden: true })
    expect(m1.items.map((i) => [i.id, !!i.hidden])).toEqual([
      ['11', false],
      ['12', false],
      ['13', true],
    ])
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

  it('maps earlier attempts (proposed `history`) newest first; none means no history', () => {
    const s = mapSubmission(
      submission({
        history: [
          { id: 1, content_item_id: 41, text_body: 'first', submitted_at: '2026-10-01T10:00:00Z' },
          { id: 2, content_item_id: 41, text_body: 'second', submitted_at: '2026-10-03T10:00:00Z', files: [{ id: 5, original_name: 'b.md', mime_type: 'text/markdown', size_bytes: 4 }] },
        ],
      }),
    )
    expect(s.history).toEqual([
      { submittedAt: '2026-10-03T10:00:00Z', textBody: 'second', files: [{ id: '5', name: 'b.md', sizeBytes: 4 }] },
      { submittedAt: '2026-10-01T10:00:00Z', textBody: 'first' },
    ])
    expect(mapSubmission(submission({ history: null }))).not.toHaveProperty('history')
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
    ).toEqual({ title: 'Lecture', kind: 'lecture', starts_at: 'a', ends_at: 'b', all_day: false, location: 'Hall', description: '', meeting_url: '', module_id: 4 })
  })

  it('an event sends its meeting link, or an empty one so editing can take it away (null would keep it)', () => {
    const base = { id: 'ev-1', title: 'Lecture', kind: 'lecture' as const, startsAt: 'a', endsAt: 'b' }
    expect(eventToApi({ ...base, meetingUrl: 'https://meet.google.com/abc-defg-hij' }).meeting_url).toBe('https://meet.google.com/abc-defg-hij')
    expect(eventToApi(base).meeting_url).toBe('')
    // what the server fills in is never sent back
    const sent = eventToApi({ ...base, googleEventId: 'g1', attendees: [{ id: 1, name: 'A', email: 'a@x.az' }] })
    expect(sent).not.toHaveProperty('google_event_id')
    expect(sent).not.toHaveProperty('attendees')
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

  it('maps the Google Calendar id of an event that was put there, and never sends it back', () => {
    const row = { id: 5, title: 'Lecture', kind: 'lecture', starts_at: 's', ends_at: 'e', all_day: false }
    expect(mapEvent({ ...row, google_event_id: 'abc123' }).googleEventId).toBe('abc123')
    expect(mapEvent({ ...row, google_event_id: null })).not.toHaveProperty('googleEventId')
    expect(mapEvent(row)).not.toHaveProperty('googleEventId')
    expect(eventToApi(mapEvent({ ...row, google_event_id: 'abc123' }))).not.toHaveProperty('google_event_id')
  })

  it('maps the meeting link of a lecture', () => {
    expect(mapEvent({ id: 5, title: 'Lecture', kind: 'lecture', starts_at: 's', ends_at: 'e', all_day: false, meeting_url: 'https://meet.google.com/abc-defg-hij' }).meetingUrl).toBe(
      'https://meet.google.com/abc-defg-hij',
    )
    expect(mapEvent({ id: 5, title: 'Lecture', kind: 'lecture', starts_at: 's', ends_at: 'e', all_day: false, meeting_url: null })).not.toHaveProperty('meetingUrl')
  })

  it('reads the week dates when the server sends them', () => {
    const [m] = mapModules([{ ...modules[1], opens_at: '2026-11-02T00:00:00Z', closes_at: '2026-11-08T23:59:00Z' }], {})
    expect(m).toMatchObject({ opensAt: '2026-11-02T00:00:00Z', closesAt: '2026-11-08T23:59:00Z' })
    expect(mapModules([modules[1]], {})[0]).not.toHaveProperty('opensAt')
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

describe('attendees', () => {
  const base = { id: 5, title: 'Lecture', kind: 'lecture', starts_at: 's', ends_at: 'e', all_day: false }
  it('an event keeps its attendees (ids as numbers, emails kept in the data)', () => {
    const e = mapEvent({ ...base, attendees: [{ id: '1', name: 'Admin', email: 'admin@edu.com' }, { id: 5, name: 'User user', email: 'u@x.az' }] })
    expect(e.attendees).toEqual([
      { id: 1, name: 'Admin', email: 'admin@edu.com' },
      { id: 5, name: 'User user', email: 'u@x.az' },
    ])
  })
  it('a picture address comes along as avatarUrl; none (or null) leaves it out', () => {
    const e = mapEvent({
      ...base,
      attendees: [
        { id: 1, name: 'A', email: 'a@x.az', avatar_url: 'http://api.test/avatars/ab.webp' },
        { id: 2, name: 'B', email: 'b@x.az', avatar_url: null },
      ],
    })
    expect(e.attendees?.[0]).toMatchObject({ avatarUrl: 'http://api.test/avatars/ab.webp' })
    expect(e.attendees?.[1]).not.toHaveProperty('avatarUrl')
  })
  it.each([[undefined], [null], [[]]])('no attendees (%j) leaves the field out', (attendees) => {
    expect(mapEvent({ ...base, attendees })).not.toHaveProperty('attendees')
  })
})

describe('mapGoogleEvent: one event of the person’s own Google Calendar', () => {
  it('a timed event keeps its times and details and gets a prefixed id', () => {
    const e = mapGoogleEvent({
      id: 'abc_20261120',
      title: 'Dentist',
      description: 'A personal event',
      location: 'Smile Clinic',
      starts_at: '2026-11-20T10:00:00+04:00',
      ends_at: '2026-11-20T11:00:00+04:00',
      all_day: false,
      meeting_url: 'https://meet.google.com/fix-pwcp-yzu',
      html_link: 'https://www.google.com/calendar/event?eid=1',
    })
    expect(e).toMatchObject({
      id: 'google-abc_20261120',
      kind: 'google',
      source: 'google',
      title: 'Dentist',
      startsAt: '2026-11-20T10:00:00+04:00',
      endsAt: '2026-11-20T11:00:00+04:00',
      location: 'Smile Clinic',
      meetingUrl: 'https://meet.google.com/fix-pwcp-yzu',
      htmlLink: 'https://www.google.com/calendar/event?eid=1',
      googleEventId: 'abc_20261120',
    })
    expect(e.allDay).toBeUndefined()
  })

  it('an all-day event covers its local days, the last one included, whatever the time zone', () => {
    const one = mapGoogleEvent({ id: 'b', title: 'Birthday', starts_at: '2026-11-20', ends_at: '2026-11-20', all_day: true })
    expect(one.allDay).toBe(true)
    const start = new Date(one.startsAt)
    const end = new Date(one.endsAt)
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 10, 20, 0])
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes()]).toEqual([2026, 10, 20, 23, 59])
    const trip = mapGoogleEvent({ id: 'c', title: 'Trip', starts_at: '2026-11-20', ends_at: '2026-11-22', all_day: true })
    expect(new Date(trip.endsAt).getDate()).toBe(22)
  })

  it('a missing title becomes (No title); a link that is not https is dropped', () => {
    const e = mapGoogleEvent({ id: 'd', title: '  ', starts_at: 's', ends_at: 'e', all_day: false, html_link: 'javascript:alert(1)', meeting_url: 'ftp://x' })
    expect(e.title).toBe('(No title)')
    expect(e).not.toHaveProperty('htmlLink')
    expect(e).not.toHaveProperty('meetingUrl')
  })
})
