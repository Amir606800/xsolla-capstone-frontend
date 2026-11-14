import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './People'

describe('Avatar (people on the team pages)', () => {
  it('shows initials without a picture', () => {
    render(<Avatar name="Leyla Hasanova" />)
    expect(screen.getByText('LH')).toBeInTheDocument()
  })

  it('shows the picture when there is one, and the initials again when it cannot be loaded', () => {
    const { container } = render(<Avatar name="Leyla Hasanova" url="http://api.test/avatars/ab.webp" small />)
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('src', 'http://api.test/avatars/ab.webp')
    expect(img).toHaveClass('avatar', 'avatar--sm', 'avatar--photo')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('LH')).toBeInTheDocument()
  })
})
