import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import './authoring.css'

/**
 * One item in a lecturer list with Edit and Delete. Delete asks once more inside the row
 * (no browser dialog), so a slip of the mouse never removes content.
 */
export function EditorRow({
  icon,
  title,
  meta,
  warning,
  onEdit,
  onDelete,
  extra,
  readOnly = false,
}: {
  icon: ReactNode
  title: string
  meta?: ReactNode
  /** Extra line in the confirmation, e.g. "Students' work for it will be hidden too." */
  warning?: string
  onEdit?: () => void
  onDelete: () => Promise<void>
  /** More tools before Edit, e.g. a download button. */
  extra?: ReactNode
  /** Read only: the person may look at it (and download) but not change or delete it. */
  readOnly?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function remove() {
    setBusy(true)
    setError(undefined)
    try {
      await onDelete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
      setBusy(false)
    }
  }

  return (
    <li className="list__row editor-row">
      <span className="editor-row__icon">{icon}</span>
      <div className="editor-row__text">
        <p className="list__title">{title}</p>
        {meta && <p className="list__meta">{meta}</p>}
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
      {readOnly ? (
        extra && <div className="editor-row__tools">{extra}</div>
      ) : confirming ? (
        <div className="editor-row__confirm" role="group" aria-label={`Delete ${title}?`}>
          <span>
            Delete?{warning ? ` ${warning}` : ''}
          </span>
          <button type="button" className="btn btn--danger btn--small" onClick={remove} disabled={busy}>
            Yes, delete
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(false)} disabled={busy}>
            Keep
          </button>
        </div>
      ) : (
        <div className="editor-row__tools">
          {extra}
          {onEdit && (
            <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Edit ${title}`} title="Edit">
              <Icon name="edit" size={18} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${title}`}
            title="Delete"
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      )}
    </li>
  )
}
