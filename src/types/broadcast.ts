import type { Audience } from '../utils/adminNotifications'

/** An announcement the admin sent to everyone, or to a group. */
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
