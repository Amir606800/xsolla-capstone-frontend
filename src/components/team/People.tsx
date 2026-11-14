import { useState } from 'react'
import type { Person } from '../../types/team'
import { initials } from '../../utils/people'
import { Icon } from '../Icon'
import '../../pages/TeamPage.css'

/**
 * Round badge for a student or a mentor: their picture when they have one (and it loads), else their initials.
 * `url` is the `avatarUrl` the server sends; a person who hides it from the viewer simply has none.
 */
export function Avatar({ name, url, mentor = false, small = false }: { name: string; url?: string | null; mentor?: boolean; small?: boolean }) {
  // remember which address failed, so a new picture gets a fresh try
  const [failed, setFailed] = useState<string | null>(null)
  const cls = `avatar${mentor ? ' avatar--mentor' : ''}${small ? ' avatar--sm' : ''}`
  if (url && failed !== url) {
    return <img className={`${cls} avatar--photo`} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(url)} />
  }
  return (
    <span className={cls} aria-hidden="true">
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
