import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import type { SubmitPayload } from '../../api/courses'
import type { AssignmentItem } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { ALLOWED_EXTENSIONS, formatBytes, validateFile } from '../../utils/files'
import { GradedPill } from '../GradedPill'
import { Icon } from '../Icon'

interface SubmissionPanelProps {
  assignment: AssignmentItem
  onSubmit: (assignmentId: string, payload: SubmitPayload) => Promise<void>
}

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

export function SubmissionPanel({ assignment, onSubmit }: SubmissionPanelProps) {
  const { submission } = assignment
  const uid = useId()
  const [text, setText] = useState(submission?.textBody ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  const graded = submission?.gradedAt !== undefined
  const canSubmit = (text.trim().length > 0 || files.length > 0) && !busy && !graded

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow picking the same file again after removing it
    addFiles(picked)
  }

  // Drag & drop. dragenter/dragleave also fire for child elements, so count
  // the depth instead of toggling on every event (avoids flicker).
  function hasFiles(e: DragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files')
  }
  function handleDragEnter(e: DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  function handleDragOver(e: DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault() // required to allow dropping
    e.dataTransfer.dropEffect = 'copy'
  }
  function handleDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  function handleDrop(e: DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault() // stops the browser from opening the file
    dragDepth.current = 0
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function addFiles(picked: File[]) {
    const errors: string[] = []
    const accepted: File[] = []
    for (const f of picked) {
      const problem = validateFile(f)
      if (problem) errors.push(problem)
      else accepted.push(f)
    }
    setFileErrors(errors)
    setDone(false)
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`))
      return [...prev, ...accepted.filter((f) => !seen.has(`${f.name}:${f.size}`))]
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError('')
    setDone(false)
    try {
      await onSubmit(assignment.id, { textBody: text.trim(), files })
      setFiles([])
      setDone(true)
    } catch {
      setError('Something went wrong while submitting. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="submission">
      {submission && (
        <div className="submission__current">
          <p className="submission__line">
            <Icon name="check" size={16} /> Submitted {formatDateTime(submission.submittedAt)}
          </p>
          {submission.textBody && <p className="submission__text">{submission.textBody}</p>}
          {submission.files && submission.files.length > 0 && (
            <ul className="submission__files" aria-label="Submitted files">
              {submission.files.map((f) => (
                <li key={f.name}>
                  <Icon name="file" size={16} /> {f.name} <span>{formatBytes(f.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          )}
          {graded && (
            <div className="submission__grade">
              <GradedPill />
              {submission.feedback && <p>&ldquo;{submission.feedback}&rdquo;</p>}
            </div>
          )}
          {/* tasks are not graded any more: the mentor may simply leave a comment */}
          {!graded && submission.feedback && (
            <div className="submission__comment">
              <p className="submission__comment-head">
                <Icon name="user" size={14} /> Comment from your mentor
              </p>
              <p>&ldquo;{submission.feedback}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Graded work is final: no form, nothing to change. */}
      {graded && (
        <p className="submission__locked">
          <Icon name="lock" size={16} />
          This task has been graded, so it can no longer be changed.
        </p>
      )}

      {!graded && (
      <form onSubmit={handleSubmit} noValidate>
        <h4 className="submission__title">{submission ? 'Resubmit your work' : 'Submit your work'}</h4>
        {submission && (
          <p className="submission__hint">Resubmitting replaces your previous submission until it is graded.</p>
        )}

        <label className="field__label" htmlFor={`${uid}-text`}>
          Answer or link
        </label>
        <textarea
          id={`${uid}-text`}
          className="field__input submission__textarea"
          rows={4}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDone(false)
          }}
          placeholder="Paste a repository link or write a short note"
        />

        <label className="field__label" htmlFor={`${uid}-files`}>
          Files <span className="submission__muted">({ALLOWED_EXTENSIONS.join(', ')}, up to 50 MB each)</span>
        </label>
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          role="group"
          aria-label="File drop area"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Icon name="upload" size={24} />
          <span className="dropzone__text">
            {dragging ? 'Drop to add the files' : 'Drag & drop files here, or click to browse'}
          </span>
          {/* The real input covers the zone, so clicking and keyboard use still work. */}
          <input
            id={`${uid}-files`}
            className="dropzone__input"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={handleFiles}
          />
        </div>

        {fileErrors.length > 0 && (
          <ul className="submission__errors" role="alert">
            {fileErrors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <ul className="submission__files" aria-label="Files to upload">
            {files.map((f) => (
              <li key={`${f.name}:${f.size}`}>
                <Icon name="file" size={16} /> {f.name} <span>{formatBytes(f.size)}</span>
                <button
                  type="button"
                  className="submission__remove"
                  onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                  aria-label={`Remove ${f.name}`}
                >
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="submission__done" role="status">
            Your work was submitted.
          </p>
        )}

        <button type="submit" className="btn submission__submit" disabled={!canSubmit}>
          <Icon name="upload" size={18} />
          {busy ? 'Submitting…' : submission ? 'Resubmit' : 'Submit'}
        </button>
      </form>
      )}
    </div>
  )
}
