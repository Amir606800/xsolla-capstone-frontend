import type { Role, User } from '../types/user'
import { authedRequest } from './authed'
import { apiRequest } from './http'
import { clearTokens, getTokens, saveTokens } from './session'

/** Wire formats from the backend's Swagger (`dto.UserResponse`, `dto.AuthResponse`). */
interface UserDto {
  /** API_CONTRACT.md sends ids as strings ("1"); older builds sent numbers. */
  id: number | string
  email: string
  name: string
  role: string
  created_at?: string
}

interface AuthResponse {
  access_token: string
  refresh_token: string
  user: UserDto
}

const ROLES: readonly Role[] = ['student', 'teacher', 'admin']

/** Backend role -> UI role. "lecturer" is accepted as an alias of "teacher"; anything unknown gets the least access. */
export function mapRole(role: string): Role {
  const r = role.toLowerCase()
  if (r === 'lecturer') return 'teacher'
  return (ROLES as readonly string[]).includes(r) ? (r as Role) : 'student'
}

export function mapUser(dto: UserDto): User {
  return { id: Number(dto.id), name: dto.name, email: dto.email, role: mapRole(dto.role) }
}

function startSession(res: AuthResponse): User {
  saveTokens({ accessToken: res.access_token, refreshToken: res.refresh_token })
  return mapUser(res.user)
}

/** POST /auth/login. The backend field is `login` (the email address). */
export async function login(email: string, password: string): Promise<User> {
  const res = await apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { login: email, password } })
  return startSession(res)
}

/** POST /auth/signup */
export async function signup(email: string, name: string, password: string): Promise<User> {
  const res = await apiRequest<AuthResponse>('/auth/signup', { method: 'POST', body: { email, name, password } })
  return startSession(res)
}

/** POST /auth/logout. The tokens are dropped locally even if the server cannot be reached. */
export async function logout(): Promise<void> {
  const tokens = getTokens()
  clearTokens()
  if (!tokens) return
  try {
    await apiRequest<void>('/auth/logout', {
      method: 'POST',
      body: { refresh_token: tokens.refreshToken },
      token: tokens.accessToken,
    })
  } catch {
    // already signed out on this device; the refresh token simply expires on the server
  }
}

/** GET /users/me - the signed-in user as the server sees them. */
export async function fetchMe(): Promise<User> {
  return mapUser(await authedRequest<UserDto>('/users/me'))
}
