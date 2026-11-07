import { useState } from 'react'
import type { CourseModule } from '../../types/course'
import { draftToModulePatch, hasErrors, moduleToDraft, validateModule } from '../../utils/authoring'
import type { ModuleDraft } from '../../utils/authoring'
import { Field, FormActions } from './Field'
import { useSave } from './useSave'

export function ModuleForm({
  module,
  onSave,
  onCancel,
  submitLabel = 'Save module',
}: {
  module: CourseModule
  submitLabel?: string
  onSave: (patch: ReturnType<typeof draftToModulePatch>) => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState<ModuleDraft>(() => moduleToDraft(module))
  const { touched, busy, error, submit } = useSave()
  const errors = validateModule(d)
  const show = (k: keyof ModuleDraft) => (touched ? errors[k] : undefined)
  const set = (patch: Partial<ModuleDraft>) => setD((prev) => ({ ...prev, ...patch }))

  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit(hasErrors(errors), () => onSave(draftToModulePatch(d)))
      }}
    >
      <Field label="Title" error={show('title')}>
        {(p) => <input {...p} className="field__input form__input" value={d.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>
      <Field label="Description" optional hint="Shown to students at the top of the module.">
        {(p) => (
          <textarea {...p} className="field__input form__textarea" rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} />
        )}
      </Field>
      <div className="form__row">
        <Field label="Opens on" error={show('opensDate')} hint="Students can see it from the start of this day.">
          {(p) => <input {...p} type="date" className="field__input form__input" value={d.opensDate} onChange={(e) => set({ opensDate: e.target.value })} />}
        </Field>
        <Field label="Closes on" error={show('closesDate')} hint="Until the end of this day.">
          {(p) => <input {...p} type="date" className="field__input form__input" value={d.closesDate} onChange={(e) => set({ closesDate: e.target.value })} />}
        </Field>
      </div>
      <FormActions submitLabel={submitLabel} busy={busy} error={error} onCancel={onCancel} />
    </form>
  )
}
