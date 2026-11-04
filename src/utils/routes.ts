import type { CourseModule } from '../types/course'

/** Human-readable name of an in-app route, for messages like "Open Module 6: Go Basics?". */
export function describeRoute(link: string, modules: CourseModule[]): string {
  const path = link.split(/[?#]/)[0]
  if (path === '/calendar') return 'the Calendar'
  if (path === '/dashboard') return 'the Dashboard'
  if (path === '/courses') return 'My courses'

  const module = /^\/courses\/([^/]+)\/?$/.exec(path)
  if (module) {
    const found = modules.find((m) => m.id === module[1])
    return found ? `Module ${found.position}: ${found.title}` : 'a course page'
  }
  return 'another page'
}
