import type { AssignmentItem, ContentItem, CourseModule, QuizItem, ResourceItem, Submission } from '../types/course'

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

/**
 * Module 5 (React) is deliberately busy - many files, links and quizzes, some with long titles - so
 * the pages can be checked with a lot of content. The other modules stay small.
 */
function busyResources(id: string): ResourceItem[] {
  const file = (n: number, title: string, kind: ResourceItem['kind'], name: string, kb: number, description?: string): ResourceItem => ({
    id: `${id}-f${n}`,
    moduleId: id,
    type: 'resource',
    title,
    kind,
    file: { name, sizeBytes: kb * 1024 },
    ...(description ? { description } : {}),
  })
  const link = (n: number, title: string, url: string, description?: string): ResourceItem => ({
    id: `${id}-l${n}`,
    moduleId: id,
    type: 'resource',
    title,
    kind: 'link',
    url,
    ...(description ? { description } : {}),
  })
  return [
    file(1, 'Hooks in depth - workshop slides', 'pptx', 'react-hooks-workshop.pptx', 4820, 'Second lecture of the week'),
    file(2, 'Component patterns cheat sheet', 'pdf', 'component-patterns.pdf', 312),
    file(3, 'State management: when to lift state up, when to reach for context, and when a store is worth it', 'pdf', 'state-management-guide.pdf', 1290, 'Long read, worth it before the State management task'),
    file(4, 'Lecture notes', 'md', 'week-5-notes.md', 18),
    file(5, 'Starter project for the Routing app', 'zip', 'routing-app-starter.zip', 2240, 'Unzip, run npm install, then npm run dev'),
    file(6, 'Accessibility checklist for components', 'pdf', 'a11y-checklist.pdf', 205),
    file(7, 'Testing React components', 'pptx', 'testing-react.pptx', 3100),
    link(1, 'React docs: Thinking in React', 'https://react.dev/learn/thinking-in-react', 'Official tutorial'),
    link(2, 'React docs: Rules of Hooks', 'https://react.dev/reference/rules/rules-of-hooks'),
    link(3, 'React Router tutorial', 'https://reactrouter.com/start/framework/installation', 'For the Routing app task'),
    link(4, 'Video: a complete guide to useEffect (about 50 minutes, watch before Thursday)', 'https://www.youtube.com/results?search_query=useEffect+guide'),
    link(5, 'MDN: Using the Fetch API', 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch'),
  ]
}

function busyQuizzes(id: string, now: Date, weekOffset: number): QuizItem[] {
  const q = (n: number, prompt: string, options: string[], correct: number) => ({ id: `${id}-q-${n}`, prompt, options, correct })
  return [
    {
      id: `${id}-z1`,
      moduleId: id,
      type: 'quiz',
      title: 'Hooks basics',
      description: 'Five quick questions on useState and useEffect.',
      dueAt: dayAt(now, weekOffset + 3, 18),
      questions: [
        q(1, 'Which hook keeps a value between renders and re-renders when it changes?', ['useRef', 'useState', 'useMemo'], 1),
        q(2, 'When does an effect with an empty dependency list run?', ['On every render', 'Once, after the first render', 'Never'], 1),
        q(3, 'Where may hooks be called?', ['Inside loops', 'At the top level of a component or custom hook', 'Inside conditions'], 1),
        q(4, 'What does the cleanup function of an effect do?', ['Runs before the next effect and on unmount', 'Clears the state', 'Nothing'], 0),
        q(5, 'Which hook avoids recalculating an expensive value?', ['useCallback', 'useMemo', 'useId', 'useEffect'], 1),
      ],
    },
    {
      id: `${id}-z2`,
      moduleId: id,
      type: 'quiz',
      title: 'Props, state and lifting state up: a longer check before the State management task',
      dueAt: dayAt(now, weekOffset + 5, 18),
      questions: [
        q(1, 'Props are...', ['Mutable by the child', 'Read-only inputs from the parent', 'Global'], 1),
        q(2, 'Two siblings need the same data. Where should it live?', ['In both', 'In their closest common parent', 'In a global variable'], 1),
        q(3, 'Which is NOT a reason to use context?', ['Theme', 'Signed-in user', 'Every piece of local form state'], 2),
      ],
    },
    {
      id: `${id}-z3`,
      moduleId: id,
      type: 'quiz',
      title: 'Routing',
      description: 'Optional practice.',
      questions: [q(1, 'Which component renders the matched child route?', ['Link', 'Outlet', 'Route'], 1), q(2, 'How do you read :id from the URL?', ['useParams', 'useLocation', 'useNavigate'], 0)],
    },
  ]
}

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
      }

      let submission: Submission | undefined
      if (idx < currentIdx) {
        const submittedAt = iso(now, dueDays - 1)
        const isOverdueDemo = idx === 3 && t === 1 // module 4: one missed task
        if (!isOverdueDemo) {
          const gradedRecently = idx >= currentIdx - 2 // last 2 modules graded most recently
          submission = {
            submittedAt,
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

    // Rashad (900, mentor & lecturer) writes the odd weeks, Elvin (902) the even ones; Nargiz (907) the extra quizzes
    const createdBy = idx % 2 === 0 ? 900 : 902
    const byWho = (i: ContentItem): ContentItem => ({ ...i, createdBy: i.type === 'quiz' ? 907 : createdBy })

    return {
      id,
      position: idx + 1,
      title,
      description: DESCRIPTIONS[idx],
      createdBy,
      // the course was written in the weeks before it started
      createdAt: dayAt(now, -currentIdx * 7 - 21 + idx, 10),
      opensAt: dayAt(now, weekOffset), // opens at midnight
      closesAt: dayAt(now, weekOffset + 6, 23, 59),
      // module 5 is the busy one (see busyResources)
      items: (idx === 4
        ? [...resources, ...busyResources(id), ...assignments, ...busyQuizzes(id, now, weekOffset)]
        : [...resources, ...assignments]
      ).map(byWho),
    }
  })
}
