import { useId, useMemo, useState } from 'react'
import type { MeetingSlot } from '../../types/slots'
import { SLOT_MINUTES } from '../../types/slots'
import { formatDateTime } from '../../utils/date'
import { previewText, slotLabel, upcomingSlotTimes, windowError } from '../../utils/slots'
import { Icon } from '../Icon'

export interface SlotActions {
  /** Resolves with how many new times were added. */
  addWindow: (w: { date: string; start: string; end: string }) => Promise<number>
  remove: (id: string) => Promise<void>
  book: (id: string) => Promise<void>
  cancel: (id: string) => Promise<void>
}

interface SlotsPanelProps {
  /** The day, as YYYY-MM-DD. */
  dayKey: string
  /** The slots that start on this day, in time order. */
  slots: MeetingSlot[]
  isMentor: boolean
  userId: number
  /** The student's next booked 1:1 (on any day), if any. */
  booking?: MeetingSlot
  now: Date
  actions: SlotActions
}

type Message = { kind: 'ok' | 'error'; text: string }

function AvailabilityForm({
  dayKey,
  now,
  actions,
  onMessage,
}: Pick<SlotsPanelProps, 'dayKey' | 'now' | 'actions'> & { onMessage: (m: Message | null) => void }) {
  const [start, setStart] = useState('15:00')
  const [end, setEnd] = useState('18:00')
  const [busy, setBusy] = useState(false)
  const id = useId()

  const window = useMemo(() => ({ date: dayKey, start, end }), [dayKey, start, end])
  const error = useMemo(() => windowError(window, now), [window, now])
  const times = useMemo(() => (error ? [] : upcomingSlotTimes(window, now)), [error, window, now])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (error || busy) return
    setBusy(true)
    onMessage(null)
    try {
      const added = await actions.addWindow(window)
      const skipped = times.length - added
      onMessage({
        kind: 'ok',
        text:
          added === 0
            ? 'Those times were already in your list.'
            : `Added ${added} ${added === 1 ? 'time' : 'times'}${skipped > 0 ? ` (${skipped} already existed)` : ''}.`,
      })
    } catch (err) {
      onMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not add the times' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="slots__form" onSubmit={submit} noValidate>
      <p className="slots__hint">
        Say when you are free. The time is cut into {SLOT_MINUTES}-minute slots that your students can book.
      </p>
      <div className="slots__fields">
        <div>
          <label className="field__label" htmlFor={`${id}-from`}>
            From
          </label>
          <input
            id={`${id}-from`}
            className="field__input slots__time"
            type="time"
            step={SLOT_MINUTES * 60}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="field__label" htmlFor={`${id}-to`}>
            To
          </label>
          <input
            id={`${id}-to`}
            className="field__input slots__time"
            type="time"
            step={SLOT_MINUTES * 60}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={error !== null || busy}>
          Add availability
        </button>
      </div>
      {error ? (
        <p className="field__error">{error}</p>
      ) : (
        <p className="slots__preview" aria-live="polite">
          {previewText(times)}
        </p>
      )}
    </form>
  )
}

export function SlotsPanel({ dayKey, slots, isMentor, userId, booking, now, actions }: SlotsPanelProps) {
  const [message, setMessage] = useState<Message | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function act(id: string, run: () => Promise<void>, ok: string) {
    setBusyId(id)
    setMessage(null)
    try {
      await run()
      setMessage({ kind: 'ok', text: ok })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setBusyId(null)
    }
  }

  const mentorName = slots[0]?.mentorName

  return (
    <section className="slots" aria-labelledby="slots-title">
      <h3 id="slots-title" className="slots__title">
        {isMentor ? '1:1 availability' : `1:1 with ${mentorName ?? 'your mentor'}`}
      </h3>

      {isMentor ? (
        <AvailabilityForm dayKey={dayKey} now={now} actions={actions} onMessage={setMessage} />
      ) : booking ? (
        <p className="slots__hint">
          You have a 1:1 on <strong>{formatDateTime(booking.startsAt)}</strong>. To pick another time, cancel it first.
        </p>
      ) : (
        <p className="slots__hint">Pick a time to lock it for you.</p>
      )}

      {message && (
        <p className={message.kind === 'error' ? 'field__error' : 'slots__ok'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}

      {slots.length === 0 ? (
        isMentor && <p className="card__empty">No 1:1 times on this day yet.</p>
      ) : (
        <ul className="slots__list" aria-label="1:1 times">
          {slots.map((s) => {
            const started = new Date(s.startsAt) <= now
            const mine = s.bookedBy?.id === userId
            const busy = busyId === s.id
            return (
              <li key={s.id} className={`slots__item${s.booked ? ' is-booked' : ''}${mine ? ' is-mine' : ''}`}>
                <span className="slots__time-label">{slotLabel(s)}</span>

                {isMentor ? (
                  <>
                    <span className="slots__who">{s.booked ? (s.bookedBy?.name ?? 'Booked') : 'Free'}</span>
                    {!started && (
                      <button
                        type="button"
                        className="btn btn--ghost slots__btn"
                        disabled={busy}
                        aria-label={`${s.booked ? 'Cancel booking' : 'Remove'} ${slotLabel(s)}`}
                        onClick={() =>
                          s.booked
                            ? act(s.id, () => actions.cancel(s.id), 'Booking cancelled. The time is free again.')
                            : act(s.id, () => actions.remove(s.id), 'Time removed.')
                        }
                      >
                        {s.booked ? 'Cancel booking' : 'Remove'}
                      </button>
                    )}
                  </>
                ) : mine ? (
                  <>
                    <span className="slots__who slots__who--mine">
                      <Icon name="check" size={14} /> Booked by you
                    </span>
                    {!started && (
                      <button
                        type="button"
                        className="btn btn--ghost slots__btn"
                        disabled={busy}
                        aria-label={`Cancel ${slotLabel(s)}`}
                        onClick={() => act(s.id, () => actions.cancel(s.id), 'Your 1:1 is cancelled.')}
                      >
                        Cancel
                      </button>
                    )}
                  </>
                ) : s.booked ? (
                  <span className="slots__who">Taken</span>
                ) : (
                  <button
                    type="button"
                    className="btn slots__btn"
                    disabled={busy || booking !== undefined}
                    aria-label={`Book ${slotLabel(s)}`}
                    onClick={() => act(s.id, () => actions.book(s.id), `Booked ${slotLabel(s)}. See you then!`)}
                  >
                    Book
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
