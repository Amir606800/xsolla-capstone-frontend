import type { CalendarEvent } from '../../types/calendar'
import { formatClockTime } from '../../utils/date'
import { isGoogleMeet, joinState, JOIN_OPENS_MINUTES } from '../../utils/meeting'
import { Icon } from '../Icon'

/**
 * The online meeting of a lecture. A student gets a Join button from 30 minutes before the start until the
 * lecture ends; before that they are told when it appears (so nobody opens an old or wrong link early), and
 * after it there is nothing. Staff (lecturers, mentors, admins) always see the link: it is theirs to check.
 */
export function JoinMeeting({ event, now, always = false }: { event: CalendarEvent; now: Date; always?: boolean }) {
  const url = event.meetingUrl
  if (!url) return null
  const state = joinState(event, now)
  if (state.state === 'none') return null

  const name = isGoogleMeet(url) ? 'Google Meet' : 'the meeting'
  if (always || state.state === 'open') {
    return (
      <div className="event-card__join">
        <a className="btn event-card__join-btn" href={url} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={16} />
          {state.state === 'open' ? `Join ${name}` : `Open ${name} link`}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {always && state.state === 'later' && <span className="event-card__muted">Students see it from {formatClockTime(state.opensAt.toISOString())}.</span>}
        {always && state.state === 'ended' && <span className="event-card__muted">The lecture is over.</span>}
      </div>
    )
  }
  if (state.state === 'later') {
    return (
      <p className="event-card__muted event-card__join" role="note">
        The link to join appears {JOIN_OPENS_MINUTES} minutes before the start, at {formatClockTime(state.opensAt.toISOString())}.
      </p>
    )
  }
  return null
}
