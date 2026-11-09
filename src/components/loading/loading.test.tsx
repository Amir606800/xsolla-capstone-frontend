import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Loading } from './Loading'
import { PageLoader } from './PageLoader'
import { DashboardSkeleton, StaffDashboardSkeleton } from './Skeleton'

describe('loading screens', () => {
  it('Loading is one status line with a decorative spinner', () => {
    render(<Loading className="module__state">Loading your tasks…</Loading>)
    const line = screen.getByRole('status')
    expect(line).toHaveTextContent('Loading your tasks…')
    expect(line).toHaveClass('loading', 'module__state')
    expect(line.querySelector('.spinner')).toHaveAttribute('aria-hidden', 'true')
  })

  it('PageLoader shows the Xsolla mark above a spinner, labelled for screen readers', () => {
    const { container } = render(<PageLoader fullscreen />)
    expect(screen.getByRole('progressbar', { name: 'Loading the page' })).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.page-loader--full')).not.toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
    // hidden from screen readers: it is decoration (the page has its own logo)
    expect(screen.queryByRole('img', { name: 'Xsolla' })).toBeNull()
    expect(container.querySelector('.spinner')).not.toBeNull()
  })

  it('without `fullscreen` it only fills the page area', () => {
    const { container } = render(<PageLoader />)
    expect(container.querySelector('.page-loader--full')).toBeNull()
  })

  it('the dashboard skeletons announce one "Loading…" and hide their boxes', () => {
    const { container, rerender } = render(<DashboardSkeleton />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your course…')
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(6)
    rerender(<StaffDashboardSkeleton />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading the course…')
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(6)
    expect(container.querySelectorAll('.skeleton-card:not([aria-hidden="true"])')).toHaveLength(0)
  })
})
