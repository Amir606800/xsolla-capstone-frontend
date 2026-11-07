import type { ContentItem, CourseModule } from '../types/course'
import { MATERIAL_KINDS } from './authoring'
import { contentCounts } from './content'
import { formatDateTime, formatShortDate } from './date'

/** Shared text for the admin's Modules pages. */

export const ITEM_TYPE_LABEL: Record<ContentItem['type'], string> = { assignment: 'Task', resource: 'Resource', quiz: 'Quiz' }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const kindLabel = (kind: string) => MATERIAL_KINDS.find((k) => k.value === kind)?.label ?? kind

/** "3 tasks · 2 resources · 1 quiz" */
export function contentsLine(m: CourseModule): string {
  const c = contentCounts(m)
  return `${plural(c.tasks, 'task')} · ${plural(c.materials, 'resource')} · ${plural(c.quizzes, 'quiz', 'quizzes')}`
}

/** "Nov 2 – Nov 8", or that the week has no dates. */
export function moduleDates(m: CourseModule): string {
  return m.opensAt && m.closesAt ? `${formatShortDate(m.opensAt)} – ${formatShortDate(m.closesAt)}` : 'No dates'
}

/** One line about an item for the table: when it is due, what file or link, how many questions. */
export function itemSummary(item: ContentItem): string {
  switch (item.type) {
    case 'assignment': {
      const reqs = item.requirements?.length ?? 0
      return `Due ${formatDateTime(item.dueAt)}${reqs ? ` · ${plural(reqs, 'requirement')}` : ''}`
    }
    case 'resource': {
      if (item.kind === 'link') return item.url ? `Link · ${hostOf(item.url)}` : 'Link'
      return [kindLabel(item.kind), item.file?.name].filter(Boolean).join(' · ')
    }
    case 'quiz': {
      const n = item.questions?.length ?? 0
      return `${plural(n, 'question')}${item.dueAt ? ` · due ${formatShortDate(item.dueAt)}` : ''}`
    }
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Who wrote an item: its own author when known, otherwise the module's lecturer. */
export const itemAuthor = (item: ContentItem, module: CourseModule): number | undefined => item.createdBy ?? module.createdBy

/** An edited item keeps who wrote it and whether it is hidden: the forms do not know about those. */
export function keepMeta<T extends ContentItem>(current: ContentItem | undefined, next: T): T {
  if (!current) return next
  return {
    ...next,
    ...(current.createdBy !== undefined ? { createdBy: current.createdBy } : {}),
    ...(current.hidden ? { hidden: true } : {}),
  }
}

/** What else goes when a module is deleted. */
export function moduleDeleteWarning(m: CourseModule): string {
  const c = contentCounts(m)
  const total = c.tasks + c.materials + c.quizzes
  if (total === 0) return 'It has no content.'
  return `Its ${contentsLine(m)} are deleted with it. Work students already handed in is kept.`
}
