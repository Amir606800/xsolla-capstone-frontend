import type { IconName } from '../components/Icon'
import type { NavGroup } from '../config/nav'
import type { CourseModule } from '../types/course'
import { assignmentsOf } from './progress'

export type SearchGroup = 'Pages' | 'Modules' | 'Assignments'

export interface SearchItem {
  id: string
  group: SearchGroup
  label: string
  /** Secondary text, e.g. the module an assignment belongs to. */
  hint?: string
  to: string
  icon: IconName
}

const GROUP_ORDER: SearchGroup[] = ['Pages', 'Modules', 'Assignments']

/**
 * Everything the search can open. Modules the viewer may not open yet (see
 * useModuleAccess) are left out completely - including their assignments - so
 * the search cannot reveal the content of a locked module.
 */
export function buildSearchItems(
  nav: NavGroup[],
  modules: CourseModule[],
  isLocked: (m: CourseModule) => boolean,
): SearchItem[] {
  const items: SearchItem[] = []

  for (const group of nav) {
    for (const n of group.items) {
      items.push({ id: `page:${n.to}`, group: 'Pages', label: n.label, to: n.to, icon: n.icon })
    }
  }

  for (const m of modules) {
    if (isLocked(m)) continue
    items.push({
      id: `module:${m.id}`,
      group: 'Modules',
      label: m.title,
      hint: `Module ${m.position}`,
      to: `/courses/${m.id}`,
      icon: 'courses',
    })
    for (const a of assignmentsOf(m)) {
      items.push({
        id: `assignment:${a.id}`,
        group: 'Assignments',
        label: a.title,
        hint: m.title,
        to: `/courses/${m.id}`,
        icon: 'tasks',
      })
    }
  }
  return items
}

/** Lower is better: 0 = label starts with the query, 1 = label contains it, 2 = only the hint matches. */
function rank(item: SearchItem, q: string): number {
  const label = item.label.toLowerCase()
  if (label.startsWith(q)) return 0
  if (label.includes(q)) return 1
  if (item.hint?.toLowerCase().includes(q)) return 2
  return -1
}

/**
 * No query: the pages and open modules (a quick launcher). With a query: every
 * match, best first, grouped Pages -> Modules -> Assignments.
 */
export function filterSearchItems(items: SearchItem[], query: string, limit = 30): SearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items.filter((i) => i.group !== 'Assignments').slice(0, limit)

  return items
    .map((item, index) => ({ item, index, r: rank(item, q) }))
    .filter((x) => x.r >= 0)
    .sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.item.group) - GROUP_ORDER.indexOf(b.item.group) || a.r - b.r || a.index - b.index,
    )
    .slice(0, limit)
    .map((x) => x.item)
}
