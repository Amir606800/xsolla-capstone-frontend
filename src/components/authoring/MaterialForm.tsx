import { useState } from 'react'
import type { ResourceItem } from '../../types/course'
import { MATERIAL_KINDS, hasErrors, materialToDraft, validateMaterial } from '../../utils/authoring'
import type { MaterialDraft } from '../../utils/authoring'
import { formatBytes } from '../../utils/files'
import { Field, FormActions } from './Field'
import { useSave } from './useSave'

export function MaterialForm({
  item,
  onSave,
  onCancel,
}: {
  item?: ResourceItem
  onSave: (draft: MaterialDraft) => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState<MaterialDraft>(() => materialToDraft(item))
  const { touched, busy, error, submit } = useSave()
  const errors = validateMaterial(d)
  const set = (patch: Partial<MaterialDraft>) => setD((prev) => ({ ...prev, ...patch }))
  const isLink = d.kind === 'link'

  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit(hasErrors(errors), () => onSave(d))
      }}
    >
      <Field label="Title" error={touched ? errors.title : undefined}>
        {(p) => <input {...p} className="field__input form__input" value={d.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>
      <Field label="Type">
        {(p) => (
          <select {...p} className="field__input form__input" value={d.kind} onChange={(e) => set({ kind: e.target.value as MaterialDraft['kind'] })}>
            {MATERIAL_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      {isLink ? (
        <Field label="Link" error={touched ? errors.url : undefined} hint="An external source, e.g. documentation or a video.">
          {(p) => (
            <input
              {...p}
              type="url"
              inputMode="url"
              placeholder="https://"
              className="field__input form__input"
              value={d.url}
              onChange={(e) => set({ url: e.target.value })}
            />
          )}
        </Field>
      ) : (
        <Field
          label="File"
          error={touched ? errors.file : undefined}
          hint={d.file ? `Current file: ${d.file.name} (${formatBytes(d.file.sizeBytes)})` : 'Slides, notes or an archive.'}
        >
          {(p) => (
            <input
              {...p}
              type="file"
              className="form__file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) set({ file: { name: f.name, sizeBytes: f.size } })
              }}
            />
          )}
        </Field>
      )}

      <Field label="Description" optional>
        {(p) => <input {...p} className="field__input form__input" value={d.description} onChange={(e) => set({ description: e.target.value })} />}
      </Field>
      <FormActions submitLabel={item ? 'Save material' : 'Add material'} busy={busy} error={error} onCancel={onCancel} />
    </form>
  )
}
