import { useId, useState } from 'react'
import type { WorkRow, WorkStatus } from '../../../utils/review'
import { rowId } from '../../../utils/review'
import { formatDateTime } from '../../../utils/date'
import { DownloadButton } from '../../DownloadButton'
import { Icon } from '../../Icon'
import { EarlierVersions } from '../../module/SubmissionVersions'
import { Avatar } from '../../team/People'

const STATUS: Record<WorkStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'chip chip--review' },
  commented: { label: 'Commented', className: 'chip chip--ok' },
  missing: { label: 'Missing', className: 'chip chip--danger' },
  'not-yet': { label: 'Not handed in yet', className: 'chip' },
}

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * MENTOR: one student's work under a task. Opens to show what they handed in and the mentor's
 * comment, which can be written or changed at any time. Tasks get no grade: only the week does.
 */
export function WorkItem({
  row,
  open,
  onToggle,
  onComment,
}: {
  row: WorkRow
  open: boolean
  onToggle: () => void
  onComment: (text: string) => Promise<void>
}) {
  const { student, submission, status, late } = row
  const id = rowId(row.task.id, student.id)
  const fieldId = useId()
  const existing = submission?.feedback ?? ''
  const [editing, setEditing] = useState(!existing)
  const [text, setText] = useState(existing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) {
      setError('Write a comment first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onComment(text)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the comment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`review${open ? ' is-open' : ''}`} id={id}>
      <div className="review__row">
        <Avatar name={student.name} small />
        <span className="person-row__main">
          <span className="person-row__name">{student.name}</span>
          {submission && (
            <span className="list__meta">
              Handed in {formatDateTime(submission.submittedAt)}
              {late && <span className="review__late"> · late</span>}
            </span>
          )}
        </span>
        <span className={STATUS[status].className}>{STATUS[status].label}</span>
        {submission && (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            aria-label={`Open ${student.name}'s ${row.task.title}`}
            onClick={onToggle}
          >
            Open
            <Icon name="chevron" size={16} />
          </button>
        )}
      </div>

      {open && submission && (
        <div className="review__panel" id={`${id}-panel`}>
          {submission.textBody ? (
            <p className="review__text">{submission.textBody}</p>
          ) : (
            <p className="list__meta">No text, files only.</p>
          )}
          {submission.files && submission.files.length > 0 && (
            <ul className="review__files" aria-label="Files">
              {submission.files.map((f) => (
                <li key={f.name}>
                  <Icon name="file" size={16} />
                  {f.name} <span className="list__meta">({kb(f.sizeBytes)})</span>
                  <DownloadButton variant="icon" file={f} label={`Download ${f.name}`} />
                </li>
              ))}
            </ul>
          )}

          {submission.history && submission.history.length > 0 && (
            <EarlierVersions history={submission.history} total={submission.history.length + 1} />
          )}

          {!editing && existing ? (
            <div className="review__feedback">
              <p className="review__feedback-head">
                Your comment{submission.commentedAt ? ` · ${formatDateTime(submission.commentedAt)}` : ''}
              </p>
              <p className="review__text">{existing}</p>
              <button
                type="button"
                className="btn btn--ghost btn--small review__edit"
                onClick={() => {
                  setText(existing)
                  setEditing(true)
                }}
              >
                <Icon name="edit" size={16} /> Edit comment
              </button>
            </div>
          ) : (
            <form className="review__form" onSubmit={save} noValidate>
              <label className="field__label" htmlFor={fieldId}>
                Comment for {student.name}
              </label>
              <textarea
                id={fieldId}
                className="field__input form__textarea"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${fieldId}-hint`}
              />
              <p id={`${fieldId}-hint`} className="list__meta">
                {student.name} sees this on the task. You can change it later.
              </p>
              {error && (
                <p className="field__error" role="alert">
                  {error}
                </p>
              )}
              <div className="review__actions">
                {existing && (
                  <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)} disabled={busy}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Saving…' : existing ? 'Save comment' : 'Add comment'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  )
}
