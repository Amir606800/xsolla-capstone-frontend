/** Length of one 1:1, in minutes. A mentor's availability window is cut into slots of this size. */
export const SLOT_MINUTES = 30

/**
 * One bookable 1:1 time of a mentor, e.g. 15:00 - 15:30.
 * A student only ever sees `bookedBy` on their OWN booking; for other students' bookings they only
 * get `booked: true` (the backend must not leak who booked what).
 */
export interface MeetingSlot {
  id: string
  mentorId: number
  mentorName: string
  startsAt: string // ISO
  endsAt: string // ISO
  booked: boolean
  bookedBy?: { id: number; name: string }
}

/** What a mentor enters: "on this day I am free from 15:00 to 18:00". Times are local, HH:MM. */
export interface AvailabilityWindow {
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string // HH:MM
}
