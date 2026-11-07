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

/** Everything that was sent, newest first. */
export function listBroadcasts(): Broadcast[] {
  return read<Broadcast[]>(KEY, []).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
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

const notificationId = (b: Broadcast) => `b-${b.id}`
const readIds = (userId: number) => read<Record<string, string[]>>(READ_KEY, {})[String(userId)] ?? []

/** The announcements meant for this person, as bell notifications (read or not). */
export function announcementsFor(user: Pick<User, 'id' | 'roles' | 'roleUntil'>, now: Date = new Date()): AppNotification[] {
  const seen = readIds(user.id)
  return listBroadcasts()
    .filter((b) => inAudience(user, b.audience, now))
    .map((b) => ({
      id: notificationId(b),
      type: 'announcement' as const,
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
