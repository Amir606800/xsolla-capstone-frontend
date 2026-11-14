import { useState } from 'react'
import type { CalendarEvent } from '../../types/calendar'
import type { CourseModule } from '../../types/course'
import { EVENT_KINDS, eventToDraft, hasErrors, validateEvent } from '../../utils/authoring'
import { canHaveMeeting, JOIN_OPENS_MINUTES } from '../../utils/meeting'
import type { EditableKind, EventDraft } from '../../utils/authoring'
import { Field, FormActions } from './Field'
import { GoogleSyncField } from './GoogleSyncField'
import { useSave } from './useSave'

/** Add or change a lecture, meeting or off-campus day. A lecturer (`lectureOnly`) can only write lectures; an admin writes any. */
export function EventForm({
  event,
  dayKey,
  modules,
  onSave,
  onCancel,
  lectureOnly = false,
}: {
  event?: CalendarEvent
  dayKey: string
  modules: CourseModule[]
  onSave: (draft: EventDraft) => Promise<void>
  onCancel: () => void
  /** No choice of type: everything saved here is a lecture. */
  lectureOnly?: boolean
}) {
  const [d, setD] = useState<EventDraft>(() => ({ ...eventToDraft(event, dayKey), ...(lectureOnly ? { kind: 'lecture' as const } : {}) }))
  const { touched, busy, error, submit } = useSave()
  const errors = validateEvent(d)
  const set = (patch: Partial<EventDraft>) => setD((prev) => ({ ...prev, ...patch }))

  return (
    <form
      className="form form--inset"
      noValidate
      aria-label={`${event ? 'Edit' : 'New'} ${lectureOnly ? 'lecture' : 'event'}`}
      onSubmit={(e) => {
        e.preventDefault()
        submit(hasErrors(errors), () => onSave(d))
      }}
    >
      <div className="form__row">
        <Field label="Title" error={touched ? errors.title : undefined}>
          {(p) => <input {...p} className="field__input form__input" value={d.title} onChange={(e) => set({ title: e.target.value })} />}
        </Field>
        {!lectureOnly && (
          <Field label="Type">
            {(p) => (
              <select {...p} className="field__input form__input" value={d.kind} onChange={(e) => set({ kind: e.target.value as EditableKind })}>
                {EVENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </div>

      <div className="form__row">
        <Field label="Day" error={touched ? errors.date : undefined}>
          {(p) => <input {...p} type="date" className="field__input form__input" value={d.date} onChange={(e) => set({ date: e.target.value })} />}
        </Field>
        <label className="form__check">
          <input type="checkbox" checked={d.allDay} onChange={(e) => set({ allDay: e.target.checked })} /> All day
        </label>
      </div>

      {!d.allDay && (
        <div className="form__row">
          <Field label="Starts" error={touched ? errors.time : undefined}>
            {(p) => <input {...p} type="time" className="field__input form__input" value={d.start} onChange={(e) => set({ start: e.target.value })} />}
          </Field>
          <Field label="Ends">
            {(p) => <input {...p} type="time" className="field__input form__input" value={d.end} onChange={(e) => set({ end: e.target.value })} />}
          </Field>
        </div>
      )}

      <Field label="Where" optional>
        {(p) => <input {...p} className="field__input form__input" value={d.location} onChange={(e) => set({ location: e.target.value })} />}
      </Field>
      {canHaveMeeting(d.kind) && (
        <Field
          label="Meeting link"
          optional
          error={touched ? errors.meetingUrl : undefined}
          hint={`Students see a Join button from ${JOIN_OPENS_MINUTES} minutes before the start, and get a notification when you add it. For Google Meet: https://meet.google.com/abc-defg-hij`}
        >
          {(p) => (
            <input
              {...p}
              type="url"
              inputMode="url"
              autoComplete="off"
              className="field__input form__input"
              placeholder="https://meet.google.com/…"
              value={d.meetingUrl}
              onChange={(e) => set({ meetingUrl: e.target.value })}
            />
          )}
        </Field>
      )}
      <Field label="Module" optional hint="Students get a link to the module's materials.">
        {(p) => (
          <select {...p} className="field__input form__input" value={d.moduleId} onChange={(e) => set({ moduleId: e.target.value })}>
            <option value="">No module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                Module {m.position} · {m.title}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Details" optional>
        {(p) => (
          <textarea {...p} className="field__input form__textarea" rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} />
        )}
      </Field>
      <GoogleSyncField event={event} checked={d.syncToGoogle} onChange={(on) => set({ syncToGoogle: on })} />
      <FormActions submitLabel={`${event ? 'Save' : 'Add'} ${lectureOnly ? 'lecture' : 'event'}`} busy={busy} error={error} onCancel={onCancel} />
    </form>
  )
}
