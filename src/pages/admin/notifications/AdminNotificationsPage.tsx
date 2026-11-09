import { Link } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import { useAdminAlerts } from '../../../hooks/useAdminAlerts'
import type { AdminAlert } from '../../../utils/adminAlerts'

function AlertList({ alerts, label }: { alerts: AdminAlert[]; label: string }) {
  return (
    <ul className="admin-alerts" aria-label={label}>
      {alerts.map((a) => (
        <li key={a.id} className={`admin-alert admin-alert--${a.level}`}>
          <span className="admin-alert__icon">
            <Icon name={a.level === 'attention' ? 'alert' : 'bell'} size={18} />
          </span>
          <span className="admin-alert__text">
            <span className="admin-alert__title">{a.title}</span>
            {a.detail && <span className="admin-alert__detail">{a.detail}</span>}
          </span>
          <Link className="admin-btn admin-btn--small" to={a.to}>
            {a.action}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * Admin: what is going on. "Needs attention" is what is wrong now (a week with no lecturer, a team with no
 * mentor, a lecture without a meeting link, a role that ends soon), each with a link to the page that fixes
 * it. "Lately" is what happened in the last week. It is worked out from the school's data every time, so
 * an item goes away by itself once it is fixed.
 */
export default function AdminNotificationsPage() {
  const { status, alerts, reload } = useAdminAlerts()
  const attention = alerts.filter((a) => a.level === 'attention')
  const lately = alerts.filter((a) => a.level === 'info')

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">What needs your attention, and what happened lately.</p>
        </div>
        <button type="button" className="admin-btn" onClick={reload}>
          <Icon name="reset" size={16} /> Refresh
        </button>
      </header>

      {status === 'loading' && alerts.length === 0 && <Loading className="admin-muted">Loading the notifications…</Loading>}
      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The notifications could not be loaded.</p>
          <button type="button" className="admin-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <section className="admin-page" aria-labelledby="alerts-attention">
            <h2 id="alerts-attention" className="admin-section-title">
              Needs attention{attention.length > 0 ? ` (${attention.length})` : ''}
            </h2>
            {attention.length === 0 ? (
              <p className="admin-empty">Nothing needs your attention.</p>
            ) : (
              <AlertList alerts={attention} label="Needs attention" />
            )}
          </section>

          <section className="admin-page" aria-labelledby="alerts-lately">
            <h2 id="alerts-lately" className="admin-section-title">
              Lately
            </h2>
            {lately.length === 0 ? <p className="admin-empty">Nothing new in the last week.</p> : <AlertList alerts={lately} label="Lately" />}
          </section>
        </>
      )}
    </section>
  )
}
