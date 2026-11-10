import { useCallback, useMemo, useState } from 'react'
import { DayModal } from '../components/calendar/DayModal'
import type { EventEditing } from '../components/calendar/DayModal'
import { EventForm } from '../components/authoring/EventForm'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { SlotsPanel } from '../components/calendar/SlotsPanel'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { canAuthor, canMentor, isStudent } from '../utils/roles'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useMeetingSlots } from '../hooks/useMeetingSlots'
import { useCourses } from '../hooks/useCourses'
import { useModuleAccess } from '../hooks/useModuleAccess'
import { addMonths, dateKey, deadlineEvents, groupByDay, monthLabel, startOfMonth } from '../utils/calendar'
import { myNextBooking, slotEvents, slotsOnDay } from '../utils/slots'
import { draftToEvent, isEditableEvent } from '../utils/authoring'
import { savedNotice } from '../utils/googleSync'
import { newId } from '../mocks/contentEdits'
import type { CalendarEvent, EventKind } from '../types/calendar'
import '../styles/ui.css'
import '../components/calendar/calendar.css'
import { Loading } from '../components/loading/Loading'

const LEGEND: [EventKind, string][] = [
  ['lecture', 'Lecture'],
  ['meeting', 'Meeting'],
  ['off-campus', 'Off-campus'],
  ['deadline', 'Deadline'],
  ['availability', '1:1 times'],
]
const HIDDEN_KEY = 'calendar_hidden_kinds'

function readHidden(): EventKind[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    const known = LEGEND.map(([k]) => k)
    return Array.isArray(raw) ? raw.filter((k): k is EventKind => known.includes(k)) : []
  } catch {
    return []
  }
}

export default function CalendarPage() {
  const courses = useCourses()
  const calendar = useCalendarEvents()
  const isLocked = useModuleAccess()
  const { user } = useAuth()
  const meetings = useMeetingSlots()
  // mentor part: 1:1 times. lecturer part: lectures and events. students: book a 1:1.
  const mentor = canMentor(user)
  const author = canAuthor(user)
  const student = isStudent(user)

  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(() => dateKey(today))
  // the day whose details pop-up is open (null = closed)
  const [openDay, setOpenDay] = useState<string | null>(null)
  // lecturers: the event form inside the day pop-up (null = closed, {} = a new event)
  const [eventForm, setEventForm] = useState<{ event?: CalendarEvent } | null>(null)
  const [eventMsg, setEventMsg] = useState('')
  // the event was saved, but its Google copy did not arrive
  const [eventWarn, setEventWarn] = useState(false)

  // event types switched off in the legend (remembered in this browser)
  const [hidden, setHidden] = useState<EventKind[]>(readHidden)
  const toggleKind = useCallback((kind: EventKind) => {
    setHidden((prev) => {
      const next = prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable: the filter just isn't remembered */
      }
      return next
    })
  }, [])

  // deadlines of modules that are not open yet stay hidden from students
  // the 1:1 times are optional: if they can't be loaded the rest of the calendar still works
  // everything, for the day pop-up: the legend filter only changes what the grid shows
  const allByDay = useMemo(
    () =>
      groupByDay([
        ...calendar.events,
        ...deadlineEvents(courses.modules.filter((m) => !isLocked(m))),
        ...(user && (mentor || student) ? slotEvents(meetings.slots, { id: user.id, isMentor: mentor }, today) : []),
      ]),
    [calendar.events, courses.modules, isLocked, meetings.slots, user, mentor, student, today],
  )
  const eventsByDay = useMemo(() => {
    if (hidden.length === 0) return allByDay
    return Object.fromEntries(
      Object.entries(allByDay).map(([day, list]) => [day, list.filter((e) => !hidden.includes(e.kind))]),
    )
  }, [allByDay, hidden])

  const booking = useMemo(() => (user ? myNextBooking(meetings.slots, user.id, today) : undefined), [meetings.slots, user, today])
  const daySlots = useMemo(() => {
    if (!openDay) return []
    const all = slotsOnDay(meetings.slots, openDay)
    // students only see times they can still use, or their own booking
    if (!mentor && !student) return []
    return mentor ? all : all.filter((s) => new Date(s.startsAt) > today || s.bookedBy?.id === user?.id)
  }, [openDay, meetings.slots, mentor, student, today, user?.id])
  const actions = useMemo(
    () => ({ addWindow: meetings.addWindow, remove: meetings.remove, book: meetings.book, cancel: meetings.cancel }),
    [meetings.addWindow, meetings.remove, meetings.book, meetings.cancel],
  )
  const showSlots = user && meetings.status === 'ready' && (mentor || daySlots.length > 0)

  const goToMonth = useCallback(
    (next: Date) => {
      setMonth(next)
      // keep the day panel meaningful: today if we landed on this month, else the 1st
      const isThisMonth = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
      setSelected(dateKey(isThisMonth ? today : next))
    },
    [today],
  )

  const openDate = useMemo(() => {
    if (!openDay) return null
    const [y, m, d] = openDay.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [openDay])

  const selectDay = useCallback((key: string) => {
    setSelected(key)
    setOpenDay(key)
    setEventForm(null)
    setEventMsg('')
  }, [])
  const closeDay = useCallback(() => {
    setOpenDay(null)
    setEventForm(null)
    setEventMsg('')
  }, [])
  const { save: saveEvent, remove: removeEvent } = calendar
  const editing = useMemo<EventEditing | undefined>(
    () =>
      author
        ? {
            canEdit: isEditableEvent,
            onEdit: (event) => {
              setEventMsg('')
              setEventForm({ event })
            },
            onDelete: async (event) => {
              await removeEvent(event.id)
              setEventForm(null)
              setEventMsg('Event deleted.')
              setEventWarn(false)
            },
          }
        : undefined,
    [author, removeEvent],
  )

  const loading = calendar.status === 'loading' || courses.status === 'loading'
  const failed = calendar.status === 'error' || courses.status === 'error'

  const retry = () => {
    if (calendar.status === 'error') calendar.reload()
    if (courses.status === 'error') courses.reload()
  }

  return (
    <section className="calendar">
      <h1 className="page-title">Calendar</h1>

      <div className="calendar__bar">
        <h2 className="calendar__month" aria-live="polite">
          {monthLabel(month)}
        </h2>

        <div className="calendar__nav">
          <button type="button" className="btn btn--ghost" onClick={() => goToMonth(startOfMonth(today))}>
            Today
          </button>
          <button
            type="button"
            className="calendar__arrow"
            aria-label="Previous month"
            onClick={() => goToMonth(addMonths(month, -1))}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            className="calendar__arrow"
            aria-label="Next month"
            onClick={() => goToMonth(addMonths(month, 1))}
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>

      {loading && (
        <Loading className="module__state">Loading calendar…</Loading>
      )}

      {!loading && failed && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t load the calendar.</p>
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {!loading && !failed && (
        <>
          <ul className="legend" aria-label="Legend">
            {LEGEND.map(([kind, label]) => (
              <li key={kind}>
                <button
                  type="button"
                  className="legend__item"
                  aria-pressed={!hidden.includes(kind)}
                  onClick={() => toggleKind(kind)}
                >
                  <span className={`dot ev ev--${kind}`} aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <MonthGrid
            month={month}
            today={today}
            selected={selected}
            eventsByDay={eventsByDay}
            onSelect={selectDay}
          />

          <DayModal
            date={openDate}
            events={openDay ? (allByDay[openDay] ?? []) : []}
            now={today}
            onClose={closeDay}
            editing={editing}
          >
            {author && openDay && (
              <section className="day-tools" aria-labelledby="day-tools-title">
                <h3 id="day-tools-title" className="day-tools__title">
                  {eventForm?.event ? 'Edit event' : 'Lectures and events'}
                </h3>
                {eventMsg && (
                  <p className={eventWarn ? 'day-tools__ok day-tools__warn' : 'day-tools__ok'} role={eventWarn ? 'alert' : 'status'}>
                    {eventMsg}
                  </p>
                )}
                {eventForm ? (
                  <EventForm
                    key={eventForm.event?.id ?? 'new'}
                    event={eventForm.event}
                    dayKey={openDay}
                    modules={courses.modules}
                    onCancel={() => setEventForm(null)}
                    onSave={async (d) => {
                      const google = await saveEvent(draftToEvent(d, eventForm.event?.id ?? newId('ev')), { syncToGoogle: d.syncToGoogle })
                      const notice = savedNotice(eventForm.event ? 'Event saved.' : 'Event added. Students can see it now.', google)
                      setEventForm(null)
                      setEventMsg(notice.text)
                      setEventWarn(notice.warn)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      setEventMsg('')
                      setEventForm({})
                    }}
                  >
                    <Icon name="plus" size={16} /> Add a lecture or event
                  </button>
                )}
              </section>
            )}
            {showSlots && openDay && (
              <SlotsPanel
                dayKey={openDay}
                slots={daySlots}
                isMentor={mentor}
                userId={user.id}
                booking={booking}
                now={today}
                actions={actions}
              />
            )}
          </DayModal>
        </>
      )}
    </section>
  )
}
