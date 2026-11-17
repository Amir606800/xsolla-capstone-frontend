import { useState } from 'react'
import { Icon } from '../../../components/Icon'

/**
 * Admin: a password shown once more with a Copy button, so it can be handed over. Used after a password was reset and
 * after an account was created.
 */
export function PasswordHandover({
  name,
  label,
  headline,
  hint,
  password,
  onDone,
}: {
  /** Whose password it is (names the group for screen readers). */
  name: string
  /** The field's label: "New password" or "Password". */
  label: string
  /** What happened, next to the check mark. */
  headline: string
  hint: string
  password: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <div className="admin-dialog" role="group" aria-label={`${label} for ${name}`}>
      <p className="admin-reset__done" role="status">
        <Icon name="check" size={18} /> {headline}
      </p>
      <div className="admin-field">
        <span className="admin-field__label">{label}</span>
        <div className="admin-pw-row">
          <code className="admin-reset__password" aria-label={label}>
            {password}
          </code>
          <button type="button" className="admin-btn" onClick={copy}>
            <Icon name={copied === 'yes' ? 'check' : 'copy'} size={16} /> {copied === 'yes' ? 'Copied' : 'Copy'}
          </button>
        </div>
        {copied === 'no' && <span className="admin-field__error">It could not be copied: select it and copy it by hand.</span>}
      </div>
      <p className="admin-hint">{hint}</p>
      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn admin-btn--primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}
