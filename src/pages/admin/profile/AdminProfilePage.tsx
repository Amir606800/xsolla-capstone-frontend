import { ProfileView } from '../../../components/profile/ProfileView'

/** Admin: the same profile, in the admin section's frame. */
export default function AdminProfilePage() {
  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your picture, how the LMS looks to you, the Google connection and your password.</p>
      </header>
      <ProfileView variant="admin" />
    </section>
  )
}
