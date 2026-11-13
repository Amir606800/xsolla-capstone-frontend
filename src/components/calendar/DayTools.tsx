import { useEffect, useId, useRef } from 'react'
import type { CalendarEvent } from '../../types/calendar'
import type { CourseModule } from '../../types/course'
import type { EventDraft } from '../../utils/authoring'
import { EventForm } from '../authoring/EventForm'
import { Icon } from '../Icon'
import type { Notice } from './DayPanel'
import { AvailabilityForm } from './Slots'
import type { SlotActions } from './Slots'

/** What is open for adding: the event form (new or an existing event), or the 1:1 times form. */
export type Tool = { kind: 'event'; event?: CalendarEvent } | { kind: 'slots' }

/**
 * The "add" buttons of the day panel, in its header so they are always in view (however many events the day has and
 * however far the panel is scrolled): one per kind of thing the role can add. Staff only.
 */
export function DayActions({
  canAddEvents,
  canAddSlots,
  tool,
  onTool,
  onNotice,
}: {
  canAddEvents: boolean
  canAddSlots: boolean
  tool: Tool | null
  onTool: (tool: Tool | null) => void
  onNotice: (notice: Notice | null) => void
}) {
  if (!canAddEvents && !canAddSlots) return null
  const open = (next: Tool) => {
    onNotice(null)
    onTool(next)
  }
  return (
    <div className="day-actions" role="group" aria-label="Add to this day">
      {canAddEvents && (
        <button
          type="button"
          className="btn btn--small day-actions__btn"
          aria-label="Add a lecture or event"
          aria-pressed={tool?.kind === 'event' && !tool.event}
          title="A lecture, meeting or off-campus day. Students see it on their calendar."
          onClick={() => open({ kind: 'event' })}
        >
          <Icon name="plus" size={16} /> Lecture or event
        </button>
      )}
      {canAddSlots && (
        <button
          type="button"
          className="btn btn--small day-actions__btn"
          aria-label="Add 1:1 times"
          aria-pressed={tool?.kind === 'slots'}
          title="Say when you are free. Your students book a slot."
          onClick={() => open({ kind: 'slots' })}
        >
          <Icon name="plus" size={16} /> 1:1 times
        </button>
      )}
    </div>
  )
}

function titleOf(tool: Tool): string {
  if (tool.kind === 'slots') return 'Add 1:1 times'
  return tool.event ? 'Edit event' : 'New lecture or event'
}

/** The form of the open tool, right under the panel's header (also when "Edit" was pressed on an event far below). */
export function DayForm({
  dayKey,
  now,
  tool,
  onTool,
  modules,
  slotActions,
  onSaveEvent,
  onNotice,
}: {
  /** The day, as YYYY-MM-DD. */
  dayKey: string
  now: Date
  tool: Tool | null
  onTool: (tool: Tool | null) => void
  modules: CourseModule[]
  slotActions: SlotActions
  onSaveEvent: (draft: EventDraft, editing?: CalendarEvent) => Promise<void>
  onNotice: (notice: Notice | null) => void
}) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)

  // opening a form brings it into view (the panel may be scrolled, or lower than the screen on a phone)
  useEffect(() => {
    if (tool) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [tool])

  if (!tool) return null
  return (
    <section ref={ref} className="day-panel__part day-form" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="day-panel__heading">
        {titleOf(tool)}
      </h3>

      {tool.kind === 'event' && (
        <EventForm
          key={tool.event?.id ?? 'new'}
          event={tool.event}
          dayKey={dayKey}
          modules={modules}
          onCancel={() => onTool(null)}
          onSave={(draft) => onSaveEvent(draft, tool.event)}
        />
      )}

      {tool.kind === 'slots' && (
        <AvailabilityForm
          dayKey={dayKey}
          now={now}
          actions={slotActions}
          onMessage={onNotice}
          onDone={() => onTool(null)}
          onCancel={() => onTool(null)}
        />
      )}
    </section>
  )
}
