import type { AdminSection } from '../../config/adminNav'

/** Holds a section's place in the admin frame until that section is built. */
export default function AdminSectionPage({ section }: { section: AdminSection }) {
  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">{section.label}</h1>
        <p className="page-subtitle">{section.summary}</p>
      </header>
      <p className="admin-empty">This section is not built yet.</p>
    </section>
  )
}
