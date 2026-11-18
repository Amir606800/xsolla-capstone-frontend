import { afterEach, describe, expect, it, vi } from 'vitest'
import { noteServerDate, resetServerTime, serverNow, serverNowMs } from './serverTime'

let perf = 1000
afterEach(() => {
  resetServerTime()
  vi.restoreAllMocks()
})
const stubPerf = () => vi.spyOn(performance, 'now').mockImplementation(() => perf)

describe('server time', () => {
  it("uses the device's clock until the server has answered", () => {
    expect(Math.abs(serverNowMs() - Date.now())).toBeLessThan(50)
  })

  it("follows the server's Date header, not the device's clock", () => {
    stubPerf()
    perf = 1000
    // the device says 2030, the server says 18 Nov 2026 10:00:00 (the header is whole seconds: +0.5 s on average)
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2030, 0, 1))
    noteServerDate('Wed, 18 Nov 2026 10:00:00 GMT', 900, 1100)
    expect(serverNow().toISOString()).toBe('2026-11-18T10:00:00.500Z')

    // a minute of real time later, whatever the device's clock was set to in between
    perf += 60_000
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2031, 5, 1))
    expect(serverNow().toISOString()).toBe('2026-11-18T10:01:00.500Z')
  })

  it('keeps its reading through rounding, and starts again when the server is really somewhere else', () => {
    stubPerf()
    perf = 0
    noteServerDate('Wed, 18 Nov 2026 10:00:00 GMT', 0, 0)
    perf = 10_000
    noteServerDate('Wed, 18 Nov 2026 10:00:11 GMT', 10_000, 10_000) // 1 s off: rounding and travel time
    expect(serverNow().toISOString()).toBe('2026-11-18T10:00:10.500Z')
    noteServerDate('Wed, 18 Nov 2026 12:00:00 GMT', 10_000, 10_000) // the device slept, or the server moved
    expect(serverNow().toISOString()).toBe('2026-11-18T12:00:00.500Z')
  })

  it('ignores a missing or broken header', () => {
    noteServerDate(undefined, 0, 0)
    noteServerDate('not a date', 0, 0)
    expect(Math.abs(serverNowMs() - Date.now())).toBeLessThan(50)
  })
})
