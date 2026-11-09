import type { ReactNode } from 'react'
import { Spinner } from './Spinner'

/** "Loading your tasks…" with a spinner, as the status line of a page that is waiting for its data. */
export function Loading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`loading${className ? ` ${className}` : ''}`} role="status">
      <Spinner />
      <span>{children}</span>
    </p>
  )
}
