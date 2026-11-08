import type { CalendarEvent, EventKind } from '../types/calendar'
import type { AssignmentItem, ContentItem, CourseModule, ResourceItem, Submission, SubmissionVersion } from '../types/course'
import type { WeeklyStanding } from '../types/standing'
import { parseStandingLevel } from '../utils/standing'
import type { ApiContentItem, ApiEvent, ApiModule, ApiSubmission, ApiWeeklyStanding } from './types'

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

/**
 * GET /modules + each module's content items -> CourseModule[].
 * - The backend has no week number: modules are ordered by creation and numbered 1, 2, 3, ...
 * - It has no open/close dates either, so nothing is locked for students (opensAt/closesAt unset).
 */
export function mapModules(
  modules: ApiModule[],
  itemsByModule: Record<string, ApiContentItem[]>,
  submissions: Record<string, ApiSubmission | undefined> = {},
  opts: { includeHidden?: boolean } = {},
): CourseModule[] {
  return [...modules]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || Number(a.id) - Number(b.id))
    .map((m, i) => {
      const id = String(m.id)
      return {
        id,
        position: i + 1,
        title: m.title,
        ...(m.description ? { description: m.description } : {}),
        ...(m.created_by != null ? { createdBy: Number(m.created_by) } : {}),
        createdAt: m.created_at,
        items: mapContentItems(itemsByModule[id] ?? [], id, submissions, opts),
      }
    })
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
    ...(e.module_id != null ? { moduleId: String(e.module_id) } : {}),
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
    ...(e.location ? { location: e.location } : {}),
    ...(e.description ? { description: e.description } : {}),
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
