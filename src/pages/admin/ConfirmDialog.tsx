import { useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from '../../components/Modal'

/** "Are you sure?" for the admin's destructive actions. Stays open with the error if the action fails. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
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
    <Modal open={open} onClose={close} title={title} initialFocus=".admin-confirm__cancel">
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
          <button type="button" className="admin-btn admin-btn--danger" onClick={confirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
