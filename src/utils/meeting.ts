import type { CalendarEvent } from '../types/calendar'

/** Students can join (and see the link) from this many minutes before a lecture starts. */
export const JOIN_OPENS_MINUTES = 30
const MINUTE = 60_000

/** Events that can have an online meeting link: lectures and meetings, not off-campus days. */
export const canHaveMeeting = (kind: CalendarEvent['kind']) => kind === 'lecture' || kind === 'meeting' || kind === 'google'

/** A Google Meet address like https://meet.google.com/abc-defg-hij. */
export const isGoogleMeet = (url: string) => {
  try {
    return new URL(url).hostname === 'meet.google.com'
  } catch {
    return false
  }
}

/**
 * Why a meeting link cannot be saved, or '' when it is fine (an empty link is fine: it is optional).
 * Only secure web addresses are accepted, so nothing like `javascript:` can end up behind a Join button.
 */
export function meetingUrlError(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  if (text.length > 300) return 'The link is too long.'
  if (/\s/.test(text)) return 'A link has no spaces.'
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return 'Enter a full link, like https://meet.google.com/abc-defg-hij.'
  }
  if (url.protocol !== 'https:') return 'The link must start with https://.'
  if (!url.hostname.includes('.')) return 'Enter a full link, like https://meet.google.com/abc-defg-hij.'
  return ''
}

export type JoinState =
  | { state: 'none' }
  /** The link exists but it is too early for students to see it. */
  | { state: 'later'; opensAt: Date }
  | { state: 'open' }
  | { state: 'ended' }

/** Whether a student can join this event now: from 30 minutes before the start until it ends. */
export function joinState(event: Pick<CalendarEvent, 'kind' | 'meetingUrl' | 'startsAt' | 'endsAt' | 'allDay'>, now: Date): JoinState {
  if (!event.meetingUrl || !canHaveMeeting(event.kind)) return { state: 'none' }
  const opens = new Date(new Date(event.startsAt).getTime() - JOIN_OPENS_MINUTES * MINUTE)
  if (now < opens) return { state: 'later', opensAt: opens }
  if (now > new Date(event.endsAt)) return { state: 'ended' }
  return { state: 'open' }
}
