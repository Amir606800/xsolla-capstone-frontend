import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '../context/AuthProvider'
import { GoogleProvider } from '../context/GoogleProvider'
import { ProfileProvider } from '../context/ProfileProvider'
import { ThemeProvider } from '../context/ThemeProvider'

interface Options {
  route?: string
}

/** Renders UI wrapped in the same providers as main.tsx (with an in-memory router). */
export function renderWithProviders(ui: ReactElement, { route = '/' }: Options = {}) {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <GoogleProvider>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          </GoogleProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>,
  )
}
