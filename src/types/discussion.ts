/**
 * A talk a mentor sets up with students of their team, to discuss something. It is NOT a 1:1: nobody books it, it can be on
 * any day, and it never moves a deadline. The server keeps one row per invited student; the rows made together share `batchId`.
 */
export interface Discussion {
  id: string
  batchId: string
  mentorId: number
  mentorName: string
  studentId: number
  studentName: string
  title: string
  note?: string
  startsAt: string // ISO
  endsAt: string // ISO
}

/** What a mentor enters: a title, when, and who. `studentIds` empty with `wholeTeam` true invites the whole team. */
export interface DiscussionDraft {
  title: string
  note: string
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string // HH:MM
  studentIds: number[]
  wholeTeam: boolean
}
