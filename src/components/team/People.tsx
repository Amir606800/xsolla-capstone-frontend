import type { Person } from '../../types/team'
import { initials } from '../../utils/people'
import { Icon } from '../Icon'
import '../../pages/TeamPage.css'

/** Round initials badge for a student or a mentor. */
export function Avatar({ name, mentor = false, small = false }: { name: string; mentor?: boolean; small?: boolean }) {
  return (
    <span className={`avatar${mentor ? ' avatar--mentor' : ''}${small ? ' avatar--sm' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function Contact({ person }: { person: Person }) {
  return (
    <a className="team__mail" href={`mailto:${person.email}`}>
      <Icon name="mail" size={14} />
      {person.email}
    </a>
  )
}
