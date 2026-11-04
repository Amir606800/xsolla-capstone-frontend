import { createContext } from 'react'
import type { SubmitPayload } from '../api/courses'
import type { CourseModule } from '../types/course'

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface CoursesContextValue {
  status: LoadStatus
  modules: CourseModule[]
  /** When the data was fetched; used as "now" for deadline maths so renders stay pure. */
  now: Date
  reload: () => void
  /** Submits (or resubmits) work and updates the shared course state. Rejects on failure. */
  submitAssignment: (assignmentId: string, payload: SubmitPayload) => Promise<void>
}

export const CoursesContext = createContext<CoursesContextValue | null>(null)
