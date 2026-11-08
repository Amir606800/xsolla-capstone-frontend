import type { SchoolUser } from '../../../types/admin'
import { roleBadges } from '../../../utils/adminRoles'

/** Someone's staff roles in a table cell: the main role first, then the extra one ("+ Lecturer until Dec 1"). */
export function RolePills({ user, now }: { user: SchoolUser; now: Date }) {
  return (
    <span className="admin-roles-cell">
      {roleBadges(user, now).map((b) => (
        <span
          key={b.role}
          className={`admin-pill admin-pill--role${b.endingSoon ? ' admin-pill--hidden' : ''}`}
          title={b.main ? 'Main role' : `Extra role${b.detail ? `, ${b.detail}` : ''}`}
        >
          {b.main ? '' : '+ '}
          {b.label}
          {b.detail && <span className="admin-pill__detail"> {b.detail}</span>}
        </span>
      ))}
    </span>
  )
}
