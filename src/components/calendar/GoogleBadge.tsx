import type { CalendarEvent } from '../../types/calendar'
import { Icon } from '../Icon'

/** Staff only: this event was also put on its creator's Google Calendar (so edits and deletes follow it). */
export function GoogleBadge({ event }: { event: CalendarEvent }) {
  // an event imported from the person's own Google Calendar already has the Google kind: no badge on top of it
  if (!event.googleEventId || event.source === 'google') return null
  return (
    <span className="google-badge" title="Also on the creator’s Google Calendar. Changes and deleting follow it.">
      <Icon name="calendar" size={14} />
      On Google Calendar
    </span>
  )
}
