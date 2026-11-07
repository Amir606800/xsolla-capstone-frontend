import type { CalendarEvent } from '../types/calendar'
import type { AssignmentItem, CourseModule, QuizItem, QuizQuestion, ResourceItem } from '../types/course'

/**
 * Lecturer forms: drafts (what the inputs hold), validation and turning a draft into the item
 * that is saved. Everything here is pure so it can be tested without the UI.
 */

export type Errors<K extends string> = Partial<Record<K, string>>
export const hasErrors = (e: Errors<string>) => Object.values(e).some(Boolean)

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO -> "YYYY-MM-DD" in local time, for <input type="date">. */
export function toDateInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO -> "HH:MM" in local time, for <input type="time">. */
export function toTimeInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Local "YYYY-MM-DD" + "HH:MM" -> ISO, or null when either is missing or invalid. */
export function fromInputs(date: string, time: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const tm = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!dm || !tm) return null
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]))
  if (d.getMonth() !== Number(dm[2]) - 1) return null // e.g. 31 February
  return d.toISOString()
}

const TITLE_MAX = 120
function titleError(title: string): string | undefined {
  if (!title.trim()) return 'Give it a title.'
  if (title.trim().length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`
  return undefined
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// ---------- module ----------

export interface ModuleDraft {
  title: string
  description: string
  opensDate: string
  closesDate: string
}

export function moduleToDraft(m: CourseModule): ModuleDraft {
  return {
    title: m.title,
    description: m.description ?? '',
    opensDate: toDateInput(m.opensAt),
    closesDate: toDateInput(m.closesAt),
  }
}

export function validateModule(d: ModuleDraft): Errors<keyof ModuleDraft> {
  const e: Errors<keyof ModuleDraft> = { title: titleError(d.title) }
  const opens = fromInputs(d.opensDate, '00:00')
  const closes = fromInputs(d.closesDate, '23:59')
  if (!opens) e.opensDate = 'Pick the day the module opens.'
  if (!closes) e.closesDate = 'Pick the day the module closes.'
  if (opens && closes && closes <= opens) e.closesDate = 'The module must close after it opens.'
  return e
}

/** A module opens at the start of its first day and closes at the end of its last day. */
export function draftToModulePatch(d: ModuleDraft) {
  return {
    title: d.title.trim(),
    description: d.description.trim() || undefined,
    opensAt: fromInputs(d.opensDate, '00:00') ?? undefined,
    closesAt: fromInputs(d.closesDate, '23:59') ?? undefined,
  }
}

// ---------- material ----------

export const MATERIAL_KINDS: { value: ResourceItem['kind']; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'pptx', label: 'Slides (PPTX)' },
  { value: 'md', label: 'Notes (Markdown)' },
  { value: 'zip', label: 'Archive (ZIP)' },
  { value: 'link', label: 'Link' },
]

export interface MaterialDraft {
  title: string
  kind: ResourceItem['kind']
  description: string
  url: string
  /** The chosen file, or the one already saved. */
  file?: { name: string; sizeBytes: number }
  /** The backend's id of the file already saved. */
  fileId?: string
  /** The file the lecturer just picked; uploaded when the material is saved. */
  upload?: File
}

export function materialToDraft(r?: ResourceItem): MaterialDraft {
  return {
    title: r?.title ?? '',
    kind: r?.kind ?? 'pdf',
    description: r?.description ?? '',
    url: r?.url ?? '',
    file: r?.file,
    ...(r?.fileId ? { fileId: r.fileId } : {}),
  }
}

export function validateMaterial(d: MaterialDraft): Errors<'title' | 'url' | 'file'> {
  const e: Errors<'title' | 'url' | 'file'> = { title: titleError(d.title) }
  if (d.kind === 'link') {
    if (!d.url.trim()) e.url = 'Paste the link.'
    else if (!isHttpUrl(d.url)) e.url = 'Use a full link that starts with http:// or https://'
  } else if (!d.file) {
    e.file = 'Choose a file to upload.'
  }
  return e
}

export function draftToMaterial(d: MaterialDraft, moduleId: string, id: string): ResourceItem {
  const isLink = d.kind === 'link'
  return {
    id,
    moduleId,
    type: 'resource',
    title: d.title.trim(),
    kind: d.kind,
    description: d.description.trim() || undefined,
    url: isLink ? d.url.trim() : undefined,
    file: isLink ? undefined : d.file,
    ...(!isLink && d.fileId ? { fileId: d.fileId } : {}),
    ...(!isLink && d.upload ? { upload: d.upload } : {}),
  }
}

// ---------- task ----------

export interface TaskDraft {
  title: string
  description: string
  /** One requirement per line. */
  requirements: string
  dueDate: string
  dueTime: string
}

/** A new task is due at 18:00 on the last day of the module by default. */
export function taskToDraft(a: AssignmentItem | undefined, module: CourseModule): TaskDraft {
  if (a) {
    return {
      title: a.title,
      description: a.description ?? '',
      requirements: (a.requirements ?? []).join('\n'),
      dueDate: toDateInput(a.dueAt),
      dueTime: toTimeInput(a.dueAt),
    }
  }
  return { title: '', description: '', requirements: '', dueDate: toDateInput(module.closesAt), dueTime: '18:00' }
}

export function validateTask(d: TaskDraft): Errors<'title' | 'due'> {
  const e: Errors<'title' | 'due'> = { title: titleError(d.title) }
  if (!fromInputs(d.dueDate, d.dueTime)) e.due = 'Pick a due date and time.'
  return e
}

/** Not errors, just things worth a second look. */
export function taskWarnings(d: TaskDraft, module: CourseModule, now: Date): string[] {
  const due = fromInputs(d.dueDate, d.dueTime)
  if (!due) return []
  const out: string[] = []
  if (new Date(due) < now) out.push('This deadline has already passed, so students will see the task as overdue.')
  if (module.opensAt && due < module.opensAt) out.push('The task is due before the module opens.')
  if (module.closesAt && due > module.closesAt) out.push('The task is due after the module closes.')
  return out
}

export const splitLines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export function draftToTask(d: TaskDraft, moduleId: string, id: string): AssignmentItem {
  const requirements = splitLines(d.requirements)
  return {
    id,
    moduleId,
    type: 'assignment',
    title: d.title.trim(),
    description: d.description.trim() || undefined,
    requirements: requirements.length ? requirements : undefined,
    dueAt: fromInputs(d.dueDate, d.dueTime)!,
  }
}

// ---------- quiz ----------

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 4

export interface QuestionDraft {
  id: string
  prompt: string
  options: string[]
  correct: number | null
}

export interface QuizDraft {
  title: string
  description: string
  dueDate: string
  dueTime: string
  questions: QuestionDraft[]
}

export const emptyQuestion = (id: string): QuestionDraft => ({ id, prompt: '', options: ['', ''], correct: null })

export function quizToDraft(q: QuizItem | undefined, newQuestionId: () => string): QuizDraft {
  if (!q) return { title: '', description: '', dueDate: '', dueTime: '', questions: [emptyQuestion(newQuestionId())] }
  return {
    title: q.title,
    description: q.description ?? '',
    dueDate: toDateInput(q.dueAt),
    dueTime: toTimeInput(q.dueAt),
    questions: (q.questions ?? []).map((x) => ({ id: x.id, prompt: x.prompt, options: [...x.options], correct: x.correct ?? null })),
  }
}

export interface QuizErrors {
  title?: string
  due?: string
  questions?: string
  /** Per question, by id. */
  byQuestion: Record<string, string | undefined>
}

export function validateQuiz(d: QuizDraft): QuizErrors {
  const e: QuizErrors = { title: titleError(d.title), byQuestion: {} }
  // the due date is optional, but if one part is filled in both must be
  if ((d.dueDate || d.dueTime) && !fromInputs(d.dueDate, d.dueTime)) e.due = 'Pick both a date and a time, or leave both empty.'
  if (d.questions.length === 0) e.questions = 'Add at least one question.'
  for (const q of d.questions) {
    const filled = q.options.filter((o) => o.trim()).length
    let msg: string | undefined
    if (!q.prompt.trim()) msg = 'Write the question.'
    else if (filled < MIN_OPTIONS) msg = `Give at least ${MIN_OPTIONS} answers.`
    else if (q.options.some((o) => !o.trim())) msg = 'Fill in every answer, or remove the empty one.'
    else if (q.correct === null || !q.options[q.correct]?.trim()) msg = 'Mark the right answer.'
    e.byQuestion[q.id] = msg
  }
  return e
}

export const quizHasErrors = (e: QuizErrors) =>
  Boolean(e.title || e.due || e.questions) || Object.values(e.byQuestion).some(Boolean)

export function draftToQuiz(d: QuizDraft, moduleId: string, id: string): QuizItem {
  const questions: QuizQuestion[] = d.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt.trim(),
    options: q.options.map((o) => o.trim()),
    correct: q.correct ?? undefined,
  }))
  return {
    id,
    moduleId,
    type: 'quiz',
    title: d.title.trim(),
    description: d.description.trim() || undefined,
    dueAt: fromInputs(d.dueDate, d.dueTime) ?? undefined,
    questions,
  }
}

// ---------- calendar event ----------

export type EditableKind = 'lecture' | 'meeting' | 'off-campus'
export const EVENT_KINDS: { value: EditableKind; label: string }[] = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'off-campus', label: 'Off-campus day' },
]

export interface EventDraft {
  title: string
  kind: EditableKind
  date: string
  allDay: boolean
  start: string
  end: string
  location: string
  description: string
  /** Optional: the module this lecture belongs to (students get a link to its materials). */
  moduleId: string
}

export function eventToDraft(e: CalendarEvent | undefined, dayKey: string): EventDraft {
  if (!e) {
    return { title: '', kind: 'lecture', date: dayKey, allDay: false, start: '10:00', end: '12:00', location: '', description: '', moduleId: '' }
  }
  return {
    title: e.title,
    kind: (e.kind === 'lecture' || e.kind === 'meeting' || e.kind === 'off-campus' ? e.kind : 'lecture') as EditableKind,
    date: toDateInput(e.startsAt),
    allDay: Boolean(e.allDay),
    start: e.allDay ? '10:00' : toTimeInput(e.startsAt),
    end: e.allDay ? '12:00' : toTimeInput(e.endsAt),
    location: e.location ?? '',
    description: e.description ?? '',
    moduleId: e.moduleId ?? '',
  }
}

export function validateEvent(d: EventDraft): Errors<'title' | 'date' | 'time'> {
  const e: Errors<'title' | 'date' | 'time'> = { title: titleError(d.title) }
  if (!fromInputs(d.date, '00:00')) e.date = 'Pick a day.'
  else if (!d.allDay) {
    const start = fromInputs(d.date, d.start)
    const end = fromInputs(d.date, d.end)
    if (!start || !end) e.time = 'Pick a start and an end time.'
    else if (end <= start) e.time = 'The end time must be after the start time.'
  }
  return e
}

export function draftToEvent(d: EventDraft, id: string): CalendarEvent {
  return {
    id,
    title: d.title.trim(),
    kind: d.kind,
    startsAt: fromInputs(d.date, d.allDay ? '00:00' : d.start)!,
    endsAt: fromInputs(d.date, d.allDay ? '23:59' : d.end)!,
    allDay: d.allDay || undefined,
    location: d.location.trim() || undefined,
    description: d.description.trim() || undefined,
    moduleId: d.moduleId || undefined,
  }
}

/** Only events that come from the events API can be edited; deadlines and 1:1 times are derived. */
export function isEditableEvent(e: CalendarEvent): boolean {
  return (e.kind === 'lecture' || e.kind === 'meeting' || e.kind === 'off-campus') && !e.id.startsWith('slot')
}
