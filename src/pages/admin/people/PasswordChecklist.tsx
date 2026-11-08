import { Icon } from '../../../components/Icon'
import { PASSWORD_RULES, passwordProblems } from '../../../utils/credentials'
import type { PasswordOwner } from '../../../utils/credentials'

/** The password rules under a password field, each ticked off as it is met while the admin types. */
export function PasswordChecklist({ id, password, owner }: { id?: string; password: string; owner: PasswordOwner }) {
  const broken = new Set(passwordProblems(password, owner))
  return (
    <ul id={id} className="admin-pw-rules" aria-label="Password rules">
      {PASSWORD_RULES.map((r) => {
        const ok = password.length > 0 && !broken.has(r.id)
        return (
          <li key={r.id} className={ok ? 'is-met' : undefined}>
            <Icon name={ok ? 'check' : 'minus'} size={14} />
            {r.label}
            <span className="sr-only">{ok ? ' (done)' : ' (not yet)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
