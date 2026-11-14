import type { Attendee, CalendarEvent, EventKind } from '../types/calendar'
import type { AssignmentItem, ContentItem, CourseModule, QuizItem, ResourceItem, Submission, SubmissionVersion } from '../types/course'
import type { WeeklyStanding } from '../types/standing'
import { orderByOpening } from '../utils/progress'
import { parseStandingLevel } from '../utils/standing'
import type { ApiAttendee, ApiContentItem, ApiEvent, ApiGoogleCalendarEvent, ApiModule, ApiQuiz, ApiSubmission, ApiWeeklyStanding } from './types'

// ---------- content ----------

const RESOURCE_KINDS: Record<string, ResourceItem['kind']> = { pdf: 'pdf', pptx: 'pptx', md: 'md', zip: 'zip' }

/** The material kind from the file name; anything else is shown as a plain file (pdf icon). */
function resourceKind(title: string): ResourceItem['kind'] {
  const ext = title.split('.').pop()?.toLowerCase() ?? ''
  return RESOURCE_KINDS[ext] ?? 'pdf'
}

/**
 * The backend has no field for a task's "what to hand in" list, so it travels inside the
 * description after this marker and is split out again when read.
 */
const REQUIREMENTS_MARKER = '\n\nWhat to hand in:\n'

export function joinDescription(description: string | undefined, requirements: string[] | undefined): string {
  const body = description?.trim() ?? ''
  if (!requirements?.length) return body
  return `${body}${REQUIREMENTS_MARKER}${requirements.map((r) => `- ${r}`).join('\n')}`
}

export function splitDescription(text: string | null | undefined): { description?: string; requirements?: string[] } {
  const raw = text ?? ''
  const at = raw.indexOf(REQUIREMENTS_MARKER)
  if (at < 0) return raw.trim() ? { description: raw.trim() } : {}
  const description = raw.slice(0, at).trim()
  const requirements = raw
    .slice(at + REQUIREMENTS_MARKER.length)
    .split('\n')
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean)
  return { ...(description ? { description } : {}), ...(requirements.length ? { requirements } : {}) }
}

function mapVersion(s: Omit<ApiSubmission, 'history'>): SubmissionVersion {
  return {
    submittedAt: s.submitted_at,
    ...(s.text_body ? { textBody: s.text_body } : {}),
    ...(s.files?.length ? { files: s.files.map((f) => ({ id: String(f.id), name: f.original_name, sizeBytes: f.size_bytes })) } : {}),
  }
}

export function mapSubmission(s: ApiSubmission): Submission {
  const history = (s.history ?? []).map(mapVersion).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  return {
    ...mapVersion(s),
    ...(s.feedback ? { feedback: s.feedback } : {}),
    // null (not graded) -> undefined so `gradedAt !== undefined` means "graded"
    ...(s.graded_at ? { gradedAt: s.graded_at } : {}),
    ...(history.length ? { history } : {}),
  }
}

/** Items come as a flat list; children (only if parents ever return) are flattened in place. */
function flatten(items: ApiContentItem[]): ApiContentItem[] {
  return items.flatMap((i) => [i, ...flatten(i.children ?? [])])
}

export function mapContentItems(
  items: ApiContentItem[],
  moduleId: string,
  submissions: Record<string, ApiSubmission | undefined> = {},
  opts: { includeHidden?: boolean } = {},
): ContentItem[] {
  const out: ContentItem[] = []
  const ordered = flatten(items)
    .filter((i) => opts.includeHidden || i.is_visible)
    .sort((a, b) => a.position - b.position || Number(a.id) - Number(b.id))

  for (const node of ordered) {
    const id = String(node.id)
    const text = splitDescription(node.description)
    const hidden = node.is_visible ? {} : { hidden: true }
    if (node.type === 'file') {
      const r: ResourceItem = {
        id,
        moduleId,
        type: 'resource',
        title: node.title,
        kind: resourceKind(node.title),
        ...hidden,
        ...(text.description ? { description: text.description } : {}),
        ...(node.file_id != null ? { fileId: String(node.file_id) } : {}),
      }
      out.push(r)
    } else if (node.type === 'link') {
      // a link the server lost its address for cannot be opened, so it is not shown
      if (!node.url) continue
      out.push({
        id,
        moduleId,
        type: 'resource',
        title: node.title,
        kind: 'link',
        url: node.url,
        ...hidden,
        ...(text.description ? { description: text.description } : {}),
      })
    } else if (node.type === 'assignment') {
      // the backend requires due_at on create; an item without one cannot be shown on a timeline
      if (!node.due_at) continue
      const sub = submissions[id]
      const a: AssignmentItem = {
        id,
        moduleId,
        type: 'assignment',
        title: node.title,
        ...hidden,
        ...text,
        dueAt: node.due_at,
        ...(sub ? { submission: mapSubmission(sub) } : {}),
      }
      out.push(a)
    }
  }
  return out
}

export const toQuizDomainId = (id: number | string) => `quiz:${id}`

export const parseQuizServerId = (id: string): string | null => /^quiz:(\d+)$/.exec(id)?.[1] ?? null

export function mapQuiz(q: ApiQuiz): QuizItem {
  const quizId = toQuizDomainId(q.id)
  return {
    id: quizId,
    moduleId: String(q.module_id),
    type: 'quiz',
    title: q.title,
    ...(q.description ? { description: q.description } : {}),
    ...(q.due_at ? { dueAt: q.due_at } : {}),
    status: q.status,
    ...(q.error_message ? { errorMessage: q.error_message } : {}),
    isAiGenerated: q.is_ai_generated,
    ...(q.source_content_item_id != null ? { sourceContentItemId: String(q.source_content_item_id) } : {}),
    createdBy: Number(q.created_by),
    questions: (q.questions ?? []).map((qq) => ({
      id: String(qq.id),
      prompt: qq.prompt,
      options: qq.options,
      ...(qq.correct !== undefined ? { correct: qq.correct } : {}),
    })),
    ...(q.attempt
      ? {
          attempt: {
            id: String(q.attempt.id),
            quizId,
            answers: q.attempt.answers,
            score: q.attempt.score,
            total: q.attempt.total,
            submittedAt: q.attempt.submitted_at,
          },
        }
      : {}),
  }
}

function lecturerFields(m: ApiModule): { lecturerIds?: number[]; createdBy?: number } {
  const ids = m.lecturer_ids ?? (m.lecturer_id != null ? [m.lecturer_id] : [])
  const lecturers = [...new Set(ids.map(Number))]
  return lecturers.length ? { lecturerIds: lecturers, createdBy: lecturers[0] } : {}
}

/**
 * GET /modules + each module's content items (and quizzes) -> CourseModule[].
 * - The backend has no week number: modules are ordered by when they open (then by creation) and numbered 1, 2, 3, ...
 * - Week dates (`opens_at` / `closes_at`) are read when the server sends them; it does not store them yet, so
 *   until then nothing is locked for students.
 */
export function mapModules(
  modules: ApiModule[],
  itemsByModule: Record<string, ApiContentItem[]>,
  submissions: Record<string, ApiSubmission | undefined> = {},
  opts: { includeHidden?: boolean } = {},
  quizzesByModule: Record<string, ApiQuiz[]> = {},
): CourseModule[] {
  // the number of a week is its place in the order the weeks open, not the order an admin typed them in
  return orderByOpening(modules.map((m) => ({ ...m, id: String(m.id), opensAt: m.opens_at ?? undefined, createdAt: m.created_at })))
    .map((m, i) => {
      const id = String(m.id)
      const contentItems = mapContentItems(itemsByModule[id] ?? [], id, submissions, opts)
      const quizItems = (quizzesByModule[id] ?? []).map(mapQuiz)
      return {
        id,
        position: i + 1,
        title: m.title,
        ...(m.description ? { description: m.description } : {}),
        // the lecturer of the week is the ASSIGNED one (`lecturer_id`). Who made the module (`created_by`) is always an
        // admin, so it says nothing about the lecturer and is not shown anywhere. (`createdBy` is the app's name for
        // "the week's lecturer": see utils/content isAssignedTo.)
        ...lecturerFields(m),
        ...(m.opens_at ? { opensAt: m.opens_at } : {}),
        ...(m.closes_at ? { closesAt: m.closes_at } : {}),
        createdAt: m.created_at,
        items: [...contentItems, ...quizItems],
      }
    })
}

export function quizToApi(q: QuizItem) {
  return {
    title: q.title,
    description: q.description ?? '',
    due_at: q.dueAt ?? null,
    questions: (q.questions ?? []).map((qq) => ({
      prompt: qq.prompt,
      options: qq.options,
      correct: qq.correct ?? 0,
    })),
  }
}

/** A task as the backend stores it (POST /modules/:id/content-items). Requirements go into the description. */
export function taskToApi(t: AssignmentItem) {
  return {
    type: 'assignment' as const,
    title: t.title,
    description: joinDescription(t.description, t.requirements),
    due_at: t.dueAt,
    // the program grades weeks, not tasks; the backend still has the column
    max_points: 0,
    is_visible: true,
  }
}

// ---------- calendar ----------

const EVENT_KINDS: readonly EventKind[] = ['lecture', 'meeting', 'off-campus']

/** GET /events row -> calendar event. Unknown kinds are shown as a meeting rather than dropped. */
export function mapEvent(e: ApiEvent): CalendarEvent {
  const kind = (EVENT_KINDS as readonly string[]).includes(e.kind) ? (e.kind as EventKind) : 'meeting'
  return {
    id: String(e.id),
    title: e.title,
    kind,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    ...(e.all_day ? { allDay: true } : {}),
    ...(e.location ? { location: e.location } : {}),
    ...(e.description ? { description: e.description } : {}),
    ...(e.meeting_url ? { meetingUrl: e.meeting_url } : {}),
    ...(e.module_id != null ? { moduleId: String(e.module_id) } : {}),
    ...(e.google_event_id ? { googleEventId: e.google_event_id } : {}),
    ...attendeesField(e.attendees),
  }
}

/** `attendees` only when there are some. */
export function attendeesField(list: ApiAttendee[] | null | undefined): { attendees?: Attendee[] } {
  const attendees = (list ?? []).map((a) => ({ id: Number(a.id), name: a.name, email: a.email ?? '', ...(a.avatar_url ? { avatarUrl: a.avatar_url } : {}) }))
  return attendees.length ? { attendees } : {}
}

/** A local date `YYYY-MM-DD` at the given time. Never `new Date('YYYY-MM-DD')`: that is UTC and can land on the day before. */
function localDay(day: string, end: boolean): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number)
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)).toISOString()
}

/**
 * One event of the person's own Google Calendar -> a read-only calendar event. All-day events come as plain dates (the last
 * day included) and run from the start of the first day to the end of the last. Ids are prefixed so they never meet an LMS id.
 */
export function mapGoogleEvent(g: ApiGoogleCalendarEvent): CalendarEvent {
  const allDay = !!g.all_day
  return {
    id: `google-${g.id}`,
    title: g.title?.trim() || '(No title)',
    kind: 'google',
    source: 'google',
    startsAt: allDay ? localDay(g.starts_at, false) : g.starts_at,
    endsAt: allDay ? localDay(g.ends_at || g.starts_at, true) : g.ends_at,
    ...(allDay ? { allDay: true } : {}),
    ...(g.location ? { location: g.location } : {}),
    ...(g.description ? { description: g.description } : {}),
    ...(g.meeting_url && /^https?:\/\//.test(g.meeting_url) ? { meetingUrl: g.meeting_url } : {}),
    ...(g.html_link && g.html_link.startsWith('https://') ? { htmlLink: g.html_link } : {}),
    googleEventId: g.id,
  }
}

/** Calendar event -> POST /events / PATCH /events/:id body. */
export function eventToApi(e: CalendarEvent) {
  return {
    title: e.title,
    kind: e.kind,
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    all_day: !!e.allDay,
    // always sent, empty when there is none: on an edit that is how a place or description is taken away
    location: e.location ?? '',
    description: e.description ?? '',
    // empty string, not null: the server keeps the link on null and clears it on ""
    meeting_url: e.meetingUrl ?? '',
    ...(e.moduleId && /^\d+$/.test(e.moduleId) ? { module_id: Number(e.moduleId) } : {}),
  }
}

// ---------- weekly grades ----------

/** A weekly grade from the backend. A row with a level we do not know is dropped rather than guessed. */
export function mapWeeklyStandings(rows: ApiWeeklyStanding[]): WeeklyStanding[] {
  const out: WeeklyStanding[] = []
  for (const r of rows) {
    const level = parseStandingLevel(r.level)
    if (!level) continue
    out.push({ week: r.week, level, assessedAt: r.assessed_at, ...(r.note ? { note: r.note } : {}) })
  }
  return out.sort((a, b) => a.week - b.week)
}

/** True for ids the backend gave out (numbers); the app makes up non-numeric ids for new things. */
export const isServerId = (id: string) => /^\d+$/.test(id)
