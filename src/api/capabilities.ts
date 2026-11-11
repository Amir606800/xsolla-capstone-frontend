import { hasBackend } from './http'

/**
 * What the real backend can and cannot do yet, for screens that must not pretend. Offline (the demo store) everything
 * works. Kept apart from the API modules so tests that replace those still get the real answers.
 */

/** The note on a week grade: the demo store keeps it, the server keeps only the colour (no field for a note yet). */
export const gradeNotesKept = () => !hasBackend()

/**
 * Whether the Grading page shows the team's hand-ins. Both the demo store and the server (since backend 8f04f85, mentors
 * read their own team's work) have them; kept as a switch for a server without that permission.
 */
export const mentorSeesTeamWork = () => true
