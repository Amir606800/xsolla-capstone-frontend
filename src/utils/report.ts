import type { IconName } from '../components/Icon'

/**
 * Reports to the school's admins (backend docs/reports.md: POST /reports { subject, message }). The server only has a
 * subject and a message, so what the report is about, and who, go into both: the subject starts with them (the admins
 * can search it), and the message opens with an "About:" line.
 */

export const REPORT_ABOUT = [
  { key: 'school', label: 'The school', hint: 'Rules, organisation, the building, the LMS', icon: 'courses' },
  { key: 'mentor', label: 'A mentor', hint: 'Your 1:1s, feedback, how you are treated', icon: 'mentor' },
  { key: 'lecturer', label: 'A lecturer or lecture', hint: 'Teaching, materials, a lecture that went wrong', icon: 'lecturer' },
  { key: 'student', label: 'A student', hint: 'Behaviour, teamwork, copying work', icon: 'student' },
  { key: 'other', label: 'Something else', hint: 'Anything that is not listed', icon: 'info' },
] as const satisfies readonly { key: string; label: string; hint: string; icon: IconName }[]

export type ReportAbout = (typeof REPORT_ABOUT)[number]['key']

export interface ReportDraft {
  about: ReportAbout | null
  /** Who or what it is about (optional): a name, a lecture, a place. */
  who: string
  title: string
  message: string
}

export const EMPTY_REPORT: ReportDraft = { about: null, who: '', title: '', message: '' }

/** The server takes a subject of up to 200 characters and a message of up to 5000. */
const MAX_SUBJECT = 200
const MAX_SERVER_MESSAGE = 5000
export const MAX_TITLE = 120
export const MAX_WHO = 80
/** What the person may type: the rest of the server's limit is for the "About:" line. */
export const MAX_MESSAGE = 4800

const labelOf = (about: ReportAbout) => REPORT_ABOUT.find((a) => a.key === about)?.label ?? 'Something else'

export type ReportErrors = Partial<Record<'about' | 'who' | 'title' | 'message', string>>

export function validateReport(d: ReportDraft): ReportErrors {
  const e: ReportErrors = {}
  if (!d.about) e.about = 'Pick what the report is about.'
  if (d.who.trim().length > MAX_WHO) e.who = `Keep it under ${MAX_WHO} characters.`
  if (!d.title.trim()) e.title = 'Give the report a short title.'
  else if (d.title.trim().length > MAX_TITLE) e.title = `Keep the title under ${MAX_TITLE} characters.`
  if (!d.message.trim()) e.message = 'Write what happened.'
  else if (d.message.trim().length > MAX_MESSAGE) e.message = `Keep it under ${MAX_MESSAGE} characters.`
  return e
}

/** "A mentor: Rashad Aliyev · Missed two 1:1s", at most 200 characters. */
export function reportSubject(d: ReportDraft): string {
  const who = d.who.trim()
  const head = `${labelOf(d.about ?? 'other')}${who ? `: ${who}` : ''}`
  return `${head} · ${d.title.trim()}`.slice(0, MAX_SUBJECT)
}

/** The message, opened by what (and who) it is about. */
export function reportMessage(d: ReportDraft): string {
  const who = d.who.trim()
  return `About: ${labelOf(d.about ?? 'other')}${who ? ` (${who})` : ''}\n\n${d.message.trim()}`.slice(0, MAX_SERVER_MESSAGE)
}
