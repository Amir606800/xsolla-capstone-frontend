import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { Icon } from '../Icon'
import './profile.css'

const keyFor = (userId: number) => `profile_reminder_${userId}`

function wasHandled(userId: number): boolean {
  try {
    return localStorage.getItem(keyFor(userId)) !== null
  } catch {
    return false
  }
}

function remember(userId: number) {
  try {
    localStorage.setItem(keyFor(userId), '1')
  } catch {
    // storage unavailable: the reminder may come back next time, which is harmless
  }
}

/**
 * A small, optional nudge for someone who has not filled in "About me" yet (no picture, bio or handles): shown at the top of the
 * page after sign-in. It is never required. "Maybe later" or opening the profile ends it for good on this browser, and so does
 * filling something in. Not shown on the profile page itself, nor when the server has no profile routes.
 */
export function CompleteProfileReminder() {
  const { user } = useAuth()
  const { profile, status } = useProfile()
  const { pathname } = useLocation()
  const [handled, setHandled] = useState<number | null>(null)

  if (!user || status !== 'ready' || pathname.startsWith('/profile')) return null
  const complete = !!profile.avatarUrl || !!profile.bio.trim() || !!profile.slackHandle.trim() || !!profile.gitlabHandle.trim()
  if (complete || handled === user.id || wasHandled(user.id)) return null

  const done = () => {
    remember(user.id)
    setHandled(user.id)
  }

  return (
    <aside className="profile-reminder" aria-label="Complete your profile">
      <span className="profile-reminder__icon" aria-hidden="true">
        <Icon name="user" size={18} />
      </span>
      <p className="profile-reminder__text">
        <strong>Welcome! Complete your profile.</strong> Add a picture, a short bio and your Slack and GitLab names so the others can
        find you. It is optional: you can do it any time from your profile.
      </p>
      <div className="profile-reminder__actions">
        <Link to="/profile" className="btn" onClick={done}>
          Complete profile
        </Link>
        <button type="button" className="btn btn--ghost" onClick={done}>
          Maybe later
        </button>
      </div>
    </aside>
  )
}
