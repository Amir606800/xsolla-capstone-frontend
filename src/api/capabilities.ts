/**
 * What the backend can and cannot do yet, for screens that must not pretend. Kept apart from the API modules so tests
 * that replace those still get the real answers.
 */

/**
 * Whether the Grading page shows the team's hand-ins. The server has them (since backend 8f04f85, mentors read their own
 * team's work); kept as a switch for a server without that permission.
 */
export const mentorSeesTeamWork = () => true
