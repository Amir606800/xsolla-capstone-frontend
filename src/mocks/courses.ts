import type { AssignmentItem, CourseModule, ResourceItem, Submission } from '../types/course'

/**
 * Mock course: 12 modules (weeks). Dates are built relative to `now` so the
 * demo always looks "live": early modules are done, one has an overdue task,
 * the current one is in progress and the rest are upcoming.
 */

const DAY = 86_400_000
const iso = (now: Date, days: number) => new Date(now.getTime() + days * DAY).toISOString()

const TITLES = [
  'Onboarding & Git',
  'Web Fundamentals',
  'JavaScript',
  'TypeScript',
  'React',
  'Go Basics',
  'Databases & SQL',
  'REST APIs',
  'Docker',
  'Testing',
  'CI/CD',
  'Capstone',
]

const FEEDBACK = [
  'Clean structure. Watch naming and add edge-case tests.',
  'Good progress - the error handling needs more care.',
  'Nice work, readable and well organised.',
  'Solid solution. Try to split the larger functions.',
]

// task titles per module (1-3 each)
const TASKS: string[][] = [
  ['Git workflow', 'Team setup'],
  ['Landing page', 'CSS layout kata'],
  ['Algorithms set', 'DOM project', 'Async quiz-task'],
  ['Typed utils', 'Migrate a module'],
  ['Components', 'State management', 'Routing app'],
  ['CLI tool', 'HTTP server'],
  ['Schema design', 'Query practice'],
  ['API design', 'Auth service'],
  ['Dockerise an app', 'Compose stack'],
  ['Unit tests', 'E2E tests'],
  ['Pipeline', 'Deploy'],
  ['MVP', 'Final demo'],
]

export function buildMockModules(now: Date = new Date()): CourseModule[] {
  const currentIdx = 5 // module 6 is "this week"

  return TITLES.map((title, idx) => {
    const id = `m${idx + 1}`
    const weekOffset = (idx - currentIdx) * 7 // days from "now" to this module's deadlines

    const resource: ResourceItem = {
      id: `${id}-r1`,
      moduleId: id,
      type: 'resource',
      title: `${title} - slides`,
      kind: 'pdf',
    }

    const assignments = TASKS[idx].map((taskTitle, t): AssignmentItem => {
      const dueDays = weekOffset + 2 + t * 2
      const item: AssignmentItem = {
        id: `${id}-a${t + 1}`,
        moduleId: id,
        type: 'assignment',
        title: taskTitle,
        dueAt: iso(now, dueDays),
        maxPoints: 100,
      }

      let submission: Submission | undefined
      if (idx < currentIdx) {
        const submittedAt = iso(now, dueDays - 1)
        const isOverdueDemo = idx === 3 && t === 1 // module 4: one missed task
        if (!isOverdueDemo) {
          const gradedRecently = idx >= currentIdx - 2 // last 2 modules graded most recently
          submission = {
            submittedAt,
            grade: 78 + ((idx * 7 + t * 5) % 22),
            feedback: gradedRecently ? FEEDBACK[(idx + t) % FEEDBACK.length] : undefined,
            gradedAt: iso(now, dueDays + (gradedRecently ? 1 : 0)),
          }
        }
      } else if (idx === currentIdx && t === 0) {
        submission = { submittedAt: iso(now, -1) } // submitted, awaiting grade
      }
      if (submission) item.submission = submission
      return item
    })

    return { id, position: idx + 1, title, items: [resource, ...assignments] }
  })
}
