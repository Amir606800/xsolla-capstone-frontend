import type { Actor, AvailabilityWindow, MeetingSlot } from '../types/slots'
import { authedRequest } from './authed'
import { attendeesField } from './mappers'
import type { ApiAttendee } from './types'

/**
 * 1:1 slot calls to the backend (internal/handlers/mentor_slot.go).
 *   GET    /mentor-slots                    all callers: their visible slots
 *   POST   /mentor-slots {date,start,end}   mentor: cuts a window into 30-minute slots
 *   DELETE /mentor-slots/:id                mentor: removes a FREE slot
 *   POST   /mentor-slots/:id/book           student: locks the slot (409 when taken or already booked)
 *   DELETE /mentor-slots/:id/book           student/mentor: cancels a booking
 * Every call returns the caller's updated slot list. The backend hides other students' booking identities.
 * The actor argument says who asks (the server reads the caller from the token).
 */
interface MentorSlotResponse {
  id: string
  mentor_id: number
  mentor_name: string
  starts_at: string // ISO
  ends_at: string // ISO
  booked: boolean
  booked_by?: number
  booked_by_name?: string
  meeting_url?: string | null
  attendees?: ApiAttendee[] | null
}

export function toMeetingSlot(s: MentorSlotResponse): MeetingSlot {
  return {
    id: s.id,
    mentorId: s.mentor_id,
    mentorName: s.mentor_name,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    booked: s.booked,
    ...(s.booked_by !== undefined ? { bookedBy: { id: s.booked_by, name: s.booked_by_name ?? '' } } : {}),
    ...(s.meeting_url ? { meetingUrl: s.meeting_url } : {}),
    ...attendeesField(s.attendees),
  }
}

const list = (rows: MentorSlotResponse[] | null) => (rows ?? []).map(toMeetingSlot)

export async function fetchSlots(actor: Actor): Promise<MeetingSlot[]> {
  void actor
  return list(await authedRequest<MentorSlotResponse[] | null>('/mentor-slots'))
}

export async function createAvailability(actor: Actor, window: AvailabilityWindow): Promise<MeetingSlot[]> {
  void actor
  return list(
    await authedRequest<MentorSlotResponse[] | null>('/mentor-slots', {
      method: 'POST',
      body: { date: window.date, start: window.start, end: window.end },
    }),
  )
}

export async function removeSlot(actor: Actor, id: string): Promise<MeetingSlot[]> {
  void actor
  return list(await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}`, { method: 'DELETE' }))
}

export async function bookSlot(actor: Actor, id: string): Promise<MeetingSlot[]> {
  void actor
  return list(await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}/book`, { method: 'POST' }))
}

export async function cancelBooking(actor: Actor, id: string): Promise<MeetingSlot[]> {
  void actor
  return list(await authedRequest<MentorSlotResponse[] | null>(`/mentor-slots/${id}/book`, { method: 'DELETE' }))
}
