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
  /**
   * Roles given for a while: role -> when it ends (ISO). Past that moment the role no longer counts
   * (see `hasRole`), so a lecturer role an admin gave until a date goes away by itself.
   */
  roleUntil?: Partial<Record<Role, string>>
}
