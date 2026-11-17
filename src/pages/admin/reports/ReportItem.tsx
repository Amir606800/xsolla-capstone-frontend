import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../../components/Icon'
import type { AdminReport, ReportChange } from '../../../types/report'
import { formatDateTime } from '../../../utils/date'
import { REPORT_ABOUT } from '../../../utils/report'
import { messageBody, readSubject } from '../../../utils/reportInbox'
import { roleLabel } from '../../../utils/roles'
import { ConfirmDialog } from '../ConfirmDialog'

/** The longest note an admin can write on a report (the server's limit). */
const MAX_NOTE = 2000
/** Messages longer than this are folded until "Show all". */
const LONG = 400

/**
 * One report: what it is about, who sent it and when, what they wrote, and what the admin did about it. The admin marks
 * it resolved (or open again), writes a note, or deletes it.
 */
export function ReportItem({
  report: r,
  onChange,
  onDelete,
}: {
  report: AdminReport
  onChange: (change: ReportChange) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const id = useId()
  const heading = readSubject(r.subject)
  const about = REPORT_ABOUT.find((a) => a.key === heading.about)
  const body = messageBody(r.message)
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(r.adminNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const resolved = r.status === 'resolved'

  async function run(change: ReportChange) {
    setBusy(true)
    setError('')
    try {
      await onChange(change)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault()
    if (note.trim().length > MAX_NOTE) {
      setError(`Keep the note under ${MAX_NOTE} characters.`)
      return
    }
    if (await run({ adminNote: note.trim() })) setEditing(false)
  }

  return (
    <li className={`admin-report${resolved ? ' is-resolved' : ''}`} aria-labelledby={`${id}-title`}>
      <header className="admin-report__head">
        <span className="admin-report__about">
          <Icon name={about?.icon ?? 'flag'} size={16} />
          {about ? about.label : 'Report'}
          {heading.who && <strong>{heading.who}</strong>}
        </span>
        <span className={`admin-pill admin-report__status admin-report__status--${r.status}`}>
          {resolved ? 'Resolved' : 'Open'}
        </span>
      </header>

      <h3 id={`${id}-title`} className="admin-report__title">
        {heading.title}
      </h3>
      <p className="admin-muted">
        From{' '}
        {r.reporter ? (
          <>
            <strong className="admin-report__from">{r.reporter.name}</strong>
            {r.reporter.roles?.length ? ` (${roleLabel({ roles: r.reporter.roles })})` : ''}
            {r.reporter.email ? ` · ${r.reporter.email}` : ''}
          </>
        ) : (
          'an account that was deleted'
        )}
        {' · '}
        {formatDateTime(r.createdAt)}
      </p>

      <p className={`admin-report__message${body.length > LONG && !expanded ? ' is-folded' : ''}`}>{body}</p>
      {body.length > LONG && (
        <button
          type="button"
          className="admin-link admin-report__more"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show all'}
        </button>
      )}

      {resolved && (
        <p className="admin-muted admin-report__resolved">
          <Icon name="check" size={14} /> Resolved{r.resolvedBy ? ` by ${r.resolvedBy.name}` : ''}
          {r.resolvedAt ? ` · ${formatDateTime(r.resolvedAt)}` : ''}
        </p>
      )}

      {editing ? (
        <form className="admin-report__note-form" onSubmit={saveNote} noValidate>
          <label className="admin-review__label" htmlFor={`${id}-note`}>
            Admin note
          </label>
          <textarea
            id={`${id}-note`}
            className="admin-field__input admin-report__note-input"
            rows={3}
            value={note}
            placeholder="What was done about it (only admins see this)"
            onChange={(e) => setNote(e.target.value)}
          />
          <p className={`admin-muted admin-report__count${note.trim().length > MAX_NOTE ? ' is-over' : ''}`}>
            {note.trim().length} / {MAX_NOTE}
          </p>
          <div className="admin-report__actions">
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save note'}
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setEditing(false)
                setNote(r.adminNote ?? '')
                setError('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        r.adminNote && (
          <div>
            <p className="admin-review__label">Admin note</p>
            <blockquote className="admin-review__comment">{r.adminNote}</blockquote>
          </div>
        )
      )}

      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}

      {!editing && (
        <div className="admin-report__actions">
          {resolved ? (
            <button type="button" className="admin-btn" disabled={busy} onClick={() => void run({ status: 'open' })}>
              <Icon name="reset" size={16} /> Open again
            </button>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={busy}
              onClick={() => void run({ status: 'resolved' })}
            >
              <Icon name="check" size={16} /> Mark resolved
            </button>
          )}
          <button
            type="button"
            className="admin-btn"
            disabled={busy}
            onClick={() => {
              setNote(r.adminNote ?? '')
              setEditing(true)
            }}
          >
            <Icon name="edit" size={16} /> {r.adminNote ? 'Edit note' : 'Add note'}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger-outline admin-report__delete"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <Icon name="trash" size={16} /> Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this report?"
        confirmLabel="Delete report"
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await onDelete()
          setConfirming(false)
        }}
      >
        <p>
          &ldquo;{heading.title}&rdquo; is removed for good. To keep it but take it off the open list, mark it resolved instead.
        </p>
      </ConfirmDialog>
    </li>
  )
}
