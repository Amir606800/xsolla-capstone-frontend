import type { User } from '../types/user'

/**
 * Demo accounts for working offline; any password works. Any other e-mail signs in as a student.
 * - Rashad (900) mentors Team 3, Sam's team, and was also given the lecturer role, so what he
 *   changes is what Sam sees (same ids as in the team and 1:1 mocks).
 * - Aysel (901) is only a mentor (Team 4); Elvin (902) is only a lecturer, with no team.
 */
export const DEMO_ACCOUNTS: Record<string, User> = {
  'student@xsolla.school': { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] },
  'lecturer@xsolla.school': {
    id: 900,
    name: 'Rashad Aliyev',
    email: 'lecturer@xsolla.school',
    roles: ['mentor', 'lecturer'],
  },
  'mentor@xsolla.school': { id: 901, name: 'Aysel Mammadova', email: 'mentor@xsolla.school', roles: ['mentor'] },
  'teacher@xsolla.school': { id: 902, name: 'Elvin Huseynov', email: 'teacher@xsolla.school', roles: ['lecturer'] },
}

/** Offline admin account for the separate admin sign-in (/admin/login); any password works. */
export const DEMO_ADMIN: User = { id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }
