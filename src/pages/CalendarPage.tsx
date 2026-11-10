import { useCallback, useMemo, useRef, useState } from 'react'
import { DayPanel } from '../components/calendar/DayPanel'
import type { EventEditing, Notice } from '../components/calendar/DayPanel'
import { DayTools } from '../components/calendar/DayTools'
import type { Tool } from '../components/calendar/DayTools'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { SlotList } from '../components/calendar/Slots'
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
import type { EventDraft } from '../utils/authoring'
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
  // staff: what is open in the "add to this day" part of the panel (null = just the choices)
  const [tool, setTool] = useState<Tool | null>(null)
  // what just happened on the selected day
  const [notice, setNotice] = useState<Notice | null>(null)
  // the panel is below the calendar on narrow screens: bring it into view after picking a day
  const sideRef = useRef<HTMLDivElement>(null)

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
  // everything, for the day panel: the legend filter only changes what the grid shows
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
    const all = slotsOnDay(meetings.slots, selected)
    // students only see times they can still use, or their own booking
    if (!mentor && !student) return []
    return mentor ? all : all.filter((s) => new Date(s.startsAt) > today || s.bookedBy?.id === user?.id)
  }, [selected, meetings.slots, mentor, student, today, user?.id])
  const actions = useMemo(
    () => ({ addWindow: meetings.addWindow, remove: meetings.remove, book: meetings.book, cancel: meetings.cancel }),
    [meetings.addWindow, meetings.remove, meetings.book, meetings.cancel],
  )
  const showSlots = user && meetings.status === 'ready' && daySlots.length > 0
  
  const goToMonth = useCallback(
    (next: Date) => {
      setMonth(next)
      // keep the day panel meaningful: today if we landed on this month, else the 1st
      const isThisMonth = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
      setSelected(dateKey(isThisMonth ? today : next))
    },
    [today],
  )

  const selectDay = useCallback((key: string) => {
    setSelected(key)
    setTool(null)
    setNotice(null)
    sideRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [])
  const selectedDate = useMemo(() => {
    const [y, m, d] = selected.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [selected])
  const { save: saveEvent, remove: removeEvent } = calendar
  const editing = useMemo<EventEditing | undefined>(
    () =>
      author
        ? {
            canEdit: isEditableEvent,
            onEdit: (event) => {
              setNotice(null)
              setTool({ kind: 'event', event })
            },
            onDelete: async (event) => {
              await removeEvent(event.id)
              setTool(null)
              setNotice({ tone: 'ok', text: 'Event deleted.' })
            },
          }
        : undefined,
    [author, removeEvent],
  )
  const saveFromForm = useCallback(
    async (d: EventDraft, existing?: CalendarEvent) => {
      const google = await saveEvent(draftToEvent(d, existing?.id ?? newId('ev')), { syncToGoogle: d.syncToGoogle })
      const result = savedNotice(existing ? 'Event saved.' : 'Event added. Students can see it now.', google)
      setTool(null)
      setNotice({ tone: result.warn ? 'warn' : 'ok', text: result.text })
    },
    [saveEvent],
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
        <div className="calendar__layout">
          <div className="calendar__main">
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

            <MonthGrid month={month} today={today} selected={selected} eventsByDay={eventsByDay} onSelect={selectDay} />
          </div>

          <div className="calendar__side" ref={sideRef}>
            <DayPanel
              date={selectedDate}
              events={allByDay[selected] ?? []}
              now={today}
              notice={notice}
              editing={editing}
              schedule={
                showSlots && (
                  <SlotList
                    slots={daySlots}
                    isMentor={mentor}
                    userId={user.id}
                    booking={booking}
                    now={today}
                    actions={actions}
                    onMessage={setNotice}
                  />
                )
              }
              tools={
                <DayTools
                  dayKey={selected}
                  now={today}
                  canAddEvents={author}
                  canAddSlots={mentor && meetings.status === 'ready'}
                  tool={tool}
                  onTool={setTool}
                  modules={courses.modules}
                  slotActions={actions}
                  onSaveEvent={saveFromForm}
                  onNotice={setNotice}
                />
              }
            />
          </div>
        </div>
      )}
    </section>
  )
}
