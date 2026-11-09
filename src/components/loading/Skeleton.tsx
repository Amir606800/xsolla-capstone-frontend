import type { CSSProperties, ReactNode } from 'react'
import './loading.css'

/** One grey bar or block that shimmers while the real content loads. */
export function Skeleton({
  width,
  height = 14,
  radius,
  className,
}: {
  width?: number | string
  height?: number | string
  radius?: number
  className?: string
}) {
  const style: CSSProperties = { width, height, ...(radius !== undefined ? { borderRadius: radius } : {}) }
  return <span className={`skeleton${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />
}

/** A card-shaped placeholder: a title bar and a few lines. */
function SkeletonCard({ lines = 3, tall = false, className }: { lines?: number; tall?: boolean; className?: string }) {
  return (
    <div className={`skeleton-card${tall ? ' skeleton-card--tall' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <Skeleton width="45%" height={16} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} />
      ))}
    </div>
  )
}

/** Wraps placeholders so a screen reader hears one "Loading…" instead of a pile of empty boxes. */
function Busy({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <div className={className} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** The student dashboard while its course loads: the same grid of widgets, as grey cards. */
export function DashboardSkeleton({ label = 'Loading your course…' }: { label?: string }) {
  return (
    <Busy label={label} className="skeleton-dash">
      <SkeletonCard lines={2} className="skeleton-dash__sm" />
      <SkeletonCard lines={2} className="skeleton-dash__sm" />
      <SkeletonCard lines={2} className="skeleton-dash__sm" />
      <SkeletonCard lines={4} tall className="skeleton-dash__md" />
      <SkeletonCard lines={4} tall className="skeleton-dash__md" />
      <SkeletonCard lines={3} className="skeleton-dash__full" />
    </Busy>
  )
}

/** The mentor / lecturer dashboard while its course loads: stat tiles, then the two columns. */
export function StaffDashboardSkeleton({ label = 'Loading the course…' }: { label?: string }) {
  return (
    <Busy label={label} className="skeleton-staff">
      <div className="skeleton-staff__stats">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} lines={1} />
        ))}
      </div>
      <div className="skeleton-staff__cols">
        <SkeletonCard lines={5} tall />
        <SkeletonCard lines={4} tall />
      </div>
    </Busy>
  )
}
