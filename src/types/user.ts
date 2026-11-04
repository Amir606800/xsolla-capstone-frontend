/** Matches the backend `users.role` CHECK constraint. */
export type Role = 'student' | 'teacher' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: Role
}
