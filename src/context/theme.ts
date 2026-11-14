import { createContext } from 'react'

/** What is on screen. */
export type Theme = 'light' | 'dark'
/** What the person chose: "system" follows the device and can change by itself. */
export type ThemePreference = Theme | 'system'

export interface ThemeContextValue {
  theme: Theme
  preference: ThemePreference
  /** Light <-> dark in one click (the quick switch); it becomes an explicit choice. */
  toggleTheme: () => void
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
