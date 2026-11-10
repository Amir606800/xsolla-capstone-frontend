import type { User } from '../types/user'
import type { GoogleOutcome } from '../types/google'
import { isAdmin } from './roles'

/** Where a person manages the Google connection: admins have their own section. */
export const settingsPath = (user: Pick<User, 'roles' | 'roleUntil'> | null | undefined) => (isAdmin(user) ? '/admin/settings' : '/settings')

/**
 * The line shown after an event is saved. If the person asked for the Google copy and it did not arrive, the event
 * itself is fine (the server never fails it for that), so this says both, and `warn` makes the screen style it as a warning.
 */
export function savedNotice(base: string, google: GoogleOutcome): { text: string; warn: boolean } {
  if (google === 'synced') return { text: `${base} It is on your Google Calendar too.`, warn: false }
  if (google === 'failed') {
    return { text: `${base} But it did not reach your Google Calendar. Open Settings and connect Google again.`, warn: true }
  }
  return { text: base, warn: false }
}
