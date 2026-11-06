/**
 * What a person is in the school. A user holds a SET of roles: every staff member starts as a
 * mentor, and an admin can add (and later take back) the lecturer role. What each role may do is
 * defined in `src/utils/roles.ts`, never by comparing role names around the app.
 */
export type Role = 'student' | 'mentor' | 'lecturer' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  roles: Role[]
}
