import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { SubmitPayload } from '../../api/courses'
import type { AssignmentItem, SubmissionFile } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { ALLOWED_EXTENSIONS, formatBytes, MAX_FILE_BYTES, validateFile } from '../../utils/files'
import { DEADLINE_PASSED, isPastDue } from '../../utils/progress'
import { FileDropzone, PickedFiles } from '../FileDropzone'
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
      {/* what the student handed in: the answer, the files, the earlier versions */}
      {submission && (
        <section className="abox abox--work" aria-labelledby={`${uid}-work`}>
          <header className="abox__head">
            <span className="abox__icon">
              <Icon name="file" size={14} />
            </span>
            <h4 id={`${uid}-work`} className="abox__title">
              Your submission
            </h4>
            <p className="submission__line abox__aside">
              <Icon name="check" size={16} /> Submitted {formatDateTime(submission.submittedAt)}
              {versions > 1 && <span className="submission__version-tag">version {versions}</span>}
            </p>
          </header>
          <div className="abox__body">
            {submission.textBody && (
              <div className="abox__section">
                <h5 className="abox__label">Your answer</h5>
                <p className="abox__quote">{submission.textBody}</p>
              </div>
            )}
            {submission.files && submission.files.length > 0 && (
              <div className="abox__section">
                <h5 className="abox__label">Files you handed in</h5>
                <FileList files={submission.files} label="Submitted files" />
              </div>
            )}
            {!submission.textBody && !submission.files?.length && (
              <p className="submission__muted">Only the hand-in time was saved.</p>
            )}
            {history.length > 0 && (
              <div className="abox__section">
                <EarlierVersions history={history} total={versions} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* what the mentor or lecturer said; a graded task is final (tasks are otherwise only commented) */}
      {submission && (graded || submission.feedback) && (
        <section className={`abox abox--feedback${graded ? ' is-graded' : ''}`} aria-labelledby={`${uid}-feedback`}>
          <header className="abox__head">
            <span className="abox__icon">
              <Icon name="user" size={14} />
            </span>
            <h4 id={`${uid}-feedback`} className="abox__title">
              {graded ? 'Feedback' : 'Comment from your mentor'}
            </h4>
            {graded && (
              <span className="abox__aside">
                <GradedPill />
              </span>
            )}
          </header>
          <div className="abox__body">
            {submission.feedback ? (
              <p className="abox__quote abox__quote--feedback">&ldquo;{submission.feedback}&rdquo;</p>
            ) : (
              <p className="submission__muted">No comment was left.</p>
            )}
          </div>
        </section>
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
        <section className="abox abox--form" aria-labelledby={`${uid}-form`}>
          <header className="abox__head">
            <span className="abox__icon abox__icon--accent">
              <Icon name="upload" size={14} />
            </span>
            <h4 id={`${uid}-form`} className="abox__title">
              {submission ? 'Hand in a new version' : 'Submit your work'}
            </h4>
          </header>
          <form className="abox__body" onSubmit={handleSubmit} noValidate>
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
                ({ALLOWED_EXTENSIONS.join(', ')}, up to {formatBytes(MAX_FILE_BYTES).replace('.0 ', ' ')} each, {MAX_FILES} files
                at most)
              </span>
            </label>

            <PickedFiles
              kept
              label="Kept from the current version"
              files={keep.map((f) => ({
                key: f.id ?? fileKey(f),
                name: f.name,
                sizeBytes: f.sizeBytes,
                tag: 'kept',
                removeLabel: `Leave out ${f.name}`,
                onRemove: () => setKeep((prev) => prev.filter((x) => x !== f)),
              }))}
            />

            <FileDropzone inputId={`${uid}-files`} accept={ACCEPT} multiple onFiles={addFiles} />

            {fileErrors.length > 0 && (
              <ul className="submission__errors" role="alert">
                {fileErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}

            <PickedFiles
              label="Files to upload"
              files={files.map((f) => ({
                key: fileKey(f),
                name: f.name,
                sizeBytes: f.size,
                onRemove: () => setFiles((prev) => prev.filter((x) => x !== f)),
              }))}
            />

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
        </section>
      )}
    </div>
  )
}
