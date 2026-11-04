import type { AssignmentItem, CourseModule, ResourceItem, Submission } from '../types/course'

/**
 * Mock course: 12 modules (weeks). Dates are built relative to `now` so the
 * demo always looks "live": early modules are done, one has an overdue task,
 * the current one is in progress and the rest are upcoming.
 */

const DAY = 86_400_000
const iso = (now: Date, days: number) => new Date(now.getTime() + days * DAY).toISOString()
/** A local calendar day `days` from today at hh:mm (so deadlines/openings fall on sensible clock times). */
const dayAt = (now: Date, days: number, h = 0, m = 0) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, m).toISOString()

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

const DESCRIPTIONS = [
  'Set up your tools, meet your team and learn the Git workflow used all program long.',
  'HTML, CSS and how the web works: build and style your first pages.',
  'Core JavaScript: types, functions, the DOM and asynchronous code.',
  'Add static types to your JavaScript and learn to model data safely.',
  'Component-based UIs: state, props, hooks and routing with React.',
  'Fundamentals of Go: syntax, packages and building a small HTTP server.',
  'Relational data: schema design, SQL queries and PostgreSQL.',
  'Design and build REST APIs, including authentication.',
  'Package and run applications with Docker and Compose.',
  'Unit, integration and end-to-end testing strategies.',
  'Automate builds, tests and deployments with a CI/CD pipeline.',
  'Bring everything together in a team project and present it.',
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

    const resources: ResourceItem[] = [
      {
        id: `${id}-r1`,
        moduleId: id,
        type: 'resource',
        title: `${title} - lecture slides`,
        kind: 'pdf',
        description: "Lecturer's presentation",
      },
      {
        id: `${id}-r2`,
        moduleId: id,
        type: 'resource',
        title: `${title} - further reading`,
        kind: 'link',
        description: 'External source',
        url: 'https://developer.mozilla.org/',
      },
    ]

    const assignments = TASKS[idx].map((taskTitle, t): AssignmentItem => {
      const dueDays = weekOffset + 2 + t * 2
      const item: AssignmentItem = {
        id: `${id}-a${t + 1}`,
        moduleId: id,
        type: 'assignment',
        title: taskTitle,
        description: `Complete the "${taskTitle}" task for the ${title} module.`,
        requirements: [
          'Push your work to the team repository',
          'Include a short README explaining your approach',
          'Hand in the link or files here before the deadline',
        ],
        dueAt: dayAt(now, dueDays, 18), // due at 18:00
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

    return {
      id,
      position: idx + 1,
      title,
      description: DESCRIPTIONS[idx],
      opensAt: dayAt(now, weekOffset), // opens at midnight
      closesAt: dayAt(now, weekOffset + 6, 23, 59),
      items: [...resources, ...assignments],
    }
  })
}
