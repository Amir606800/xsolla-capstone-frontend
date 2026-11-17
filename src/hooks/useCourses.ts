import { useContext, useEffect } from 'react'
import { CoursesContext } from '../context/courses'

/**
 * The course. While the calling screen is open the course keeps itself up to date; `passive: true` is for the parts of the
 * shell that are always there (the sidebar, the search): they read the course but do not keep it refreshing by themselves.
 */
export function useCourses({ passive = false }: { passive?: boolean } = {}) {
  const ctx = useContext(CoursesContext)
  const watch = ctx?.watch
  useEffect(() => (passive ? undefined : watch?.()), [passive, watch])
  if (!ctx) throw new Error('useCourses must be used inside <CoursesProvider>')
  return ctx
}
