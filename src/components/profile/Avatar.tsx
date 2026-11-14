import { useState } from 'react'
import { initialsOf } from '../../utils/image'
import './profile.css'

/**
 * A person's picture, or their initials when there is none (or it cannot be loaded). Decoration only: the name
 * is always written next to it, so it carries no text for a screen reader.
 */
export function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  // remember which address failed, so a new picture gets a fresh try
  const [failed, setFailed] = useState<string | null>(null)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (url && failed !== url) {
    return <img className="pfp" style={style} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(url)} />
  }
  return (
    <span className="pfp pfp--initials" style={style} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
