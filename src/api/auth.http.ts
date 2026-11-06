import type { User } from '../types/user'
import { rolesFrom } from '../utils/roles'
import { authedRequest } from './authed'
import { apiRequest } from './http'
import { clearTokens, getTokens, saveTokens } from './session'

/** Wire formats from the backend's Swagger (`dto.UserResponse`, `dto.AuthResponse`). */
interface UserDto {
  /** API_CONTRACT.md sends ids as strings ("1"); older builds sent numbers. */
  id: number | string
  email: string
  name: string
  /** Today: one of student | teacher | admin. */
  role?: string
  /** Planned (user-roles table): e.g. ["mentor", "lecturer"]. Wins over `role` when present. */
  roles?: string[]
  created_at?: string
}

interface AuthResponse {
  access_token: string
  refresh_token: string
  user: UserDto
}

/** Backend user -> app user. See `rolesFrom` for how role names are read. */
export function mapUser(dto: UserDto): User {
  return { id: Number(dto.id), name: dto.name, email: dto.email, roles: rolesFrom(dto.roles ?? dto.role) }
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
