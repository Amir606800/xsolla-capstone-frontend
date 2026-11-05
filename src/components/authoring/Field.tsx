import { useId } from 'react'
import type { ReactNode } from 'react'
import './authoring.css'

export interface FieldProps {
  id: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** A labelled form field with an optional hint and error, wired up for screen readers. */
export function Field({
  label,
  error,
  hint,
  children,
  optional = false,
}: {
  label: string
  error?: string
  hint?: string
  optional?: boolean
  children: (props: FieldProps) => ReactNode
}) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="form__field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="form__optional"> (optional)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p id={`${id}-hint`} className="form__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

/** Cancel + primary button row at the bottom of every lecturer form, plus the save error. */
export function FormActions({
  submitLabel,
  busy,
  error,
  onCancel,
}: {
  submitLabel: string
  busy: boolean
  error?: string
  onCancel: () => void
}) {
  return (
    <>
      {error && (
        <p className="field__error form__save-error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </>
  )
}
