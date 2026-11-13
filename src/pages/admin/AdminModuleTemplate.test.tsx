import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { listModules } from '../../mocks/contentEdits'
import { renderWithProviders } from '../../test/renderWithProviders'

// the file the admin would download is caught here instead
const saved = vi.hoisted(() => ({ blob: null as Blob | null, name: '' }))
vi.mock('../../api/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/files')>()),
  saveBlob: (blob: Blob, name: string) => {
    saved.blob = blob
    saved.name = name
  },
}))

vi.setConfig({ testTimeout: 30_000 })

describe('Admin: export and import a module template', () => {
  it('exports the course as a file, and importing it makes the modules again for a new start day', async () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/admin/modules' })
    await user.click(await screen.findByRole('button', { name: 'Export template' }))
    expect(await screen.findByText(/Template saved with 12 modules/)).toBeInTheDocument()
    expect(saved.name).toMatch(/^module-template-\d{4}-\d\d-\d\d\.json$/)
    const text = await saved.blob!.text()
    expect(JSON.parse(text)).toMatchObject({ format: 'xsolla-lms-module-template', version: 1 })

    await user.click(screen.getByRole('button', { name: 'Import template' }))
    const dialog = within(await screen.findByRole('dialog'))
    // a file that is not a template is refused with a reason
    await user.upload(dialog.getByLabelText('Template file'), new File(['{"a":1}'], 'other.json', { type: 'application/json' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent('not a module template')
    expect(dialog.getByRole('button', { name: 'Make the modules' })).toBeDisabled()

    await user.upload(dialog.getByLabelText('Template file'), new File([text], 'template.json', { type: 'application/json' }))
    expect(await dialog.findByText(/12 modules, \d+ tasks/)).toBeInTheDocument()
    fireEvent.change(dialog.getByLabelText('Week 1 opens on'), { target: { value: '2028-03-06' } })
    await user.click(dialog.getByRole('button', { name: 'Make 12 modules' }))
    expect(await dialog.findByText(/Done\./)).toBeInTheDocument()
    expect(listModules()).toHaveLength(24)

    const added = listModules().filter((m) => m.opensAt && m.opensAt >= new Date(2028, 2, 6).toISOString())
    expect(added).toHaveLength(12)
    expect(added[0]).toMatchObject({ title: 'Onboarding & Git' })
    expect(added[0].items.length).toBeGreaterThan(0)
    await user.click(dialog.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText(/^Imported 12 modules/)).toBeInTheDocument()
  })
})
