import { describe, expect, it } from 'vitest'
import type { CourseModule } from '../types/course'
import {
  draftToEvent,
  draftToMaterial,
  draftToModulePatch,
  draftToQuiz,
  draftToTask,
  emptyQuestion,
  eventToDraft,
  fromInputs,
  hasErrors,
  isEditableEvent,
  isHttpUrl,
  materialToDraft,
  moduleToDraft,
  quizHasErrors,
  quizToDraft,
  splitLines,
  taskToDraft,
  taskWarnings,
  toDateInput,
  toTimeInput,
  validateEvent,
  validateMaterial,
  validateModule,
  validateQuiz,
  validateTask,
} from './authoring'

const NOW = new Date(2026, 10, 4, 12, 0)
const module: CourseModule = {
  id: 'm6',
  position: 6,
  title: 'Go Basics',
  opensAt: new Date(2026, 10, 2, 0, 0).toISOString(),
  closesAt: new Date(2026, 10, 8, 23, 59).toISOString(),
  items: [],
}

describe('date and time inputs', () => {
  it('round-trips local date and time', () => {
    const iso = fromInputs('2026-11-06', '18:00')!
    expect(toDateInput(iso)).toBe('2026-11-06')
    expect(toTimeInput(iso)).toBe('18:00')
    expect(new Date(iso).getHours()).toBe(18)
  })
  it.each([
    ['', '18:00'],
    ['2026-11-06', ''],
    ['2026-02-31', '10:00'],
    ['06/11/2026', '10:00'],
    ['2026-11-06', '25:00'],
  ])('rejects %s %s', (d, t) => {
    expect(fromInputs(d, t)).toBeNull()
  })
  it('empty for no date', () => {
    expect(toDateInput(undefined)).toBe('')
    expect(toTimeInput(undefined)).toBe('')
  })
})

describe('module', () => {
  it('starts from the module and validates the dates', () => {
    const d = moduleToDraft(module)
    expect(d).toMatchObject({ title: 'Go Basics', opensDate: '2026-11-02', closesDate: '2026-11-08' })
    expect(hasErrors(validateModule(d))).toBe(false)
    expect(validateModule({ ...d, title: ' ' }).title).toBe('Give it a title.')
    expect(validateModule({ ...d, closesDate: '2026-11-01' }).closesDate).toBe('The module must close after it opens.')
    expect(validateModule({ ...d, opensDate: '' }).opensDate).toBeDefined()
  })
  it('opens at the start of the first day and closes at the end of the last', () => {
    const patch = draftToModulePatch({ ...moduleToDraft(module), title: '  Go  ', description: '  ' })
    expect(patch.title).toBe('Go')
    expect(patch.description).toBeUndefined()
    expect(new Date(patch.opensAt!).getHours()).toBe(0)
    expect(new Date(patch.closesAt!).getHours()).toBe(23)
  })
})

describe('material', () => {
  it('a link needs a real http(s) address', () => {
    const d = { ...materialToDraft(), title: 'Docs', kind: 'link' as const }
    expect(validateMaterial(d).url).toBe('Paste the link.')
    expect(validateMaterial({ ...d, url: 'javascript:alert(1)' }).url).toMatch(/http/)
    expect(validateMaterial({ ...d, url: 'go.dev' }).url).toMatch(/http/)
    expect(hasErrors(validateMaterial({ ...d, url: 'https://go.dev/doc' }))).toBe(false)
  })
  it('a file kind needs a file', () => {
    const d = { ...materialToDraft(), title: 'Slides' }
    expect(validateMaterial(d).file).toBe('Choose a file to upload.')
    expect(hasErrors(validateMaterial({ ...d, file: { name: 's.pdf', sizeBytes: 10 } }))).toBe(false)
  })
  it('keeps only what the kind uses', () => {
    const link = draftToMaterial({ title: ' Go ', kind: 'link', description: '', url: ' https://go.dev ', file: { name: 'x', sizeBytes: 1 } }, 'm6', 'r1')
    expect(link).toEqual({ id: 'r1', moduleId: 'm6', type: 'resource', title: 'Go', kind: 'link', description: undefined, url: 'https://go.dev', file: undefined })
    const pdf = draftToMaterial({ title: 'S', kind: 'pdf', description: 'd', url: 'https://x.y', file: { name: 's.pdf', sizeBytes: 1 } }, 'm6', 'r2')
    expect(pdf.url).toBeUndefined()
    expect(pdf.file?.name).toBe('s.pdf')
  })
  it('isHttpUrl', () => {
    expect(isHttpUrl('http://a.b')).toBe(true)
    expect(isHttpUrl('ftp://a.b')).toBe(false)
    expect(isHttpUrl('nope')).toBe(false)
  })
})

describe('task', () => {
  it('a new task is due at 18:00 on the last day of the module', () => {
    const d = taskToDraft(undefined, module)
    expect(d.dueDate).toBe('2026-11-08')
    expect(d.dueTime).toBe('18:00')
    expect(validateTask(d).title).toBeDefined()
    expect(hasErrors(validateTask({ ...d, title: 'CLI' }))).toBe(false)
    expect(validateTask({ ...d, title: 'CLI', dueTime: '' }).due).toBe('Pick a due date and time.')
  })
  it('turns lines into requirements and drops empty ones', () => {
    const t = draftToTask({ title: 'CLI', description: '', requirements: ' Push it \n\n README ', dueDate: '2026-11-06', dueTime: '18:00' }, 'm6', 'a1')
    expect(t.requirements).toEqual(['Push it', 'README'])
    expect(t.description).toBeUndefined()
    expect(splitLines('')).toEqual([])
    expect(draftToTask({ title: 'x', description: '', requirements: '  ', dueDate: '2026-11-06', dueTime: '18:00' }, 'm6', 'a').requirements).toBeUndefined()
  })
  it('editing keeps the task values', () => {
    const t = draftToTask({ title: 'CLI', description: 'Do it', requirements: 'A\nB', dueDate: '2026-11-06', dueTime: '09:30' }, 'm6', 'a1')
    expect(taskToDraft(t, module)).toEqual({ title: 'CLI', description: 'Do it', requirements: 'A\nB', dueDate: '2026-11-06', dueTime: '09:30' })
  })
  it('warns about deadlines in the past or outside the module week', () => {
    const base = { title: 'x', description: '', requirements: '' }
    expect(taskWarnings({ ...base, dueDate: '2026-11-06', dueTime: '18:00' }, module, NOW)).toEqual([])
    expect(taskWarnings({ ...base, dueDate: '2026-11-10', dueTime: '18:00' }, module, NOW)).toEqual(['The task is due after the module closes.'])
    expect(taskWarnings({ ...base, dueDate: '2026-11-01', dueTime: '18:00' }, module, NOW)).toEqual([
      'This deadline has already passed, so students will see the task as overdue.',
      'The task is due before the module opens.',
    ])
  })
})

describe('quiz', () => {
  let n = 0
  const id = () => `q${n++}`
  const good = {
    title: 'Go check',
    description: '',
    dueDate: '',
    dueTime: '',
    questions: [{ id: 'a', prompt: 'What is :=?', options: ['Short declaration', 'Comparison'], correct: 0 }],
  }

  it('a new quiz starts with one empty question', () => {
    const d = quizToDraft(undefined, id)
    expect(d.questions).toHaveLength(1)
    expect(d.questions[0].options).toEqual(['', ''])
    expect(quizHasErrors(validateQuiz(d))).toBe(true)
  })
  it('accepts a complete quiz', () => {
    expect(quizHasErrors(validateQuiz(good))).toBe(false)
  })
  it.each([
    [{ prompt: '' }, 'Write the question.'],
    [{ options: ['Only one', ''] }, 'Give at least 2 answers.'],
    [{ options: ['A', 'B', ''] }, 'Fill in every answer, or remove the empty one.'],
    [{ correct: null }, 'Mark the right answer.'],
    [{ correct: 5 }, 'Mark the right answer.'],
  ])('explains a question problem %j', (patch, msg) => {
    const d = { ...good, questions: [{ ...good.questions[0], ...patch }] }
    expect(validateQuiz(d).byQuestion.a).toBe(msg)
  })
  it('needs a question, and both parts of a due date or neither', () => {
    expect(validateQuiz({ ...good, questions: [] }).questions).toBe('Add at least one question.')
    expect(validateQuiz({ ...good, dueDate: '2026-11-06' }).due).toBeDefined()
    expect(validateQuiz({ ...good, dueDate: '2026-11-06', dueTime: '10:00' }).due).toBeUndefined()
  })
  it('saves and reloads the same questions, including the right answer', () => {
    const q = draftToQuiz({ ...good, title: ' Go ', dueDate: '2026-11-06', dueTime: '10:00' }, 'm6', 'z1')
    expect(q).toMatchObject({ id: 'z1', moduleId: 'm6', type: 'quiz', title: 'Go' })
    expect(q.questions?.[0]).toEqual({ id: 'a', prompt: 'What is :=?', options: ['Short declaration', 'Comparison'], correct: 0 })
    expect(quizToDraft(q, id).questions[0].correct).toBe(0)
    expect(emptyQuestion('x').correct).toBeNull()
  })
})

describe('calendar event', () => {
  it('a new event is a 10:00-12:00 lecture on the chosen day', () => {
    const d = eventToDraft(undefined, '2026-11-06')
    expect(d).toMatchObject({ kind: 'lecture', date: '2026-11-06', start: '10:00', end: '12:00', allDay: false })
    expect(validateEvent(d).title).toBeDefined()
  })
  it('checks the times unless it is all day', () => {
    const d = { ...eventToDraft(undefined, '2026-11-06'), title: 'Lecture' }
    expect(hasErrors(validateEvent(d))).toBe(false)
    expect(validateEvent({ ...d, end: '09:00' }).time).toBe('The end time must be after the start time.')
    expect(hasErrors(validateEvent({ ...d, end: '09:00', allDay: true }))).toBe(false)
    expect(validateEvent({ ...d, date: '' }).date).toBe('Pick a day.')
  })
  it('turns the draft into an event and back', () => {
    const e = draftToEvent({ ...eventToDraft(undefined, '2026-11-06'), title: ' Go ', location: 'Hall', moduleId: 'm6' }, 'ev1')
    expect(e).toMatchObject({ id: 'ev1', title: 'Go', kind: 'lecture', location: 'Hall', moduleId: 'm6' })
    expect(new Date(e.startsAt).getHours()).toBe(10)
    expect(eventToDraft(e, 'x')).toMatchObject({ title: 'Go', date: '2026-11-06', start: '10:00', end: '12:00', moduleId: 'm6' })
    const allDay = draftToEvent({ ...eventToDraft(undefined, '2026-11-06'), title: 'Off', kind: 'off-campus', allDay: true }, 'ev2')
    expect(allDay.allDay).toBe(true)
    expect(new Date(allDay.endsAt).getHours()).toBe(23)
  })
  it('a meeting link is optional, must be an https link, and is dropped for an off-campus day', () => {
    const d = { ...eventToDraft(undefined, '2026-11-06'), title: 'Lecture' }
    expect(validateEvent(d).meetingUrl).toBe('')
    expect(validateEvent({ ...d, meetingUrl: 'https://meet.google.com/abc-defg-hij' }).meetingUrl).toBe('')
    expect(validateEvent({ ...d, meetingUrl: 'meet.google.com/abc' }).meetingUrl).toBe('Enter a full link, like https://meet.google.com/abc-defg-hij.')
    expect(validateEvent({ ...d, meetingUrl: 'javascript:alert(1)' }).meetingUrl).toBe('The link must start with https://.')
    expect(hasErrors(validateEvent({ ...d, meetingUrl: 'nonsense' }))).toBe(true)
    // an off-campus day has no meeting: a leftover link neither fails the form nor is saved
    const off = { ...d, kind: 'off-campus' as const, meetingUrl: 'nonsense' }
    expect(hasErrors(validateEvent(off))).toBe(false)
    expect(draftToEvent(off, 'x').meetingUrl).toBeUndefined()
    const lecture = draftToEvent({ ...d, meetingUrl: '  https://meet.google.com/abc-defg-hij ' }, 'y')
    expect(lecture.meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
    expect(eventToDraft(lecture, 'z').meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
  })
  it('only real events can be edited, not deadlines or 1:1 times', () => {
    const base = { title: 'x', startsAt: '', endsAt: '' }
    expect(isEditableEvent({ ...base, id: 'lec-1', kind: 'lecture' })).toBe(true)
    expect(isEditableEvent({ ...base, id: 'deadline-a', kind: 'deadline' })).toBe(false)
    expect(isEditableEvent({ ...base, id: 'slots-2026', kind: 'availability' })).toBe(false)
    expect(isEditableEvent({ ...base, id: 'slot-s1', kind: 'meeting' })).toBe(false)
    // the person's own Google events are shown, never edited
    expect(isEditableEvent({ ...base, id: 'google-a', kind: 'google', source: 'google' })).toBe(false)
    expect(isEditableEvent({ ...base, id: 'google-a', kind: 'lecture', source: 'google' })).toBe(false)
  })
})
