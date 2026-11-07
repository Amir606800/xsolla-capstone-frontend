import { useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from '../../components/Modal'

/** "Are you sure?" for the admin's bigger actions. Stays open with the error if the action fails. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel = 'Deleting…',
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  /** Shown on the button while it works. */
  busyLabel?: string
  /** Red for what cannot be undone, the normal colour for what can. */
  tone?: 'danger' | 'primary'
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function close() {
    if (busy) return
    setError('')
    onClose()
  }

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      setBusy(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title={title} initialFocus=".admin-confirm__cancel" size="sm">
      <div className="admin-confirm">
        <div className="admin-confirm__text">{children}</div>
        {error && (
          <p className="admin-field__error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-confirm__actions">
          <button type="button" className="admin-btn admin-confirm__cancel" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`admin-btn admin-btn--${tone}`} onClick={confirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
