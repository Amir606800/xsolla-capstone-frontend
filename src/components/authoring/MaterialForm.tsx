import { useId, useState } from 'react'
import type { ResourceItem } from '../../types/course'
import { MATERIAL_KINDS, hasErrors, materialKindOf, materialToDraft, validateMaterial } from '../../utils/authoring'
import type { MaterialDraft } from '../../utils/authoring'
import { ALLOWED_EXTENSIONS, ALLOWED_TYPES_TEXT, extensionOf, formatBytes, MAX_FILE_BYTES, validateFile } from '../../utils/files'
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
  const maxSize = formatBytes(MAX_FILE_BYTES).replace('.0 ', ' ')
  const sourceLabel = useId()

  function pick(files: File[]) {
    const f = files[0]
    const problem = validateFile(f)
    const wrongType = !(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(f.name))
    setPickProblem(
      problem
        ? wrongType
          ? `“${f.name}” can't be added: a material must be a ${ALLOWED_TYPES_TEXT} file.`
          : `“${f.name}” is too big: a file can be at most ${maxSize}.`
        : '',
    )
    // the kind comes from the file itself (pdf, pptx, md or zip), not from a list
    if (!problem) set({ file: { name: f.name, sizeBytes: f.size }, upload: f, kind: materialKindOf(f.name) })
  }

  // File or Link: a file keeps the kind of the file already chosen
  const choose = (link: boolean) => {
    setPickProblem('')
    set({ kind: link ? 'link' : d.file ? materialKindOf(d.file.name) : 'pdf' })
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
      <div className="form__field">
        <span className="field__label" id={sourceLabel}>
          Material
        </span>
        <div className="view-toggle" role="group" aria-labelledby={sourceLabel}>
          <button type="button" className={`view-toggle__btn${isLink ? '' : ' is-active'}`} aria-pressed={!isLink} onClick={() => choose(false)}>
            File
          </button>
          <button type="button" className={`view-toggle__btn${isLink ? ' is-active' : ''}`} aria-pressed={isLink} onClick={() => choose(true)}>
            Link
          </button>
        </div>
      </div>

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
          hint={`Allowed: ${ALLOWED_TYPES_TEXT}, up to ${maxSize}. Other files can't be added.${
            d.file ? ` This one is: ${MATERIAL_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind}.` : ''
          }`}
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
