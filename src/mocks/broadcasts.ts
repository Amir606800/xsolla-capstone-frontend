import type { CalendarEvent } from '../types/calendar'
import type { AppNotification } from '../types/notification'
import type { User } from '../types/user'
import { type Audience, inAudience } from '../utils/adminNotifications'

/**
 * Offline stand-in for announcements the admin sends to everyone (or to students / mentors / lecturers).
 * They are kept in localStorage, so a person who signs in later in the same browser sees them in their bell.
 */
export interface Broadcast {
  id: string
  message: string
  /** In-app route the notification opens, or ''. */
  link: string
  audience: Audience
  sentAt: string // ISO
  sentBy: string
  recipients: number
  /**
   * 'lecture-link': made by the system when a lecturer adds or changes a lecture's meeting link. It reaches
   * students' bells like an announcement but is not something the admin sent, so it is not in their history.
   */
  kind?: 'lecture-link'
  eventId?: string
}

const KEY = 'broadcasts'
const READ_KEY = 'broadcast_reads'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked or full: it lasts until the page reloads */
  }
}

const newestFirst = (a: Broadcast, b: Broadcast) => b.sentAt.localeCompare(a.sentAt)

/** Every announcement the admin sent, newest first (not the system messages). */
export function listBroadcasts(): Broadcast[] {
  return read<Broadcast[]>(KEY, []).filter((b) => !b.kind).sort(newestFirst)
}

const dayTime = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/**
 * A lecturer added (or changed) the meeting link of a lecture: tell the students. Offline only: with a
 * backend it creates these notifications itself (BACKEND_REQUIREMENTS 4.5).
 */
export function addLectureLinkNotice(
  event: { id: string; title: string; startsAt: string },
  changed: boolean,
  sentBy: string,
  now: Date = new Date(),
): Broadcast {
  const all = read<Broadcast[]>(KEY, [])
  const notice: Broadcast = {
    id: `${now.getTime().toString(36)}${all.length.toString(36)}`,
    message: `${event.title}, ${dayTime.format(new Date(event.startsAt))}: the meeting link ${changed ? 'was changed' : 'is ready'}.`,
    link: '/calendar',
    audience: 'students',
    sentAt: now.toISOString(),
    sentBy,
    recipients: 0,
    kind: 'lecture-link',
    eventId: event.id,
  }
  write(KEY, [...all, notice])
  return notice
}

export function addBroadcast(
  input: { message: string; link: string; audience: Audience },
  recipients: number,
  sentBy: string,
  now: Date = new Date(),
): Broadcast {
  const all = read<Broadcast[]>(KEY, [])
  const broadcast: Broadcast = {
    id: `${now.getTime().toString(36)}${all.length.toString(36)}`,
    message: input.message.trim(),
    link: input.link,
    audience: input.audience,
    sentAt: now.toISOString(),
    sentBy,
    recipients,
  }
  write(KEY, [...all, broadcast])
  return broadcast
}

/**
 * After an event was saved: a lecture that now has a meeting link (or a different one) and has not ended
 * tells the students. `before` is the event as it was.
 */
export function noticeForSavedEvent(before: CalendarEvent | undefined, event: CalendarEvent, now: Date = new Date()): void {
  if (event.kind !== 'lecture' || !event.meetingUrl || event.meetingUrl === before?.meetingUrl) return
  if (new Date(event.endsAt) <= now) return
  addLectureLinkNotice(event, !!before?.meetingUrl, 'Lecturer', now)
}

const notificationId = (b: Broadcast) => `b-${b.id}`
const readIds = (userId: number) => read<Record<string, string[]>>(READ_KEY, {})[String(userId)] ?? []

/** The announcements meant for this person, as bell notifications (read or not). */
export function announcementsFor(user: Pick<User, 'id' | 'roles' | 'roleUntil'>, now: Date = new Date()): AppNotification[] {
  const seen = readIds(user.id)
  return read<Broadcast[]>(KEY, [])
    .sort(newestFirst)
    .filter((b) => inAudience(user, b.audience, now))
    .map((b) => ({
      id: notificationId(b),
      type: b.kind === 'lecture-link' ? ('event' as const) : ('announcement' as const),
      message: b.message,
      link: b.link,
      createdAt: b.sentAt,
      readAt: seen.includes(notificationId(b)) ? b.sentAt : null,
    }))
}

export const isAnnouncementId = (id: string) => id.startsWith('b-')

/** Marks some announcements as read for this person. */
export function markAnnouncementsRead(userId: number, ids: string[]): void {
  const all = read<Record<string, string[]>>(READ_KEY, {})
  all[String(userId)] = [...new Set([...(all[String(userId)] ?? []), ...ids.filter(isAnnouncementId)])]
  write(READ_KEY, all)
}
