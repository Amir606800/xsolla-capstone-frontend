import { useEffect, useId, useRef } from 'react'
import type { CalendarEvent } from '../../types/calendar'
import type { CourseModule } from '../../types/course'
import type { EventDraft } from '../../utils/authoring'
import { EventForm } from '../authoring/EventForm'
import { Icon } from '../Icon'
import type { Notice } from './DayPanel'
import { AvailabilityForm } from './Slots'
import type { SlotActions } from './Slots'

/** What is open in the "add" part of the day panel: the event form (new or an existing event), or the 1:1 times form. */
export type Tool = { kind: 'event'; event?: CalendarEvent } | { kind: 'slots' }

interface DayToolsProps {
  /** The day, as YYYY-MM-DD. */
  dayKey: string
  now: Date
  /** Lectures, meetings, off-campus days. */
  canAddEvents: boolean
  /** 1:1 times. */
  canAddSlots: boolean
  tool: Tool | null
  onTool: (tool: Tool | null) => void
  modules: CourseModule[]
  slotActions: SlotActions
  onSaveEvent: (draft: EventDraft, editing?: CalendarEvent) => Promise<void>
  onNotice: (notice: Notice | null) => void
}

function titleOf(tool: Tool | null): string {
  if (!tool) return 'Add to this day'
  if (tool.kind === 'slots') return 'Add 1:1 times'
  return tool.event ? 'Edit event' : 'New lecture or event'
}

/** Part 2 of the day panel: everything the signed-in role can add or change on the selected day. */
export function DayTools({ dayKey, now, canAddEvents, canAddSlots, tool, onTool, modules, slotActions, onSaveEvent, onNotice }: DayToolsProps) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)

  // opening a form (also from "Edit" on an event far above) brings it into view on small screens
  useEffect(() => {
    if (tool) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [tool])

  if (!canAddEvents && !canAddSlots) return null

  return (
    <section ref={ref} className="day-panel__part day-tools" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="day-panel__heading">
        {titleOf(tool)}
      </h3>

      {!tool && (
        <ul className="day-tools__choices">
          {canAddEvents && (
            <li>
              <button
                type="button"
                className="day-tools__choice"
                aria-label="Add a lecture or event"
                aria-describedby={`${id}-event`}
                onClick={() => {
                  onNotice(null)
                  onTool({ kind: 'event' })
                }}
              >
                <Icon name="plus" size={18} />
                <span className="day-tools__choice-text">
                  <strong>Lecture or event</strong>
                  <span id={`${id}-event`}>A lecture, meeting or off-campus day. Students see it on their calendar.</span>
                </span>
              </button>
            </li>
          )}
          {canAddSlots && (
            <li>
              <button
                type="button"
                className="day-tools__choice"
                aria-label="Add 1:1 times"
                aria-describedby={`${id}-slots`}
                onClick={() => {
                  onNotice(null)
                  onTool({ kind: 'slots' })
                }}
              >
                <Icon name="plus" size={18} />
                <span className="day-tools__choice-text">
                  <strong>1:1 times</strong>
                  <span id={`${id}-slots`}>Say when you are free. Your students book a slot.</span>
                </span>
              </button>
            </li>
          )}
        </ul>
      )}

      {tool?.kind === 'event' && (
        <EventForm
          key={tool.event?.id ?? 'new'}
          event={tool.event}
          dayKey={dayKey}
          modules={modules}
          onCancel={() => onTool(null)}
          onSave={(draft) => onSaveEvent(draft, tool.event)}
        />
      )}

      {tool?.kind === 'slots' && (
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
