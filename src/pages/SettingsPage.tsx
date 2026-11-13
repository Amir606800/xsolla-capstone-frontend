import { GoogleCard } from '../components/google/GoogleCard'
import { ChangePasswordCard } from '../components/settings/ChangePasswordCard'
import '../styles/ui.css'

/** Everyone (student, mentor, lecturer): the connections and the password of their own account. */
export default function SettingsPage() {
  return (
    <section className="settings">
      <h1 className="page-title">Settings</h1>
      <GoogleCard variant="lms" />
      <ChangePasswordCard variant="lms" />
    </section>
  )
}
