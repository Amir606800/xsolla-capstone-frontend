import { createContext } from 'react'
import type { ModulePatch, SubmitPayload } from '../api/courses'
import type { ContentItem, CourseModule } from '../types/course'

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface CoursesContextValue {
  status: LoadStatus
  modules: CourseModule[]
  /** When the data was fetched; used as "now" for deadline maths so renders stay pure. */
  now: Date
  reload: () => void
  /** Submits (or resubmits) work and updates the shared course state. Rejects on failure. */
  submitAssignment: (assignmentId: string, payload: SubmitPayload) => Promise<void>
  /** Lecturer authoring (teachers and admins only). Each rejects on failure. Resolves with a warning when part was not kept. */
  saveModule: (moduleId: string, patch: ModulePatch) => Promise<string | undefined>
  /** Creates the item, or replaces the one with the same id. */
  saveItem: (item: ContentItem) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
  /** Makes someone the lecturer of a week, or takes the lecturer off it with null (admins). */
  assignLecturer: (moduleId: string, lecturerId: number | null) => Promise<void>
  /** The whole module with everything in it (admins). */
  deleteModule: (moduleId: string) => Promise<void>
  /** A new module after the last one; resolves with its id, and a warning when part was not kept. */
  createModule: (patch: ModulePatch & { title: string }) => Promise<{ id: string; warning?: string }>
}

export const CoursesContext = createContext<CoursesContextValue | null>(null)
