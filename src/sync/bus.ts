/**
 * The "something changed" bus that keeps every screen in step.
 *
 * Whenever data is saved (a request that is not a plain read, or a change in the offline demo store) the topics it touches are
 * published here. Every screen that shows such data listens and quietly loads it again, so a change made on one page shows on the
 * others at once, with no reload, and in the other tabs of this browser too. Changes made by other people (other computers) cannot
 * be pushed by the server yet; those are caught by the polling in `useLive`.
 */
export type Topic =
  | 'courses' // modules, tasks, quizzes, hand-ins, grades
  | 'events' // the calendar
  | 'slots' // mentor 1:1 times
  | 'standings' // weekly grades
  | 'notifications' // the bell and announcements
  | 'directory' // people, teams, roles
  | 'reviews' // mentor reviews
  | 'feedback' // lecture feedback
  | 'profile'
  | 'reports' // reports to the admins

export const ALL_TOPICS: readonly Topic[] = [
  'courses',
  'events',
  'slots',
  'standings',
  'notifications',
  'directory',
  'reviews',
  'feedback',
  'profile',
  'reports',
]

type Listener = (topics: ReadonlySet<Topic>) => void

const listeners = new Set<{ topics: ReadonlySet<Topic>; run: Listener }>()
const CHANNEL = 'xsolla-lms-sync'

let channel: BroadcastChannel | null | undefined
/** The line to this browser's other tabs; none in tests or in a browser without BroadcastChannel. */
function line(): BroadcastChannel | null {
  if (channel !== undefined) return channel
  channel = null
  if (import.meta.env.MODE === 'test' || typeof BroadcastChannel === 'undefined') return channel
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e: MessageEvent<unknown>) => {
      if (Array.isArray(e.data)) deliver(e.data.filter((t): t is Topic => ALL_TOPICS.includes(t as Topic)))
    }
  } catch {
    channel = null
  }
  return channel
}

function deliver(topics: Topic[]) {
  if (topics.length === 0) return
  const touched = new Set(topics)
  for (const l of [...listeners]) {
    if ([...touched].some((t) => l.topics.has(t))) l.run(touched)
  }
}

let pending: Set<Topic> | null = null

/**
 * Says that data of these topics changed. Publishes in the same moment are one message. Listeners run in this tab and,
 * unless `local`, in the browser's other tabs.
 */
export function publish(topics: readonly Topic[], { local = false } = {}) {
  if (topics.length === 0) return
  if (pending) {
    topics.forEach((t) => pending!.add(t))
    return
  }
  pending = new Set(topics)
  queueMicrotask(() => {
    const out = [...(pending ?? [])]
    pending = null
    deliver(out)
    if (!local) line()?.postMessage(out)
  })
}

/** Calls `run` whenever one of the topics is published. Returns the way to stop. */
export function subscribe(topics: readonly Topic[], run: Listener): () => void {
  line() // listen to the other tabs from the first subscriber on
  const entry = { topics: new Set(topics), run }
  listeners.add(entry)
  return () => {
    listeners.delete(entry)
  }
}

/** Which topics a request to the backend can have changed. Something not known counts as everything. */
export function topicsForPath(path: string): Topic[] {
  const p = path.split('?')[0].replace(/^\/+/, '')
  const [head = '', , third = ''] = p.split('/')
  switch (head) {
    case 'modules':
      // /modules/:id/enrollments/:user/grade is the mentor's week grade
      return p.includes('/grade') || third === 'enrollments'
        ? ['courses', 'standings', 'notifications']
        : ['courses', 'notifications']
    case 'content-items':
    case 'quizzes':
    case 'files':
      return ['courses']
    case 'submissions':
      return ['courses', 'notifications', 'standings']
    case 'events':
    case 'calendar':
      return ['events', 'notifications']
    case 'mentor-slots':
      return ['slots', 'notifications']
    case 'mentor-reviews':
      return ['reviews']
    case 'lecture-feedback':
      return ['feedback']
    case 'notifications':
      return ['notifications']
    case 'users':
      // a profile or avatar is the person's own; everything else about a user changes the people lists
      return /\/(profile|avatar|preferences)/.test(p) ? ['profile', 'directory'] : ['directory', 'courses']
    case 'teams':
    case 'mentors':
      return ['directory', 'standings']
    case 'enrollments':
      return ['courses', 'standings']
    case 'reports':
      return ['reports']
    // asking for an AI summary (POST /analytics/.../ai-summary) saves nothing anybody else has on screen
    case 'auth':
    case 'analytics':
      return []
    default:
      return [...ALL_TOPICS]
  }
}
