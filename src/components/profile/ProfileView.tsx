import { GoogleCard } from '../google/GoogleCard'
import { ChangePasswordCard } from '../settings/ChangePasswordCard'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { roleLabel } from '../../utils/roles'
import { AboutCard } from './AboutCard'
import { Avatar } from './Avatar'
import { LookCard } from './LookCard'
import '../settings/settings.css'
import './profile.css'

/**
 * The body of the Profile page, shared by the LMS (every role but admin) and the admin section: who you are,
 * About me, the look settings, then the Google connection and the password that used to be in Settings.
 */
export function ProfileView({ variant = 'lms' }: { variant?: 'lms' | 'admin' }) {
  const { user } = useAuth()
  const { profile } = useProfile()
  return (
    <div className="profile-stack">
      <div className="profile-hero">
        <Avatar name={user?.name ?? ''} url={profile.avatarUrl} size={64} />
        <div>
          <h2 className="profile-hero__name">{user?.name}</h2>
          <p className="profile-hero__meta">
            {roleLabel(user)} · {user?.email}
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <AboutCard variant={variant} />
        <LookCard variant={variant} />
      </div>
      <div className="settings-grid">
        <GoogleCard variant={variant} />
        <ChangePasswordCard variant={variant} />
      </div>
    </div>
  )
}
