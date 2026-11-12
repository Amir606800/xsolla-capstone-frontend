import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import type { SubmitPayload } from '../../api/courses'
import type { AssignmentItem, SubmissionFile } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { ALLOWED_EXTENSIONS, formatBytes, MAX_FILE_BYTES, validateFile } from '../../utils/files'
import { DEADLINE_PASSED, isPastDue } from '../../utils/progress'
import { GradedPill } from '../GradedPill'
import { Icon } from '../Icon'
import { EarlierVersions, FileList } from './SubmissionVersions'

interface SubmissionPanelProps {
  assignment: AssignmentItem
  onSubmit: (assignmentId: string, payload: SubmitPayload) => Promise<void>
  /** Decides whether the deadline has passed (defaults to the moment of rendering). */
  now?: Date
  /** When the task's module closes: after it nothing is handed in, the work can only be looked at. */
  closesAt?: string
}

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')
/** At most this many files in one version. */
export const MAX_FILES = 10

const fileKey = (f: { name: string; size?: number; sizeBytes?: number }) => `${f.name}:${f.size ?? f.sizeBytes}`

/**
 * A student's work on one task. Until the deadline they hand in as many versions as they like, each
 * with a note or link and several files; the files of the current version can be carried over to the
 * next one. Every earlier version stays listed. After the deadline (or once graded) it is read-only.
 */
export function SubmissionPanel({ assignment, onSubmit, now, closesAt }: SubmissionPanelProps) {
  const { submission } = assignment
  const uid = useId()
  const [text, setText] = useState(submission?.textBody ?? '')
  const [files, setFiles] = useState<File[]>([])
  // files of the current version that go into the next one too (until the student leaves them out)
  const [keep, setKeep] = useState<SubmissionFile[]>(submission?.files ?? [])
  const [keepFor, setKeepFor] = useState(submission?.submittedAt)
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  // a new version came in: the files to carry over are now that version's files
  if (keepFor !== submission?.submittedAt) {
    setKeepFor(submission?.submittedAt)
    setKeep(submission?.files ?? [])
  }

  const graded = submission?.gradedAt !== undefined
  const closed = !graded && isPastDue(assignment, now ?? new Date(), closesAt)
  // the moment handing in ended: the task's deadline, or the module's closing date when that came first
  const endedAt = closesAt && closesAt < assignment.dueAt ? closesAt : assignment.dueAt
  const history = submission?.history ?? []
  const versions = submission ? history.length + 1 : 0
  const canSubmit = (text.trim().length > 0 || files.length > 0 || keep.length > 0) && !busy && !graded && !closed

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
    const seen = new Set([...files, ...keep].map(fileKey))
    const accepted: File[] = []
    for (const f of picked) {
      const problem = validateFile(f)
      if (problem) errors.push(problem)
      else if (!seen.has(fileKey(f))) {
        seen.add(fileKey(f))
        accepted.push(f)
      }
    }
    const room = MAX_FILES - files.length - keep.length
    if (accepted.length > room) errors.push(`You can hand in up to ${MAX_FILES} files at a time.`)
    setFileErrors(errors)
    setDone(false)
    setFiles((prev) => [...prev, ...accepted.slice(0, Math.max(0, room))])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError('')
    setDone(false)
    try {
      await onSubmit(assignment.id, { textBody: text.trim(), files, keep })
      setFiles([])
      setDone(true)
    } catch (err) {
      setError(
        err instanceof Error && err.message === DEADLINE_PASSED
          ? 'The deadline has passed, so this version was not handed in.'
          : 'Something went wrong while submitting. Please try again.',
      )
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
            {versions > 1 && <span className="submission__version-tag">version {versions}</span>}
          </p>
          {submission.textBody && <p className="submission__text">{submission.textBody}</p>}
          {submission.files && submission.files.length > 0 && <FileList files={submission.files} label="Submitted files" />}
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
          {history.length > 0 && <EarlierVersions history={history} total={versions} />}
        </div>
      )}

      {/* Graded work is final: no form, nothing to change. */}
      {graded && (
        <p className="submission__locked">
          <Icon name="lock" size={16} />
          This task has been graded, so it can no longer be changed.
        </p>
      )}

      {closed && (
        <p className="submission__locked">
          <Icon name="lock" size={16} />
          {submission
            ? `The deadline (${formatDateTime(endedAt)}) has passed, so no new version can be handed in. You can still read what you handed in.`
            : `The deadline (${formatDateTime(endedAt)}) has passed. Nothing was handed in.`}
        </p>
      )}

      {!graded && !closed && (
        <form onSubmit={handleSubmit} noValidate>
          <h4 className="submission__title">{submission ? 'Hand in a new version' : 'Submit your work'}</h4>
          <p className="submission__hint">
            {submission
              ? `You can hand in a new version as often as you like until ${formatDateTime(assignment.dueAt)}. Earlier versions stay listed above.`
              : `Open until ${formatDateTime(assignment.dueAt)}. You can hand in a new version later if you change something.`}
          </p>

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
            Files{' '}
            <span className="submission__muted">
              ({ALLOWED_EXTENSIONS.join(', ')}, up to {formatBytes(MAX_FILE_BYTES).replace('.0 ', ' ')} each, {MAX_FILES} files at most)
            </span>
          </label>

          {keep.length > 0 && (
            <ul className="submission__files submission__files--kept" aria-label="Kept from the current version">
              {keep.map((f) => (
                <li key={f.id ?? fileKey(f)}>
                  <Icon name="file" size={16} /> {f.name} <span>{formatBytes(f.sizeBytes)}</span>
                  <span className="submission__kept-tag">kept</span>
                  <button
                    type="button"
                    className="submission__remove"
                    onClick={() => setKeep((prev) => prev.filter((x) => x !== f))}
                    aria-label={`Leave out ${f.name}`}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

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
                <li key={fileKey(f)}>
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
            {busy ? 'Submitting…' : submission ? 'Hand in new version' : 'Submit'}
          </button>
        </form>
      )}
    </div>
  )
}
