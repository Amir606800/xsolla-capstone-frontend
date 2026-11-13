import type { AssignmentItem, ContentItem, CourseModule, QuizItem, QuizQuestion, ResourceItem } from '../types/course'

/**
 * A module template: the modules of a course as a file, so the next group gets them without typing everything again.
 * Dates are stored as "N days after week 1 opens" plus a time of day, so importing asks only for the day week 1 starts.
 * Not in the file: uploaded files (they are binary and stay on the server), who the lecturer is, students' work.
 */
export const TEMPLATE_FORMAT = 'xsolla-lms-module-template'
export const TEMPLATE_VERSION = 1
export const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024

/** A moment relative to the template's start: whole days after the first module's opening day, and "HH:MM". */
export interface When {
  day: number
  time: string
}

export type TemplateItem =
  | { type: 'task'; title: string; description?: string; requirements?: string[]; due: When }
  | { type: 'link'; title: string; description?: string; url: string }
  | { type: 'quiz'; title: string; description?: string; due?: When; questions: { prompt: string; options: string[]; correct?: number }[] }

export interface TemplateModule {
  title: string
  description?: string
  opens: When
  closes: When
  items: TemplateItem[]
}

export interface ModuleTemplate {
  format: typeof TEMPLATE_FORMAT
  version: typeof TEMPLATE_VERSION
  exportedAt: string
  modules: TemplateModule[]
  /** What could not go into the file, so the admin is not surprised: uploaded files and modules without dates. */
  left_out?: { files: number; modulesWithoutDates: number }
}

const pad = (n: number) => String(n).padStart(2, '0')
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
/** Calendar days between two moments by their LOCAL dates (a clock change never makes a day 23 or 25 hours). */
const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)

function whenOf(iso: string, base: Date): When {
  const d = new Date(iso)
  return { day: dayNumber(d) - dayNumber(base), time: timeOf(d) }
}

/** The modules as a template, in the order they open. Modules without both dates cannot be placed and are left out. */
export function buildTemplate(modules: CourseModule[], now: Date = new Date()): ModuleTemplate {
  const dated = modules
    .filter((m): m is CourseModule & { opensAt: string; closesAt: string } => !!m.opensAt && !!m.closesAt)
    .sort((a, b) => a.position - b.position)
  const base = dated.length > 0 ? new Date(Math.min(...dated.map((m) => new Date(m.opensAt).getTime()))) : now
  let files = 0
  const out: TemplateModule[] = dated.map((m) => {
    const items: TemplateItem[] = []
    for (const i of m.items) {
      const description = 'description' in i && i.description ? { description: i.description } : {}
      if (i.type === 'assignment') {
        items.push({ type: 'task', title: i.title, ...description, ...(i.requirements?.length ? { requirements: i.requirements } : {}), due: whenOf(i.dueAt, base) })
      } else if (i.type === 'resource') {
        if (i.kind === 'link' && i.url) items.push({ type: 'link', title: i.title, ...description, url: i.url })
        else files++
      } else {
        items.push({
          type: 'quiz',
          title: i.title,
          ...description,
          ...(i.dueAt ? { due: whenOf(i.dueAt, base) } : {}),
          questions: (i.questions ?? []).map((q) => ({ prompt: q.prompt, options: q.options, ...(q.correct !== undefined ? { correct: q.correct } : {}) })),
        })
      }
    }
    return { title: m.title, ...(m.description ? { description: m.description } : {}), opens: whenOf(m.opensAt, base), closes: whenOf(m.closesAt, base), items }
  })
  return {
    format: TEMPLATE_FORMAT,
    version: TEMPLATE_VERSION,
    exportedAt: now.toISOString(),
    modules: out,
    left_out: { files, modulesWithoutDates: modules.length - dated.length },
  }
}

export const templateFileName = (now: Date = new Date()) => `module-template-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`

// ---------- reading a file ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 5000): v is string => typeof v === 'string' && v.length <= max
const isWhen = (v: unknown): v is When => isObj(v) && Number.isInteger(v.day) && Math.abs(v.day as number) < 3650 && typeof v.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)
const optStr = (v: unknown) => v === undefined || str(v)

function checkItem(i: unknown, at: string): string | null {
  if (!isObj(i)) return `${at} is not an item.`
  if (!str(i.title, 300) || !i.title.trim()) return `${at} has no title.`
  if (!optStr(i.description)) return `${at}: the description is not text.`
  if (i.type === 'task') {
    if (!isWhen(i.due)) return `${at} ("${i.title}") has no valid due date.`
    if (i.requirements !== undefined && !(Array.isArray(i.requirements) && i.requirements.every((r) => str(r, 500)))) return `${at}: the requirements are not a list of text.`
    return null
  }
  if (i.type === 'link') {
    if (!str(i.url, 2000) || !/^https?:\/\//i.test(i.url)) return `${at} ("${i.title}") needs a link that starts with http:// or https://.`
    return null
  }
  if (i.type === 'quiz') {
    if (i.due !== undefined && !isWhen(i.due)) return `${at} ("${i.title}") has an invalid due date.`
    if (!Array.isArray(i.questions)) return `${at} ("${i.title}") has no list of questions.`
    for (const q of i.questions) {
      if (!isObj(q) || !str(q.prompt) || !Array.isArray(q.options) || !q.options.every((o) => str(o, 500))) return `${at} ("${i.title}") has a question that is not valid.`
      if (q.correct !== undefined && !(Number.isInteger(q.correct) && (q.correct as number) >= 0 && (q.correct as number) < q.options.length)) return `${at} ("${i.title}") has a right answer that is not one of its options.`
    }
    return null
  }
  return `${at} has an unknown type.`
}

export type ParsedTemplate = { ok: true; template: ModuleTemplate } | { ok: false; error: string }

/** Reads and checks a template file's text. Anything wrong is reported in words; nothing is created from a bad file. */
export function parseTemplate(text: string): ParsedTemplate {
  if (text.length > MAX_TEMPLATE_BYTES) return { ok: false, error: 'This file is too big for a module template.' }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This is not a module template: the file is not valid JSON.' }
  }
  if (!isObj(data) || data.format !== TEMPLATE_FORMAT) return { ok: false, error: 'This is not a module template file made by this app.' }
  if (data.version !== TEMPLATE_VERSION) return { ok: false, error: `This template is version ${String(data.version)}; this app reads version ${TEMPLATE_VERSION}.` }
  if (!Array.isArray(data.modules) || data.modules.length === 0) return { ok: false, error: 'The template has no modules.' }
  if (data.modules.length > 60) return { ok: false, error: 'The template has too many modules (the most is 60).' }
  for (const [n, m] of data.modules.entries()) {
    const at = `Module ${n + 1}`
    if (!isObj(m) || !str(m.title, 200) || !m.title.trim()) return { ok: false, error: `${at} has no title.` }
    if (!optStr(m.description)) return { ok: false, error: `${at}: the description is not text.` }
    if (!isWhen(m.opens) || !isWhen(m.closes)) return { ok: false, error: `${at} ("${m.title}") needs an opening and a closing date.` }
    if (m.closes.day * 1440 + minutes(m.closes.time) <= m.opens.day * 1440 + minutes(m.opens.time)) return { ok: false, error: `${at} ("${m.title}") closes before it opens.` }
    if (!Array.isArray(m.items) || m.items.length > 200) return { ok: false, error: `${at} ("${m.title}") has no valid list of items.` }
    for (const [k, i] of m.items.entries()) {
      const problem = checkItem(i, `${at}, item ${k + 1}`)
      if (problem) return { ok: false, error: problem }
    }
  }
  return { ok: true, template: data as unknown as ModuleTemplate }
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

// ---------- turning a template into new modules ----------

/** A moment `when` after the day week 1 starts (`start` = "yyyy-mm-dd", local), as an ISO string. */
export function resolveWhen(when: When, start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  const [hh, mm] = when.time.split(':').map(Number)
  return new Date(y, m - 1, d + when.day, hh, mm).toISOString()
}

export interface PlannedModule {
  title: string
  description?: string
  opensAt: string
  closesAt: string
  items: Omit<ContentItem, 'id' | 'moduleId'>[]
}

type NoId<T> = T extends unknown ? Omit<T, 'id' | 'moduleId'> : never

/** The template with real dates for a group that starts on `start`. */
export function planImport(template: ModuleTemplate, start: string): PlannedModule[] {
  return template.modules.map((m) => ({
    title: m.title.trim(),
    ...(m.description ? { description: m.description } : {}),
    opensAt: resolveWhen(m.opens, start),
    closesAt: resolveWhen(m.closes, start),
    items: m.items.map((i): NoId<ContentItem> => {
      const description = i.description ? { description: i.description } : {}
      if (i.type === 'task') {
        return { type: 'assignment', title: i.title.trim(), ...description, ...(i.requirements?.length ? { requirements: i.requirements } : {}), dueAt: resolveWhen(i.due, start) } satisfies NoId<AssignmentItem>
      }
      if (i.type === 'link') return { type: 'resource', kind: 'link', title: i.title.trim(), ...description, url: i.url } satisfies NoId<ResourceItem>
      return {
        type: 'quiz',
        title: i.title.trim(),
        ...description,
        ...(i.due ? { dueAt: resolveWhen(i.due, start) } : {}),
        questions: i.questions.map((q, n): QuizQuestion => ({ id: `q${n + 1}`, prompt: q.prompt, options: q.options, ...(q.correct !== undefined ? { correct: q.correct } : {}) })),
      } satisfies NoId<QuizItem>
    }),
  }))
}

export interface TemplateCounts {
  modules: number
  tasks: number
  links: number
  quizzes: number
}

export function countTemplate(template: ModuleTemplate): TemplateCounts {
  const c: TemplateCounts = { modules: template.modules.length, tasks: 0, links: 0, quizzes: 0 }
  for (const m of template.modules) for (const i of m.items) c[i.type === 'task' ? 'tasks' : i.type === 'link' ? 'links' : 'quizzes']++
  return c
}
