import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import '../../styles/ui.css'
import '../dashboard/dashboard.css'
import '../calendar/calendar.css'
import '../../pages/lecturer/lecturer.css'
import './staff.css'

/** The card frame every staff dashboard section uses. */
export function StaffCard({
  id,
  icon,
  title,
  children,
  action,
}: {
  id: string
  icon: IconName
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="card" aria-labelledby={id}>
      <header className="card__head">
        <span className="card__icon">
          <Icon name={icon} size={20} />
        </span>
        <h2 id={id}>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
