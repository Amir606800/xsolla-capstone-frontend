import { ProfileView } from '../components/profile/ProfileView'
import '../styles/ui.css'

/** Everyone but the admin (student, mentor, lecturer): the picture, the look settings, Google and the password. */
export default function ProfilePage() {
  return (
    <section className="settings">
      <h1 className="page-title">Profile</h1>
      <ProfileView variant="lms" />
    </section>
  )
}
