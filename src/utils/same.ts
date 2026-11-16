/** Whether two loaded results hold the same data, so a quiet reload that found nothing new changes nothing on screen. */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/** For `setState(keepIfSame(next))`: the old value (same reference, no re-render) when `next` is equal to it. */
export const keepIfSame =
  <T,>(next: T) =>
  (prev: T): T =>
    sameData(prev, next) ? prev : next
