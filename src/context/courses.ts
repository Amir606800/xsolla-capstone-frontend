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
  /** Lecturer authoring (teachers and admins only). Each rejects on failure. */
  saveModule: (moduleId: string, patch: ModulePatch) => Promise<void>
  /** Creates the item, or replaces the one with the same id. */
  saveItem: (item: ContentItem) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
  /** The whole module with everything in it (admins). */
  deleteModule: (moduleId: string) => Promise<void>
  /** A new module after the last one; resolves with its id. */
  createModule: (patch: ModulePatch & { title: string }) => Promise<string>
}

export const CoursesContext = createContext<CoursesContextValue | null>(null)
