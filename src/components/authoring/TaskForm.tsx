import { useState } from 'react'
import type { AssignmentItem, CourseModule } from '../../types/course'
import { hasErrors, taskToDraft, taskWarnings, validateTask } from '../../utils/authoring'
import { weekDeadlineText } from '../../utils/deadline'
import type { TaskDraft } from '../../utils/authoring'
import { Icon } from '../Icon'
import { Field, FormActions } from './Field'
import { useSave } from './useSave'

export function TaskForm({
  module,
  item,
  onSave,
  onCancel,
}: {
  module: CourseModule
  item?: AssignmentItem
  /** Kept for the callers; a task has no deadline of its own, so the form needs no clock. */
  now?: Date
  onSave: (draft: TaskDraft) => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState<TaskDraft>(() => taskToDraft(item))
  const { touched, busy, error, submit } = useSave()
  const errors = validateTask(d)
  const warnings = taskWarnings(module)
  const due = weekDeadlineText(module)
  const set = (patch: Partial<TaskDraft>) => setD((prev) => ({ ...prev, ...patch }))
  const hasWork = item?.submission !== undefined

  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit(hasErrors(errors), () => onSave(d))
      }}
    >
      {hasWork && (
        <p className="form__note">
          <Icon name="alert" size={16} /> Students already handed in work for this task. Their work stays when you edit
          it.
        </p>
      )}
      <Field label="Title" error={touched ? errors.title : undefined}>
        {(p) => <input {...p} className="field__input form__input" value={d.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>
      <Field label="What to do" optional>
        {(p) => (
          <textarea {...p} className="field__input form__textarea" rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} />
        )}
      </Field>
      <Field label="What to hand in" optional hint="One requirement per line. Students see them as a checklist.">
        {(p) => (
          <textarea {...p} className="field__input form__textarea" rows={3} value={d.requirements} onChange={(e) => set({ requirements: e.target.value })} />
        )}
      </Field>
      {due && (
        <p className="form__hint">
          <Icon name="clock" size={16} /> No deadline to set: each student's work is due at 08:00 on the day of their 1:1 ({due}). Work
          handed in later is still accepted, marked late, and makes the student's week red.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="form__warnings" aria-label="Please check">
          {warnings.map((w) => (
            <li key={w}>
              <Icon name="alert" size={16} /> {w}
            </li>
          ))}
        </ul>
      )}
      <FormActions submitLabel={item ? 'Save task' : 'Add task'} busy={busy} error={error} onCancel={onCancel} />
    </form>
  )
}
