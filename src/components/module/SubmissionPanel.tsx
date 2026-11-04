import { useId, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { SubmitPayload } from '../../api/courses'
import type { AssignmentItem } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { ALLOWED_EXTENSIONS, formatBytes, validateFile } from '../../utils/files'
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

  const canSubmit = (text.trim().length > 0 || files.length > 0) && !busy

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow picking the same file again after removing it
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
          {submission.grade !== undefined && (
            <div className="submission__grade">
              <strong>
                Grade: {submission.grade}/{assignment.maxPoints}
              </strong>
              {submission.feedback && <p>&ldquo;{submission.feedback}&rdquo;</p>}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <h4 className="submission__title">{submission ? 'Resubmit your work' : 'Submit your work'}</h4>
        {submission && (
          <p className="submission__hint">Resubmitting replaces your previous submission. Your grade is kept.</p>
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
        <input
          id={`${uid}-files`}
          className="submission__file-input"
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleFiles}
        />

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
    </div>
  )
}
