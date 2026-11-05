import type { ContentItem, CourseModule, ResourceItem, Submission } from '../types/course'
import type { WeeklyStanding } from '../types/standing'
import { parseStandingLevel } from '../utils/standing'
import type { ApiContentItem, ApiFileItem, ApiSubmission, ApiWeeklyStanding } from './types'

const RESOURCE_KINDS: Record<string, ResourceItem['kind']> = {
  pdf: 'pdf',
  pptx: 'pptx',
  md: 'md',
  zip: 'zip',
}

function resourceKind(file: ApiFileItem): ResourceItem['kind'] {
  const ext = file.title.split('.').pop()?.toLowerCase() ?? ''
  return RESOURCE_KINDS[ext] ?? 'link'
}

export function mapSubmission(s: ApiSubmission): Submission {
  return {
    submittedAt: s.submitted_at,
    textBody: s.text_body ?? undefined,
    // null (not graded yet) -> undefined so `gradedAt !== undefined` means "graded"
    feedback: s.feedback ?? undefined,
    gradedAt: s.graded_at ?? undefined,
  }
}

/** Flattens a module's nested sections into one ordered list of domain items. */
function collectItems(
  nodes: ApiContentItem[],
  moduleId: string,
  submissions: Record<string, ApiSubmission | undefined>,
): ContentItem[] {
  const out: ContentItem[] = []
  const ordered = nodes.filter((n) => n.is_visible).sort((a, b) => a.position - b.position)

  for (const node of ordered) {
    const id = String(node.id)
    if (node.type === 'section') {
      out.push(...collectItems(node.children, moduleId, submissions))
    } else if (node.type === 'file') {
      out.push({
        id,
        moduleId,
        type: 'resource',
        title: node.title,
        kind: resourceKind(node),
        description: node.description ?? undefined,
      })
    } else {
      const sub = submissions[id]
      out.push({
        id,
        moduleId,
        type: 'assignment',
        title: node.title,
        description: node.description ?? undefined,
        dueAt: node.due_at,
        ...(sub ? { submission: mapSubmission(sub) } : {}),
      })
    }
  }
  return out
}

/**
 * GET /courses/:id/content-items (+ the student's submissions keyed by
 * assignment id) -> CourseModule[].
 *
 * - Each visible top-level `section` is one module (week), ordered by position.
 * - Nested sections inside a module are flattened into its item list.
 * - Top-level files/assignments that are not inside a section are ignored
 *   (a module is the unit the UI is built around).
 */
export function mapContentTree(
  tree: ApiContentItem[],
  submissionsByAssignment: Record<string, ApiSubmission | undefined> = {},
): CourseModule[] {
  return tree
    .filter((n) => n.type === 'section' && n.is_visible)
    .sort((a, b) => a.position - b.position)
    .map((section) => {
      const id = String(section.id)
      return {
        id,
        position: section.position,
        title: section.title,
        description: section.description ?? undefined,
        opensAt: section.type === 'section' ? (section.starts_at ?? undefined) : undefined,
        closesAt: section.type === 'section' ? (section.ends_at ?? undefined) : undefined,
        items: section.type === 'section' ? collectItems(section.children, id, submissionsByAssignment) : [],
      }
    })
}

/** A weekly rating from the backend. A row with a level we do not know is dropped rather than guessed. */
export function mapWeeklyStandings(rows: ApiWeeklyStanding[]): WeeklyStanding[] {
  const out: WeeklyStanding[] = []
  for (const r of rows) {
    const level = parseStandingLevel(r.level)
    if (!level) continue
    out.push({ week: r.week, level, assessedAt: r.assessed_at, ...(r.note ? { note: r.note } : {}) })
  }
  return out.sort((a, b) => a.week - b.week)
}
