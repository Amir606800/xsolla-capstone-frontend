import { GoogleCard } from '../../../components/google/GoogleCard'

/** Admin: the connections of their own account. For now, Google Calendar. */
export default function AdminSettingsPage() {
  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Your own account. Connect Google to put the events you add on your Google Calendar.</p>
      </header>
      <GoogleCard variant="admin" />
    </section>
  )
}
