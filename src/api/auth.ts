import * as http from './auth.http'
import * as mock from './auth.mock'
import { hasBackend } from './http'
import { clearTokens } from './session'

/**
 * Auth API used by the app. Talks to the real backend when VITE_API_URL is set
 * (see .env.example), otherwise falls back to the offline mock.
 */
export const login: typeof http.login = (email, password) =>
  hasBackend() ? http.login(email, password) : mock.login(email, password)

export const signup: typeof http.signup = (email, name, password) =>
  hasBackend() ? http.signup(email, name, password) : mock.signup(email, name, password)

export const logout: typeof http.logout = async () => {
  if (hasBackend()) return http.logout()
  clearTokens() // drop tokens left over from an earlier session with the real backend
  return mock.logout()
}
