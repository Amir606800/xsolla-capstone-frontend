import { useState } from 'react'
import type { AssignmentItem, CourseModule } from '../../types/course'
import { defaultDue, hasErrors, taskToDraft, taskWarnings, validateTask } from '../../utils/authoring'
import type { TaskDraft } from '../../utils/authoring'
import { Icon } from '../Icon'
import { Field, FormActions } from './Field'
import { useSave } from './useSave'

export function TaskForm({
  module,
  item,
  now,
  onSave,
  onCancel,
}: {
  module: CourseModule
  item?: AssignmentItem
  now: Date
  onSave: (draft: TaskDraft) => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState<TaskDraft>(() => taskToDraft(item, now))
  const { touched, busy, error, submit } = useSave()
  const errors = validateTask(d)
  const warnings = taskWarnings(d, module, now)
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
      <fieldset className="form__group">
        <legend className="field__label">Due</legend>
        <div className="form__row">
          <Field label="Date" error={touched ? errors.due : undefined}>
            {(p) => <input {...p} type="date" className="field__input form__input" value={d.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />}
          </Field>
          <Field label="Time">
            {(p) => <input {...p} type="time" className="field__input form__input" value={d.dueTime} onChange={(e) => set({ dueTime: e.target.value })} />}
          </Field>
        </div>
        {!item && (
          <p className="form__hint">
            Set by default to Friday 8:00 AM {defaultDue(now).nextWeek ? 'of next week' : 'of this week'}. Change it if the task is due another time.
          </p>
        )}
      </fieldset>
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
