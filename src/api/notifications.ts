import { addBroadcast, announcementsFor, type Broadcast, isAnnouncementId, listBroadcasts, markAnnouncementsRead } from '../mocks/broadcasts'
import { listUsers } from '../mocks/directory'
import { buildMockNotifications } from '../mocks/notifications'
import type { AppNotification, NotificationType } from '../types/notification'
import type { User } from '../types/user'
import { type Audience, inAudience } from '../utils/adminNotifications'
import { authedRequest } from './authed'
import { ApiError, hasBackend } from './http'

/**
 * With a backend (VITE_API_URL) these are the server's own in-app notifications (backend docs/notifications.md):
 *   GET  /notifications           the signed-in user's UNREAD ones, newest first (read ones are never sent)
 *   POST /notifications/:id/read  204
 *   POST /notifications/read-all  { marked }
 * Any role gets them (a mentor is told about a hand-in, a student about a grade). The server makes them from the same events
 * as its emails. Without a backend the demo ones below are used.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

interface NotificationDto {
  id: number | string
  /** The event: enrollment.graded, module.created, mentor_slot.booked, ... */
  type: string
  /** The email's subject. */
  title: string
  /** The email's plain text body. */
  message: string
  created_at: string
  read_at?: string | null
}

/** What each server event means to the bell: its icon and the page the notification opens. */
const EVENT: Record<string, { type: NotificationType; link: string }> = {
  'enrollment.graded': { type: 'graded', link: '/grades' },
  'module.created': { type: 'task', link: '/courses' },
  'content_item.uploaded': { type: 'material', link: '/courses' },
  'event.created': { type: 'event', link: '/calendar' },
  'mentor_availability.created': { type: 'meeting', link: '/calendar' },
  'mentor_slot.booked': { type: 'meeting', link: '/calendar' },
  'mentor_slot.canceled': { type: 'meeting', link: '/calendar' },
  'submission.created': { type: 'submission', link: '/grading' },
}

/** The bell shows one line: the email's subject (the body is the same text in full sentences). */
export function toNotification(d: NotificationDto): AppNotification {
  const known = EVENT[d.type]
  return {
    id: String(d.id),
    type: known?.type ?? 'announcement',
    message: d.title.trim() || d.message.trim(),
    link: known?.link ?? '',
    createdAt: d.created_at,
    readAt: d.read_at ?? null,
  }
}

/** A server that has no notification database yet (503) or no such route has no notifications; that is not an error. */
const unavailable = (e: unknown) => e instanceof ApiError && [404, 405, 501, 503].includes(e.status)

export async function fetchNotifications(): Promise<AppNotification[]> {
  if (hasBackend()) {
    try {
      const rows = await authedRequest<NotificationDto[] | null>('/notifications?limit=100')
      return (rows ?? []).map(toNotification)
    } catch (e) {
      if (unavailable(e)) return []
      throw e
    }
  }
  await wait()
  return buildMockNotifications()
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!id) throw new Error('Missing notification id')
  if (hasBackend()) {
    // already gone (someone else's, or not there any more): it is not unread any more either way
    await authedRequest<unknown>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }).catch((e) => {
      if (!(e instanceof ApiError && e.status === 404)) throw e
    })
    return
  }
  await wait()
}

export async function markAllNotificationsRead(): Promise<void> {
  if (hasBackend()) {
    await authedRequest<unknown>('/notifications/read-all', { method: 'POST' })
    return
  }
  await wait()
}

/** Whether the person's notifications come from the server (any role) or are the demo student's (students only). */
export const serverNotifications = () => hasBackend()

// ---------- announcements from the admin ----------

/**
 * Announcements the admin sent that are meant for this person. With a backend they come in the normal
 * GET /notifications list (type "announcement"), so nothing extra is fetched here.
 */
export async function fetchAnnouncements(user: Pick<User, 'id' | 'roles' | 'roleUntil'>): Promise<AppNotification[]> {
  if (hasBackend()) return []
  await wait()
  return announcementsFor(user)
}

/** Remembers which announcements this person has read (offline only; the server tracks `read_at` itself). */
export async function markAnnouncementsAsRead(userId: number, ids: string[]): Promise<void> {
  if (!hasBackend()) markAnnouncementsRead(userId, ids)
}

export { isAnnouncementId }

export interface NewBroadcast {
  message: string
  link: string
  audience: Audience
}

/** Backend row of GET /notifications/broadcasts (proposed, see BACKEND_REQUIREMENTS.md 4.5). */
interface BroadcastDto {
  id: number | string
  message: string
  link?: string | null
  audience: Audience
  sent_at: string
  sent_by?: string | null
  recipients: number
}

const toBroadcast = (d: BroadcastDto): Broadcast => ({
  id: String(d.id),
  message: d.message,
  link: d.link ?? '',
  audience: d.audience,
  sentAt: d.sent_at,
  sentBy: d.sent_by ?? '',
  recipients: d.recipients,
})

/** Everything the admin sent, newest first. */
export async function fetchBroadcasts(): Promise<Broadcast[]> {
  if (hasBackend()) {
    const rows = await authedRequest<BroadcastDto[] | null>('/notifications/broadcasts')
    return (rows ?? []).map(toBroadcast).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  }
  await wait()
  return listBroadcasts()
}

/** Sends an announcement. The server (or, offline, the demo directory) works out who it reaches. */
export async function sendBroadcast(input: NewBroadcast, sentBy: string): Promise<Broadcast> {
  const body = { message: input.message.trim(), link: input.link, audience: input.audience }
  if (hasBackend()) return toBroadcast(await authedRequest<BroadcastDto>('/notifications/broadcast', { method: 'POST', body }))
  await wait()
  const recipients = listUsers().filter((u) => !u.leftAt && inAudience(u, input.audience)).length
  return addBroadcast(body, recipients, sentBy)
}
