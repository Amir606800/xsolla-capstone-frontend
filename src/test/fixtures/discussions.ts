import type { Discussion, DiscussionDraft } from '../../types/discussion'
import { availabilityInstants } from '../../utils/slots'
import { canMentor } from '../../utils/roles'
import { buildMentorTeam } from './teams'
import type { Actor } from '../../types/slots'

/**
 * Stand-in for the backend's talks (a mentor with students, not a 1:1), kept in localStorage like the slot store. Rules the
 * real backend enforces too: only a mentor sets one up, only for students of their team; a student sees only their own.
 */
const KEY = 'mentor_discussions'
let seq = 0

const load = (): Discussion[] => JSON.parse(localStorage.getItem(KEY) ?? '[]') as Discussion[]
const save = (list: Discussion[]) => localStorage.setItem(KEY, JSON.stringify(list))

export function listDiscussions(actor: Actor): Discussion[] {
  const all = load()
  if (actor.roles.includes('admin')) return all
  if (canMentor(actor)) return all.filter((d) => d.mentorId === actor.id)
  return all.filter((d) => d.studentId === actor.id)
}

export function addDiscussion(actor: Actor, draft: DiscussionDraft): Discussion[] {
  if (!canMentor(actor)) throw new Error('Only mentors can set up a talk')
  const team = buildMentorTeam({
    id: actor.id,
    name: actor.name,
    email: '',
  }).members
  const chosen = draft.wholeTeam ? team : team.filter((m) => draft.studentIds.includes(m.id))
  if (chosen.length === 0) throw new Error('Choose at least one student')
  const { startsAt, endsAt } = availabilityInstants({
    date: draft.date,
    start: draft.start,
    end: draft.end,
  })
  const batchId = `b-${seq++}`
  save([
    ...load(),
    ...chosen.map((m, i): Discussion => ({
      id: `d-${batchId}-${i}`,
      batchId,
      mentorId: actor.id,
      mentorName: actor.name,
      studentId: m.id,
      studentName: m.name,
      title: draft.title.trim(),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      startsAt,
      endsAt,
    })),
  ])
  return listDiscussions(actor)
}

export function deleteDiscussion(actor: Actor, id: string): Discussion[] {
  const all = load()
  const found = all.find((d) => d.id === id)
  if (!found) throw new Error('This talk no longer exists')
  save(all.filter((d) => d.batchId !== found.batchId))
  return listDiscussions(actor)
}
