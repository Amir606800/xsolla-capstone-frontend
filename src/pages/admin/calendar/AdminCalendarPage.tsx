import { useMemo, useState } from 'react'
import { EventForm } from '../../../components/authoring/EventForm'
import { isPastEvent } from '../../../components/calendar/eventClass'
import { MonthGrid } from '../../../components/calendar/MonthGrid'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useCalendarEvents } from '../../../hooks/useCalendarEvents'
import { useCourses } from '../../../hooks/useCourses'
import { newId } from '../../../mocks/contentEdits'
import type { CalendarEvent } from '../../../types/calendar'
import {
  eventsBetween,
  isSchoolEvent,
  KIND_LABEL,
  KIND_PLURAL,
  keyToDate,
  monthRange,
  nextDays,
  ordered,
  rangeLabel,
  SCHOOL_KINDS,
  weekRange,
} from '../../../utils/adminCalendar'
import type { DayRange, SchoolKind } from '../../../utils/adminCalendar'
import { draftToEvent } from '../../../utils/authoring'
import { savedNotice } from '../../../utils/googleSync'
import { GoogleBadge } from '../../../components/calendar/GoogleBadge'
import { addMonths, dateKey, formatEventTime, fullDateLabel, groupByDay, monthLabel, startOfMonth } from '../../../utils/calendar'
import { ConfirmDialog } from '../ConfirmDialog'
import { PostponeForm } from './PostponeForm'
import '../../../components/calendar/calendar.css'
import { Loading } from '../../../components/loading/Loading'

type Filter = 'all' | SchoolKind
type Action = { kind: 'new' } | { kind: 'edit' | 'postpone' | 'delete'; event: CalendarEvent }
/** What the list shows: the month on screen, a quick range, or days the admin picked. */
type Preset = 'month' | 'week' | 'next7' | 'custom'

const when = (e: CalendarEvent) => `${fullDateLabel(new Date(e.startsAt))}, ${formatEventTime(e)}`
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

/**
 * Admin: every lecture, meeting and off-campus day, as a month and as a list beside it. The list shows
 * the month, a quick range (this week, next 7 days) or any days picked: one day by clicking it, a range
 * with Shift+click or the From/To fields. Add, change, postpone or delete any event. Task deadlines and
 * 1:1 times are not shown.
 */
export default function AdminCalendarPage() {
  const calendar = useCalendarEvents()
  const { modules } = useCourses()
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [range, setRange] = useState<DayRange>(() => monthRange(today))
  const [preset, setPreset] = useState<Preset>('month')
  // the day a Shift+click stretches the range from
  const [anchor, setAnchor] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [action, setAction] = useState<Action | null>(null)
  const [message, setMessage] = useState('')
  // the event was saved, but its Google copy did not arrive
  const [warn, setWarn] = useState(false)
  // only the events that are also on a Google Calendar
  const [onlyGoogle, setOnlyGoogle] = useState(false)

  const school = useMemo(() => calendar.events.filter(isSchoolEvent), [calendar.events])
  const shown = (e: CalendarEvent) => (filter === 'all' || e.kind === filter) && (!onlyGoogle || !!e.googleEventId)
  const gridByDay = useMemo(
    () => groupByDay(school.filter((e) => (filter === 'all' || e.kind === filter) && (!onlyGoogle || !!e.googleEventId))),
    [school, filter, onlyGoogle],
  )
  const inView = eventsBetween(school, range)
  const listed = inView.filter(shown)
  const googleCount = inView.filter((e) => !!e.googleEventId).length
  const listByDay = groupByDay(listed)
  const count = (f: Filter) => (f === 'all' ? inView.length : inView.filter((e) => e.kind === f).length)

  const oneDay = range.from === range.to
  const heading = preset === 'month' ? monthLabel(month) : oneDay ? fullDateLabel(keyToDate(range.from)) : rangeLabel(range)

  function show(next: DayRange, nextPreset: Preset, monthOf: Date = keyToDate(next.from)) {
    setRange(next)
    setPreset(nextPreset)
    if (!sameMonth(monthOf, month)) setMonth(startOfMonth(monthOf))
  }
  const goToMonth = (next: Date) => {
    setMonth(next)
    setRange(monthRange(next))
    setPreset('month')
    setAnchor(null)
  }
  const pickDay = (key: string, extend: boolean) => {
    if (extend && anchor) {
      // Shift+click: from the last picked day to this one; the month on screen stays
      setRange(ordered(anchor, key))
      setPreset('custom')
      return
    }
    // the same day again shows the whole month
    if (preset !== 'month' && oneDay && range.from === key) {
      goToMonth(month)
      return
    }
    setAnchor(key)
    show({ from: key, to: key }, 'custom')
  }
  const setEdge = (edge: 'from' | 'to', value: string) => {
    if (!value) return
    const next = edge === 'from' ? ordered(value, range.to) : ordered(range.from, value)
    setAnchor(null)
    show(next, 'custom')
  }

  const open = (a: Action) => {
    setMessage('')
    setWarn(false)
    setAction(a)
  }
  const close = () => setAction(null)
  const done = (text: string, isWarning = false) => {
    close()
    setMessage(text)
    setWarn(isWarning)
  }

  const current = action && 'event' in action ? calendar.events.find((e) => e.id === action.event.id) ?? action.event : undefined
  // a new event starts on the picked day, today if it is in view, or the first day in view
  const todayKey = dateKey(today)
  const newDay = oneDay ? range.from : todayKey >= range.from && todayKey <= range.to ? todayKey : range.from
  const empty = oneDay ? 'Nothing on this day.' : preset === 'month' ? `Nothing in ${monthLabel(month)}.` : `Nothing between ${rangeLabel(range)}.`

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Lectures, meetings and off-campus days for everyone. 1:1 times are not shown here.</p>
        </div>
        
      </header>

      <p className={`admin-status${warn ? ' admin-status--warn' : ''}`} role={warn ? 'alert' : 'status'}>
        {message}
      </p>

      {calendar.status === 'loading' && (
        <Loading className="admin-muted">Loading the calendar…</Loading>
      )}
      {calendar.status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The calendar could not be loaded.</p>
          <button type="button" className="admin-btn" onClick={calendar.reload}>
            Try again
          </button>
        </div>
      )}

      {calendar.status === 'ready' && (
        <div className="admin-cal">
          <div className="admin-cal__month">
            <div className="calendar__bar">
              <h2 className="calendar__month" aria-live="polite">
                {monthLabel(month)}
              </h2>
              <div className="calendar__nav">
                <button type="button" className="admin-btn" onClick={() => goToMonth(startOfMonth(today))}>
                  Today
                </button>
                <button type="button" className="calendar__arrow" aria-label="Previous month" onClick={() => goToMonth(addMonths(month, -1))}>
                  <Icon name="chevron-left" />
                </button>
                <button type="button" className="calendar__arrow" aria-label="Next month" onClick={() => goToMonth(addMonths(month, 1))}>
                  <Icon name="chevron-right" />
                </button>
              </div>
            </div>
            <MonthGrid
              month={month}
              today={today}
              selected={preset !== 'month' && oneDay ? range.from : ''}
              range={preset !== 'month' && !oneDay ? range : undefined}
              eventsByDay={gridByDay}
              onSelect={pickDay}
            />
            <p className="admin-muted admin-cal__tip">Click a day to see only that day. Shift+click another day to see everything between them.</p>
          </div>

          <section className="admin-cal__list" aria-labelledby="admin-cal-list">
            <div className="admin-cal__list-head">
              <h2 id="admin-cal-list" className="admin-section-title">
                {heading}
              </h2>
              {preset !== 'month' && (
                <button type="button" className="admin-link admin-cal__all" onClick={() => goToMonth(month)}>
                  Show all of {monthLabel(month)}
                </button>
              )}
            </div>

            {listed.length > 0 && (
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => open({ kind: 'new' })}>
                <Icon name="plus" size={16} /> Add an event{oneDay ? ' on this day' : ''}
              </button>
            )}

            <div className="admin-range" role="group" aria-label="Time range">
              <div className="admin-segmented">
                <button type="button" aria-pressed={preset === 'week'} onClick={() => show(weekRange(today), 'week', today)}>
                  This week
                </button>
                <button type="button" aria-pressed={preset === 'next7'} onClick={() => show(nextDays(today, 7), 'next7', today)}>
                  Next 7 days
                </button>
                <button type="button" aria-pressed={preset === 'month'} onClick={() => goToMonth(month)}>
                  Whole month
                </button>
              </div>
              <div className="admin-row">
                <label className="admin-field">
                  <span className="admin-field__label">From</span>
                  <input type="date" className="admin-field__input" value={range.from} max={range.to} onChange={(e) => setEdge('from', e.target.value)} />
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">To</span>
                  <input type="date" className="admin-field__input" value={range.to} min={range.from} onChange={(e) => setEdge('to', e.target.value)} />
                </label>
              </div>
            </div>

            <div className="admin-segmented" role="group" aria-label="Show">
              {(['all', ...SCHOOL_KINDS] as Filter[]).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : KIND_PLURAL[f]} <span className="admin-segmented__count">{count(f)}</span>
                </button>
              ))}
            </div>

            {(googleCount > 0 || onlyGoogle) && (
              <button type="button" className="admin-chip" aria-pressed={onlyGoogle} onClick={() => setOnlyGoogle((v) => !v)}>
                <Icon name="calendar" size={14} /> On Google Calendar <span className="admin-segmented__count">{googleCount}</span>
              </button>
            )}

            {listed.length === 0 ? (
              <div className="admin-empty">
                <p>{empty}</p>
                <button type="button" className="admin-btn" onClick={() => open({ kind: 'new' })}>
                  <Icon name="plus" size={16} /> Add an event
                </button>
              </div>
            ) : (
              <ol className="admin-cal__days" aria-label="Events">
                {Object.entries(listByDay).map(([key, list]) => (
                  <li key={key}>
                    {!oneDay && <h3 className="admin-cal__day">{fullDateLabel(keyToDate(key))}</h3>}
                    <ul className="admin-cal__events">
                      {list.map((e) => {
                        const past = isPastEvent(e, today)
                        return (
                          <li key={e.id} className={`admin-cal__event${past ? ' is-past' : ''}`}>
                            <span className={`dot ev ev--${e.kind}${past ? ' is-past' : ''}`} aria-hidden="true" />
                            <div className="admin-cal__text">
                              <p className="admin-cal__title">{e.title}</p>
                              <p className="admin-cal__meta">
                                {KIND_LABEL[e.kind as SchoolKind]} · {formatEventTime(e)}
                                {e.location ? ` · ${e.location}` : ''}
                                {past ? ' · Past' : ''}
                              </p>
                              <GoogleBadge event={e} />
                            </div>
                            <div className="admin-actions">
                              <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'edit', event: e })} aria-label={`Edit ${e.title} on ${when(e)}`} title="Edit">
                                <Icon name="edit" size={16} />
                              </button>
                              <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'postpone', event: e })} aria-label={`Postpone ${e.title} on ${when(e)}`} title="Postpone">
                                <Icon name="clock" size={16} />
                              </button>
                              <button
                                type="button"
                                className="admin-icon-btn admin-icon-btn--danger"
                                onClick={() => open({ kind: 'delete', event: e })}
                                aria-label={`Delete ${e.title} on ${when(e)}`}
                                title="Delete"
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {/* new / edit: the lecturer's event form */}
      <Modal open={action?.kind === 'new' || action?.kind === 'edit'} onClose={close} title={action?.kind === 'edit' ? 'Edit event' : 'New event'} initialFocus=".form input">
        {(action?.kind === 'new' || action?.kind === 'edit') && (
          <div className="admin-dialog">
            <EventForm
              event={current}
              dayKey={current ? dateKey(new Date(current.startsAt)) : newDay}
              modules={modules}
              onCancel={close}
              onSave={async (d) => {
                const saved = draftToEvent(d, current?.id ?? newId('event'))
                const { google, meetingLinkLost } = await calendar.save(saved, { syncToGoogle: d.syncToGoogle })
                // show the month it is in
                goToMonth(startOfMonth(new Date(saved.startsAt)))
                const notice = savedNotice(current ? 'Event saved.' : 'Event added.', google, { meetingLinkLost })
                done(notice.text, notice.warn)
              }}
            />
          </div>
        )}
      </Modal>

      <Modal open={action?.kind === 'postpone'} onClose={close} title={current ? `Postpone “${current.title}”` : ''} initialFocus=".admin-dialog button" size="sm">
        {action?.kind === 'postpone' && current && (
          <PostponeForm
            event={current}
            onCancel={close}
            onSave={async (next) => {
              await calendar.save(next)
              // show the day it moved to
              const key = dateKey(new Date(next.startsAt))
              setAnchor(key)
              show({ from: key, to: key }, 'custom')
              done(`“${next.title}” moved to ${when(next)}.`)
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={action?.kind === 'delete'}
        title={current ? `Delete “${current.title}”?` : ''}
        confirmLabel="Delete event"
        onClose={close}
        onConfirm={async () => {
          if (!current) return
          await calendar.remove(current.id)
          done(`“${current.title}” deleted.`)
        }}
      >
        {current && <p>{when(current)}. It is removed from everyone’s calendar.</p>}
      </ConfirmDialog>
    </section>
  )
}
