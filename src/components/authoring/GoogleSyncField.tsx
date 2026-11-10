import type { ReactNode } from 'react'
import { useId } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useGoogle } from '../../hooks/useGoogle'
import type { CalendarEvent } from '../../types/calendar'
import { settingsPath } from '../../utils/googleSync'

/**
 * "Also add to my Google Calendar" on the event form. The server can only do this when the event is
 * created, so an existing event just says whether it is on Google. Nothing shows if the server has no Google routes.
 */
export function GoogleSyncField({ event, checked, onChange }: { event?: CalendarEvent; checked: boolean; onChange: (on: boolean) => void }) {
  const { user } = useAuth()
  const { status } = useGoogle()
  const hintId = useId()

  if (event) {
    if (!event.googleEventId) return null
    return (
      <p className="form__hint google-sync__note">
        This event is on your Google Calendar. Saving it changes the Google copy too.
      </p>
    )
  }

  const connection = status?.connection
  if (connection === 'unsupported') return null

  const ready = connection === 'connected'
  let hint: ReactNode
  if (!status) hint = 'Checking your Google connection…'
  else if (ready) hint = `It goes on ${status.account?.email ?? 'your'} calendar only. Later changes and deleting follow it. It cannot be added after the event is saved.`
  else if (connection === 'unavailable') hint = 'Google could not be reached, so this is off for now.'
  else
    hint = (
      <>
        {connection === 'reconnect' ? 'Your Google connection needs renewing. ' : 'Google is not connected. '}
        <Link to={settingsPath(user)}>Open Settings</Link> to {connection === 'reconnect' ? 'reconnect' : 'connect'} it.
      </>
    )

  return (
    <div className="form__field google-sync">
      <label className="form__check">
        <input type="checkbox" checked={ready && checked} disabled={!ready} onChange={(e) => onChange(e.target.checked)} aria-describedby={hintId} />{' '}
        Also add to my Google Calendar
      </label>
      <p id={hintId} className="form__hint">
        {hint}
      </p>
    </div>
  )
}
