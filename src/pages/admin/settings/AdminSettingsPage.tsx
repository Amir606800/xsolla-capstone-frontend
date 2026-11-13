import { GoogleCard } from '../../../components/google/GoogleCard'
import { ChangePasswordCard } from '../../../components/settings/ChangePasswordCard'

/** Admin: the connections of their own account. For now, Google Calendar. */
export default function AdminSettingsPage() {
  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Your own account: the Google connection and your password.</p>
      </header>
      <div className="settings-grid">
        <GoogleCard variant="admin" />
        <ChangePasswordCard variant="admin" />
      </div>
    </section>
  )
}
