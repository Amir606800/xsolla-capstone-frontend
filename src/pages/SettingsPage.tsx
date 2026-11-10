import { GoogleCard } from '../components/google/GoogleCard'
import '../styles/ui.css'

/** Staff: the connections of their own account. For now, Google Calendar. */
export default function SettingsPage() {
  return (
    <section className="settings">
      <h1 className="page-title">Settings</h1>
      <GoogleCard variant="lms" />
    </section>
  )
}
