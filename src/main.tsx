import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/hanken-grotesk/wght.css'
import './index.css'
import './styles/typography.css'
import './styles/preferences.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { GoogleProvider } from './context/GoogleProvider.tsx'
import { ProfileProvider } from './context/ProfileProvider.tsx'
import { ThemeProvider } from './context/ThemeProvider.tsx'
import { runtimeEnv } from './config/runtime.ts'

if (!runtimeEnv('VITE_API_URL')) {
  throw new Error('VITE_API_URL is required. Configure the frontend environment before loading the app.')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <GoogleProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </GoogleProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
