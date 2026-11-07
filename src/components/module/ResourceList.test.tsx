import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ResourceItem } from '../../types/course'
import { ResourceList } from './ResourceList'

vi.mock('../../api/files', () => ({ downloadFile: vi.fn(async () => undefined) }))

const file = (n: number): ResourceItem => ({ id: `f${n}`, moduleId: 'm', type: 'resource', title: `File ${n}`, kind: 'pdf', file: { name: `f${n}.pdf`, sizeBytes: 10 } })
const link = (n: number): ResourceItem => ({ id: `l${n}`, moduleId: 'm', type: 'resource', title: `Link ${n}`, kind: 'link', url: `https://example.com/${n}` })

describe('ResourceList', () => {
  it('a short list shows everything, with no filter or enlarge button', () => {
    render(<ResourceList resources={[file(1), file(2)]} />)
    expect(within(screen.getByRole('list', { name: 'Resources' })).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('group', { name: 'Show' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show all resources' })).not.toBeInTheDocument()
  })

  it('narrows the list to files or links', async () => {
    const user = userEvent.setup()
    render(<ResourceList resources={[file(1), file(2), link(1)]} />)
    const list = () => screen.getByRole('list', { name: 'Resources' })
    await user.click(screen.getByRole('button', { name: /^Links/ }))
    expect(within(list()).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('Link 1')])
    await user.click(screen.getByRole('button', { name: /^Files/ }))
    expect(within(list()).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /^Files/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a long list can be opened in a pop-up, grouped into files and links', async () => {
    const user = userEvent.setup()
    render(<ResourceList resources={[1, 2, 3, 4].map(file).concat([1, 2, 3].map(link))} />)
    expect(screen.getByText('7', { selector: '.pill' })).toBeInTheDocument() // count in the header
    await user.click(screen.getByRole('button', { name: 'Show all resources' }))
    const dialog = screen.getByRole('dialog', { name: 'Resources · 7' })
    expect(within(within(dialog).getByRole('list', { name: 'All files' })).getAllByRole('listitem')).toHaveLength(4)
    expect(within(within(dialog).getByRole('list', { name: 'All links' })).getAllByRole('link')).toHaveLength(3)
    // links still open safely in a new tab
    expect(within(dialog).getByRole('link', { name: 'Open Link 1' })).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
