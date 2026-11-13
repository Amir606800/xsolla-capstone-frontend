import { useState } from 'react'
import type { ResourceItem } from '../../types/course'
import { MATERIAL_KINDS, hasErrors, materialToDraft, validateMaterial } from '../../utils/authoring'
import type { MaterialDraft } from '../../utils/authoring'
import { ALLOWED_EXTENSIONS, formatBytes, MAX_FILE_BYTES, validateFile } from '../../utils/files'
import { FileDropzone, PickedFiles } from '../FileDropzone'
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
  // the file this material had before it was edited (kept when a newly picked one is taken back out)
  const original = item?.file
  const [pickProblem, setPickProblem] = useState('')

  function pick(files: File[]) {
    const f = files[0]
    const problem = validateFile(f)
    setPickProblem(problem ?? '')
    if (!problem) set({ file: { name: f.name, sizeBytes: f.size }, upload: f })
  }

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
          error={pickProblem || (touched ? errors.file : undefined)}
          hint={`Slides, notes or an archive: ${ALLOWED_EXTENSIONS.join(', ')}, up to ${formatBytes(MAX_FILE_BYTES).replace('.0 ', ' ')}.`}
        >
          {(p) => (
            <>
              <FileDropzone
                inputId={p.id}
                accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                onFiles={pick}
                idleText={d.file ? 'Drop a file here to replace it, or click to browse' : 'Drag & drop a file here, or click to browse'}
              />
              <PickedFiles
                label="Chosen file"
                files={
                  d.file
                    ? [
                        {
                          key: d.file.name,
                          name: d.file.name,
                          sizeBytes: d.file.sizeBytes,
                          tag: d.upload ? 'new' : 'current',
                          // taking a new file back out brings the earlier one back
                          ...(d.upload
                            ? {
                                removeLabel: `Leave out ${d.file.name}`,
                                onRemove: () => {
                                  setPickProblem('')
                                  set({ upload: undefined, file: original })
                                },
                              }
                            : {}),
                        },
                      ]
                    : []
                }
              />
            </>
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
