import type { ContentItem } from '../types/course'
import type { PlannedModule } from './moduleTemplate'

export interface ImportOps {
  createModule: (patch: { title: string; description?: string; opensAt: string; closesAt: string }) => Promise<string>
  writeItem: (item: ContentItem) => Promise<void>
}

export interface ImportResult {
  modules: number
  tasks: number
  links: number
  quizzes: number
  /** Items the server did not take (for example quizzes), each in words. */
  skipped: string[]
  /** Set when a module could not be made: the import stopped there and what came before stays. */
  stoppedAt?: { title: string; reason: string }
}

const reasonOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/**
 * Makes the planned modules one after the other with their items. A module that cannot be made stops the import
 * (nothing after it would belong anywhere); an item that cannot be saved is reported and the rest carry on.
 * New items get app-made ids, which is how the API tells "create" from "change".
 */
export async function runImport(
  plan: PlannedModule[],
  ops: ImportOps,
  newId: (prefix: string) => string,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<ImportResult> {
  const result: ImportResult = { modules: 0, tasks: 0, links: 0, quizzes: 0, skipped: [] }
  for (const [n, m] of plan.entries()) {
    onProgress(n, plan.length)
    let moduleId: string
    try {
      moduleId = await ops.createModule({ title: m.title, ...(m.description ? { description: m.description } : {}), opensAt: m.opensAt, closesAt: m.closesAt })
    } catch (e) {
      result.stoppedAt = { title: m.title, reason: reasonOf(e) }
      return result
    }
    result.modules++
    for (const item of m.items) {
      try {
        await ops.writeItem({ ...item, id: newId(item.type), moduleId } as ContentItem)
        if (item.type === 'assignment') result.tasks++
        else if (item.type === 'quiz') result.quizzes++
        else result.links++
      } catch (e) {
        result.skipped.push(`"${item.title}" in "${m.title}": ${reasonOf(e)}`)
      }
    }
  }
  onProgress(plan.length, plan.length)
  return result
}
