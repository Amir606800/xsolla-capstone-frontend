import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AnalyticsPeriod } from './AnalyticsPeriod'
import { AnalyticsTabs } from './AnalyticsTabs'
import '../../../styles/ui.css'
import './analytics.css'

/**
 * Every analytics page: the title, the four tabs, then one filter row (the reporting period) above everything it
 * applies to, then the page.
 */
export function AnalyticsShell({
  eyebrow,
  title,
  subtitle,
  period,
  children,
}: {
  eyebrow?: { to: string; label: string }
  title: string
  subtitle?: ReactNode
  period?: { from: string; to: string; onChange: (from: string, to: string) => void; note?: string }
  children: ReactNode
}) {
  return (
    <section className="admin-page analytics">
      <header className="admin-page__head">
        {eyebrow && (
          <p className="admin-eyebrow">
            <Link to={eyebrow.to}>{eyebrow.label}</Link>
          </p>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </header>
      <AnalyticsTabs />
      {period && (
        <div className="admin-toolbar analytics-toolbar">
          <AnalyticsPeriod from={period.from} to={period.to} onChange={period.onChange} />
          {period.note && <p className="admin-muted analytics-updated">{period.note}</p>}
        </div>
      )}
      {children}
    </section>
  )
}
