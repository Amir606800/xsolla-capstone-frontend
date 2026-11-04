import { createContext } from 'react'
import type { CourseModule } from '../types/course'

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface CoursesContextValue {
  status: LoadStatus
  modules: CourseModule[]
  /** When the data was fetched; used as "now" for deadline maths so renders stay pure. */
  now: Date
  reload: () => void
}

export const CoursesContext = createContext<CoursesContextValue | null>(null)
