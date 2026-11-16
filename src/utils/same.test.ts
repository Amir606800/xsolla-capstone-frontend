import { describe, expect, it } from 'vitest'
import { keepIfSame, sameData } from './same'

describe('sameData / keepIfSame', () => {
  it('sees equal data as the same, however it was made', () => {
    expect(sameData([{ a: 1 }], [{ a: 1 }])).toBe(true)
    expect(sameData([{ a: 1 }], [{ a: 2 }])).toBe(false)
  })
  it('keeps the old reference when nothing changed, so nothing re-renders', () => {
    const old = [{ a: 1 }]
    expect(keepIfSame([{ a: 1 }])(old)).toBe(old)
    const next = [{ a: 2 }]
    expect(keepIfSame(next)(old)).toBe(next)
  })
})
