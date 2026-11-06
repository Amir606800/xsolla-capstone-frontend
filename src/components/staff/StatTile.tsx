import type { ReactNode } from 'react'
import { Link } from 'react-router'
import './staff.css'

/** One summary number at the top of the staff dashboard; the whole tile is a link when `to` is set. */
export function StatTile({
  id,
  label,
  value,
  sub,
  to,
  tone,
}: {
  id: string
  label: string
  value: ReactNode
  sub?: ReactNode
  to?: string
  tone?: 'ok' | 'warn'
}) {
  const body = (
    <>
      <h2 id={id} className="stat__label">
        {label}
      </h2>
      <p className={`stat__value${tone ? ` is-${tone}` : ''}`}>{value}</p>
      {sub && <p className="stat__sub">{sub}</p>}
    </>
  )
  return (
    <section className="stat" aria-labelledby={id}>
      {to ? (
        <Link to={to} className="stat__body">
          {body}
        </Link>
      ) : (
        <div className="stat__body">{body}</div>
      )}
    </section>
  )
}
