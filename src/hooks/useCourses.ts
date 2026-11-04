import { useContext } from 'react'
import { CoursesContext } from '../context/courses'

export function useCourses() {
  const ctx = useContext(CoursesContext)
  if (!ctx) throw new Error('useCourses must be used inside <CoursesProvider>')
  return ctx
}
