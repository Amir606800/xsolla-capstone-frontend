import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CalendarEvent } from '../../../types/calendar'
import { postpone, startInputs } from '../../../utils/adminCalendar'
import { formatEventTime, fullDateLabel } from '../../../utils/calendar'

const when = (e: CalendarEvent) => `${fullDateLabel(new Date(e.startsAt))}, ${formatEventTime(e)}`

/** Moves an event to another day or time; it keeps how long it lasts. */
export function PostponeForm({ event, onSave, onCancel }: { event: CalendarEvent; onSave: (next: CalendarEvent) => Promise<void>; onCancel: () => void }) {
  const [start, setStart] = useState(() => startInputs(event, 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const next = postpone(event, start.date, start.time)
  const unchanged = next?.startsAt === event.startsAt

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!next || unchanged || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the event')
      setBusy(false)
    }
  }

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label={`Postpone ${event.title}`}>
      <p className="admin-muted">
        Now: <strong>{when(event)}</strong>
      </p>

      <div className="admin-actions" role="group" aria-label="Quick moves">
        {[
          [1, '+1 day'],
          [7, '+1 week'],
        ].map(([days, label]) => (
          <button key={label} type="button" className="admin-btn" onClick={() => setStart(startInputs(event, days as number))}>
            {label}
          </button>
        ))}
      </div>

      <div className="admin-row">
        <label className="admin-field">
          <span className="admin-field__label">New day</span>
          <input type="date" className="admin-field__input" value={start.date} onChange={(e) => setStart({ ...start, date: e.target.value })} />
        </label>
        {!event.allDay && (
          <label className="admin-field">
            <span className="admin-field__label">Starts at</span>
            <input type="time" className="admin-field__input" value={start.time} onChange={(e) => setStart({ ...start, time: e.target.value })} />
          </label>
        )}
      </div>

      <p className="admin-muted" aria-live="polite">
        {!next ? 'Pick a day and a time.' : unchanged ? 'That is when it is now. Pick another day or time.' : <>Moves to: <strong>{when(next)}</strong></>}
      </p>
      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn--primary" disabled={!next || unchanged || busy}>
          {busy ? 'Moving…' : 'Postpone'}
        </button>
      </div>
    </form>
  )
}
