import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MaterialDraft } from '../../utils/authoring'
import { MaterialForm } from './MaterialForm'

const file = (name: string, bytes = 2048) => new File([new Uint8Array(bytes)], name)

describe('MaterialForm', () => {
  it('is a file or a link, and a file says what it is by itself', async () => {
    // applyAccept off: a file dropped onto the page is not filtered by the file dialog
    const user = userEvent.setup({ applyAccept: false })
    const onSave = vi.fn<(d: MaterialDraft) => Promise<void>>().mockResolvedValue()
    render(<MaterialForm onSave={onSave} onCancel={() => {}} />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'File' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Allowed: PDF, PowerPoint \(\.pptx\), Markdown \(\.md\) or ZIP, up to 10 MB/)).toBeInTheDocument()
    expect(screen.getByLabelText('File')).toHaveAttribute('accept', '.pdf,.pptx,.md,.zip')

    await user.upload(screen.getByLabelText('File'), file('essay.docx'))
    expect(screen.getByText("“essay.docx” can't be added: a material must be a PDF, PowerPoint (.pptx), Markdown (.md) or ZIP file.")).toBeInTheDocument()

    await user.upload(screen.getByLabelText('File'), file('week1-slides.pptx'))
    expect(screen.queryByText(/“essay\.docx” can't be added/)).not.toBeInTheDocument()
    expect(screen.getByText(/This one is: Slides \(PPTX\)\./)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title'), 'Week 1 slides')
    await user.click(screen.getByRole('button', { name: 'Add material' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pptx', file: { name: 'week1-slides.pptx', sizeBytes: 2048 } }))
  })

  it('a file that is too big is refused with its size limit', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<MaterialForm onSave={vi.fn()} onCancel={() => {}} />)
    await user.upload(screen.getByLabelText('File'), file('huge.pdf', 11 * 1024 * 1024))
    expect(screen.getByText('“huge.pdf” is too big: a file can be at most 10 MB.')).toBeInTheDocument()
  })

  it('Link shows the address field instead of the file', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn<(d: MaterialDraft) => Promise<void>>().mockResolvedValue()
    render(<MaterialForm onSave={onSave} onCancel={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Link' }))
    expect(screen.queryByLabelText('File')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Title'), 'Effective Go')
    await user.type(screen.getByLabelText('Link'), 'https://go.dev/doc/effective_go')
    await user.click(screen.getByRole('button', { name: 'Add material' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'link', url: 'https://go.dev/doc/effective_go' }))
  })
})
