import { useCallback, useMemo, useState } from 'react'
import { DayModal } from '../components/calendar/DayModal'
import type { EventEditing } from '../components/calendar/DayModal'
import { EventForm } from '../components/authoring/EventForm'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { SlotsPanel } from '../components/calendar/SlotsPanel'
import { Icon } from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useMeetingSlots } from '../hooks/useMeetingSlots'
import { useCourses } from '../hooks/useCourses'
import { useModuleAccess } from '../hooks/useModuleAccess'
import { addMonths, dateKey, deadlineEvents, groupByDay, monthLabel, startOfMonth } from '../utils/calendar'
import { myNextBooking, slotEvents, slotsOnDay } from '../utils/slots'
import { draftToEvent, isEditableEvent } from '../utils/authoring'
import { newId } from '../mocks/contentEdits'
import type { CalendarEvent } from '../types/calendar'
import '../styles/ui.css'
import '../components/calendar/calendar.css'

export default function CalendarPage() {
  const courses = useCourses()
  const calendar = useCalendarEvents()
  const isLocked = useModuleAccess()
  const { user } = useAuth()
  const meetings = useMeetingSlots()
  const isStaff = user?.role === 'teacher' || user?.role === 'admin'

  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(() => dateKey(today))
  // the day whose details pop-up is open (null = closed)
  const [openDay, setOpenDay] = useState<string | null>(null)
  // lecturers: the event form inside the day pop-up (null = closed, {} = a new event)
  const [eventForm, setEventForm] = useState<{ event?: CalendarEvent } | null>(null)
  const [eventMsg, setEventMsg] = useState('')

  // deadlines of modules that are not open yet stay hidden from students
  // the 1:1 times are optional: if they can't be loaded the rest of the calendar still works
  const eventsByDay = useMemo(
    () =>
      groupByDay([
        ...calendar.events,
        ...deadlineEvents(courses.modules.filter((m) => !isLocked(m))),
        ...(user ? slotEvents(meetings.slots, { id: user.id, isStaff }, today) : []),
      ]),
    [calendar.events, courses.modules, isLocked, meetings.slots, user, isStaff, today],
  )

  const booking = useMemo(() => (user ? myNextBooking(meetings.slots, user.id, today) : undefined), [meetings.slots, user, today])
  const daySlots = useMemo(() => {
    if (!openDay) return []
    const all = slotsOnDay(meetings.slots, openDay)
    // students only see times they can still use, or their own booking
    return isStaff ? all : all.filter((s) => new Date(s.startsAt) > today || s.bookedBy?.id === user?.id)
  }, [openDay, meetings.slots, isStaff, today, user?.id])
  const actions = useMemo(
    () => ({ addWindow: meetings.addWindow, remove: meetings.remove, book: meetings.book, cancel: meetings.cancel }),
    [meetings.addWindow, meetings.remove, meetings.book, meetings.cancel],
  )
  const showSlots = user && meetings.status === 'ready' && (isStaff || daySlots.length > 0)

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
      isStaff
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
            },
          }
        : undefined,
    [isStaff, removeEvent],
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
        <p className="module__state" role="status">
          Loading calendar…
        </p>
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
            <li><span className="dot ev ev--lecture" /> Lecture</li>
            <li><span className="dot ev ev--meeting" /> Meeting</li>
            <li><span className="dot ev ev--off-campus" /> Off-campus</li>
            <li><span className="dot ev ev--deadline" /> Deadline</li>
            <li><span className="dot ev ev--availability" /> 1:1 times</li>
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
            events={openDay ? (eventsByDay[openDay] ?? []) : []}
            now={today}
            onClose={closeDay}
            editing={editing}
          >
            {isStaff && openDay && (
              <section className="day-tools" aria-labelledby="day-tools-title">
                <h3 id="day-tools-title" className="day-tools__title">
                  {eventForm?.event ? 'Edit event' : 'Lectures and events'}
                </h3>
                {eventMsg && (
                  <p className="day-tools__ok" role="status">
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
                      await saveEvent(draftToEvent(d, eventForm.event?.id ?? newId('ev')))
                      setEventForm(null)
                      setEventMsg(eventForm.event ? 'Event saved.' : 'Event added. Students can see it now.')
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
                isStaff={isStaff}
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
