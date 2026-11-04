import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        open={open}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        title="Details"
      >
        <a href="#one">First link</a>
        <button>Inner action</button>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden">content</Modal>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('is an accessible modal dialog named by its title', () => {
    render(<Modal open onClose={() => {}} title="Friday, November 6">content</Modal>)
    const dialog = screen.getByRole('dialog', { name: 'Friday, November 6' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('content')
  })

  it('is rendered in a portal on <body>, outside the page layout', () => {
    const { container } = render(<Modal open onClose={() => {}} title="T">x</Modal>)
    expect(container).toBeEmptyDOMElement()
    expect(document.body.querySelector('.modal-backdrop')).not.toBeNull()
  })

  it('moves focus to the close button on open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('closes on the close button, Escape and a backdrop click - but not on a click inside', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('heading', { name: 'Details' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('returns focus to the element that opened it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // order inside: Close, First link, Inner action
    const close = screen.getByRole('button', { name: 'Close' })
    const link = screen.getByRole('link', { name: 'First link' })
    const action = screen.getByRole('button', { name: 'Inner action' })

    expect(close).toHaveFocus()
    await user.tab()
    expect(link).toHaveFocus()
    await user.tab()
    expect(action).toHaveFocus()
    await user.tab() // wraps to the first element instead of leaving the dialog
    expect(close).toHaveFocus()
    await user.tab({ shift: true }) // wraps backwards to the last
    expect(action).toHaveFocus()
  })

  it('locks page scroll while open and restores it afterwards', async () => {
    const user = userEvent.setup()
    document.body.style.overflow = 'auto'
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('releases the scroll lock and listeners when unmounted while open', () => {
    document.body.style.overflow = ''
    const { unmount } = render(<Modal open onClose={() => {}} title="T">x</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('uses the latest onClose without re-focusing on every parent render', async () => {
    const user = userEvent.setup()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Modal open onClose={first} title="T"><button>Inner</button></Modal>)
    await user.click(screen.getByRole('button', { name: 'Inner' })) // user moves focus inside
    rerender(<Modal open onClose={second} title="T"><button>Inner</button></Modal>)
    expect(screen.getByRole('button', { name: 'Inner' })).toHaveFocus() // not stolen back to Close
    await user.keyboard('{Escape}')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
