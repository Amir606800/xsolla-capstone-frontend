import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { SubmitPayload } from '../../api/courses'
import type { AssignmentItem, SubmissionFile } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { ALLOWED_EXTENSIONS, formatBytes, MAX_FILE_BYTES, validateFile } from '../../utils/files'
import { DUE_FROM_TEXT, isOverdue, LATE_RULE } from '../../utils/deadline'
import { FileDropzone, PickedFiles } from '../FileDropzone'
import { GradedPill } from '../GradedPill'
import { Icon } from '../Icon'
import { LatePill } from '../LatePill'
import { EarlierVersions, FileList } from './SubmissionVersions'
import { serverNow } from '../../utils/serverTime'

interface SubmissionPanelProps {
  assignment: AssignmentItem
  onSubmit: (assignmentId: string, payload: SubmitPayload) => Promise<void>
  /** Decides whether the deadline has passed (defaults to the moment of rendering). */
  now?: Date
}

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')
/** At most this many files in one version. */
export const MAX_FILES = 10

const fileKey = (f: { name: string; size?: number; sizeBytes?: number }) => `${f.name}:${f.size ?? f.sizeBytes}`

/**
 * A student's work on one task. They hand in as many versions as they like, each with a note or link and several files;
 * the files of the current version can be carried over to the next one. Every earlier version stays listed. Handing in
 * stays open after the deadline (08:00 on the day of their 1:1): late work is accepted, marked as a late submission, and
 * it makes the week grade red. Only graded work is final.
 */
export function SubmissionPanel({ assignment, onSubmit, now }: SubmissionPanelProps) {
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
  // the deadline has passed: handing in still works, but it will be late
  const pastDue = !graded && isOverdue(assignment, now ?? serverNow())
  const history = submission?.history ?? []
  const versions = submission ? history.length + 1 : 0
  const canSubmit = (text.trim().length > 0 || files.length > 0 || keep.length > 0) && !busy && !graded

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
    } catch {
      setError('Something went wrong while submitting. Please try again.')
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
              {submission.late && <LatePill />}
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

      {submission?.late && (
        <p className="submission__late" role="note">
          <Icon name="alert" size={16} />
          This work was handed in after your deadline{assignment.dueAt ? ` (${formatDateTime(assignment.dueAt)})` : ''}, so it is
          a late submission and your week grade is red.
        </p>
      )}

      {!graded && (
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
            {pastDue ? (
              <p className="submission__late" role="note">
                <Icon name="alert" size={16} />
                Your deadline ({formatDateTime(assignment.dueAt as string)}) has passed. You can still hand in, but it will be a
                late submission and your week grade becomes red.
              </p>
            ) : (
              <p className="submission__hint">
                {assignment.dueAt
                  ? `Due ${formatDateTime(assignment.dueAt)}${assignment.dueFrom ? ` (${DUE_FROM_TEXT[assignment.dueFrom]})` : ''}. You can hand in a new version as often as you like. ${LATE_RULE}`
                  : 'No deadline yet. You can hand in a new version as often as you like.'}
                {submission && ' Earlier versions stay listed above.'}
              </p>
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
                {submission?.late ? 'Your work was submitted, as a late submission.' : 'Your work was submitted.'}
              </p>
            )}

            <button type="submit" className="btn submission__submit" disabled={!canSubmit}>
              <Icon name="upload" size={18} />
              {busy
                ? 'Submitting…'
                : submission
                  ? pastDue
                    ? 'Hand in new version late'
                    : 'Hand in new version'
                  : pastDue
                    ? 'Submit late'
                    : 'Submit'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
