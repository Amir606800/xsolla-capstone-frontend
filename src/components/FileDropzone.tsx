import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { formatBytes } from '../utils/files'
import { Icon } from './Icon'
import './file-dropzone.css'

/**
 * Where files are picked, the same everywhere (a student's hand-in, a lecturer's material, an admin's template): drag
 * files onto it, or click it to browse. The real file input covers the zone, so keyboard and screen readers work too.
 * It only hands over what was picked: checking the files and listing them is the caller's job (see `PickedFiles`).
 */
export function FileDropzone({
  inputId,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  idleText,
  hint,
}: {
  inputId: string
  /** The `accept` attribute: extensions like `.pdf,.zip`, or media types. */
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
  idleText?: string
  /** A smaller line under the text, e.g. the allowed types and size. */
  hint?: ReactNode
}) {
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave also fire for child elements, so count the depth instead of toggling on every event
  const depth = useRef(0)

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // the same file can be picked again after it was removed
    if (picked.length) onFiles(multiple ? picked : picked.slice(0, 1))
  }

  return (
    <div
      className={`dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-label="File drop area"
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return
        e.preventDefault()
        depth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return
        e.preventDefault() // required to allow dropping
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        if (disabled || !hasFiles(e)) return
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return
        e.preventDefault() // stops the browser from opening the file
        depth.current = 0
        setDragging(false)
        const dropped = Array.from(e.dataTransfer.files)
        if (dropped.length) onFiles(multiple ? dropped : dropped.slice(0, 1))
      }}
    >
      <Icon name="upload" size={24} />
      <span className="dropzone__text">{dragging ? 'Drop to add the files' : (idleText ?? 'Drag & drop files here, or click to browse')}</span>
      {hint && <span className="dropzone__hint">{hint}</span>}
      <input id={inputId} className="dropzone__input" type="file" multiple={multiple} accept={accept} disabled={disabled} onChange={pick} />
    </div>
  )
}

export interface PickedFile {
  key: string
  name: string
  sizeBytes: number
  /** A small tag after the name, e.g. "kept", "new" or "current". */
  tag?: string
  /** What the remove button says it removes (screen readers); no button when `onRemove` is left out. */
  removeLabel?: string
  onRemove?: () => void
}

/** The files picked so far: name, size, an optional tag and a remove button. */
export function PickedFiles({ files, label, kept = false }: { files: PickedFile[]; label: string; kept?: boolean }) {
  if (files.length === 0) return null
  return (
    <ul className={`submission__files${kept ? ' submission__files--kept' : ''}`} aria-label={label}>
      {files.map((f) => (
        <li key={f.key}>
          <Icon name="file" size={16} /> {f.name} <span>{formatBytes(f.sizeBytes)}</span>
          {f.tag && <span className="submission__kept-tag">{f.tag}</span>}
          {f.onRemove && (
            <button type="button" className="submission__remove" onClick={f.onRemove} aria-label={f.removeLabel ?? `Remove ${f.name}`}>
              <Icon name="close" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
