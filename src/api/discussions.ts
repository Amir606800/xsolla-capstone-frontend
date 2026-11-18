import type { Discussion, DiscussionDraft } from '../types/discussion'
import { availabilityInstants } from '../utils/slots'
import { authedRequest } from './authed'

/**
 * Talks a mentor sets up with their students (internal/handlers/mentor_discussion.go). Not 1:1s: they move no deadline.
 *   GET    /mentor-discussions       mentor: their talks, student: the talks they are invited to
 *   POST   /mentor-discussions       mentor: { title, note?, starts_at, ends_at, student_ids? | whole_team? }
 *   DELETE /mentor-discussions/:id   mentor: cancels the talk for everyone invited
 * Every call returns the caller's updated list.
 */
interface DiscussionResponse {
  id: string
  batch_id: string
  mentor_id: number
  mentor_name: string
  student_id: number
  student_name: string
  title: string
  note?: string
  starts_at: string
  ends_at: string
}

export function toDiscussion(d: DiscussionResponse): Discussion {
  return {
    id: String(d.id),
    batchId: String(d.batch_id),
    mentorId: d.mentor_id,
    mentorName: d.mentor_name,
    studentId: d.student_id,
    studentName: d.student_name,
    title: d.title,
    ...(d.note ? { note: d.note } : {}),
    startsAt: d.starts_at,
    endsAt: d.ends_at,
  }
}

const list = (rows: DiscussionResponse[] | null) => (rows ?? []).map(toDiscussion)

export async function fetchDiscussions(): Promise<Discussion[]> {
  return list(await authedRequest<DiscussionResponse[] | null>('/mentor-discussions'))
}

export async function createDiscussion(draft: DiscussionDraft): Promise<Discussion[]> {
  const { startsAt, endsAt } = availabilityInstants({
    date: draft.date,
    start: draft.start,
    end: draft.end,
  })
  return list(
    await authedRequest<DiscussionResponse[] | null>('/mentor-discussions', {
      method: 'POST',
      body: {
        title: draft.title.trim(),
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
        starts_at: startsAt,
        ends_at: endsAt,
        ...(draft.wholeTeam ? { whole_team: true } : { student_ids: draft.studentIds }),
      },
    }),
  )
}

export async function removeDiscussion(id: string): Promise<Discussion[]> {
  return list(await authedRequest<DiscussionResponse[] | null>(`/mentor-discussions/${id}`, { method: 'DELETE' }))
}
