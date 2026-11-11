import { hasBackend } from './http'

/**
 * What the real backend can and cannot do yet, for screens that must not pretend. Offline (the demo store) everything
 * works. Kept apart from the API modules so tests that replace those still get the real answers.
 */

/** The server keeps only the colour of a week grade, not the mentor's note. */
export const gradeNotesKept = () => !hasBackend()

/** A mentor cannot read their students' hand-ins on the server yet (the roster is lecturer/admin only). */
export const mentorSeesTeamWork = () => !hasBackend()
