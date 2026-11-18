/**
 * The server's clock, so locks, deadlines and countdowns do not follow the device's clock: setting a laptop's date
 * forward must not open a week early.
 *
 * Every server response carries the server's time in its `Date` header (api/http.ts passes it to noteServerDate).
 * The time is kept as "server time at a moment of `performance.now()`": that counter only ever moves forward at real
 * speed and does not jump when someone changes the device's clock, also while the page is open. Until the first
 * response arrives, the device's clock is used.
 */

let anchor: { serverMs: number; perfMs: number } | null = null

/** A `Date` header is whole seconds: the real moment is on average half a second later. */
const HALF_SECOND = 500
/** A new reading closer than this to what we already have is just rounding and travel time: keep the old one. */
const TOLERANCE_MS = 2000

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Learns the server's time from a response's `Date` header (`sentAt`/`receivedAt`: performance.now() around it). */
export function noteServerDate(header: unknown, sentAt: number, receivedAt: number): void {
  if (typeof header !== 'string' || !header) return
  const serverMs = Date.parse(header)
  if (Number.isNaN(serverMs)) return
  // the server read its clock somewhere between sending and receiving: take the middle
  const reading = { serverMs: serverMs + HALF_SECOND, perfMs: (sentAt + receivedAt) / 2 }
  if (anchor) {
    const expected = anchor.serverMs + (reading.perfMs - anchor.perfMs)
    if (Math.abs(expected - reading.serverMs) < TOLERANCE_MS) return
  }
  // the first reading, or the device slept (the counter may pause) or the server's clock moved: start again from it
  anchor = reading
}

/** Now, by the server's clock (the device's clock until the server has answered once). */
export function serverNowMs(): number {
  return anchor ? anchor.serverMs + (perfNow() - anchor.perfMs) : Date.now()
}

/** Now, by the server's clock, as a Date. Use this instead of `new Date()` for anything that locks or counts down. */
export function serverNow(): Date {
  return new Date(serverNowMs())
}

/** Tests only: forget what the server said. */
export function resetServerTime(): void {
  anchor = null
}
