import { addWindow, type Actor, deleteSlot, listSlots, release, reserve } from '../mocks/slots'
import type { AvailabilityWindow, MeetingSlot } from '../types/slots'

/**
 * MOCK implementation - the backend has no 1:1 slots yet. Expected real shape:
 *   GET    /mentor-slots                    student: the slots of their own mentor; mentor: their own slots
 *   POST   /mentor-slots {date,start,end,slot_minutes:30}   mentor: opens a window, the server cuts it into slots
 *   DELETE /mentor-slots/:id                mentor: removes a FREE slot
 *   POST   /mentor-slots/:id/book           student: locks the slot (409 when taken or when they already hold one)
 *   DELETE /mentor-slots/:id/book           student cancels their own booking; a mentor can cancel any of theirs
 * Every call returns the caller's updated list. The server hides who booked a slot from other students.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export type { Actor }

export async function fetchSlots(actor: Actor): Promise<MeetingSlot[]> {
  await wait()
  return listSlots(actor)
}

export async function createAvailability(actor: Actor, window: AvailabilityWindow): Promise<MeetingSlot[]> {
  await wait()
  return addWindow(actor, window)
}

export async function removeSlot(actor: Actor, id: string): Promise<MeetingSlot[]> {
  await wait()
  return deleteSlot(actor, id)
}

export async function bookSlot(actor: Actor, id: string): Promise<MeetingSlot[]> {
  await wait()
  return reserve(actor, id)
}

export async function cancelBooking(actor: Actor, id: string): Promise<MeetingSlot[]> {
  await wait()
  return release(actor, id)
}
