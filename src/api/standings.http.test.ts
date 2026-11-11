import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { saveTokens } from './session'
import { fetchStandings, fetchTeamStandings, saveWeekGrade } from './standings.http'

const BASE = 'https://api.test'
type Call = { method: string; path: string; body?: unknown }
let calls: Call[]
let grades: Record<string, string | null>

/**
 * A fake backend with two weeks (modules 7 and 5, made in that order of creation: 5 first) and a team of two
 * (students 2 and 4). Student 9 is in another team. Grades live on the enrollments.
 */
async function backend({ teamStatus = 200, forbidWeek }: { teamStatus?: number; forbidWeek?: string } = {}) {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '')
      const method = init.method ?? 'GET'
      calls.push({ method, path, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) })
      const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
      if (method === 'GET' && path === '/modules') {
        return ok([
          { id: 7, title: 'Week B', created_by: 1, created_at: '2026-11-08T00:00:00Z', opens_at: '2026-11-09T00:00:00Z', closes_at: '2026-11-15T23:59:00Z' },
          { id: 5, title: 'Week A', created_by: 1, created_at: '2026-11-01T00:00:00Z', opens_at: '2026-11-02T00:00:00Z', closes_at: '2026-11-08T23:59:00Z' },
        ])
      }
      if (path === '/mentors/me/team') {
        return teamStatus === 200
          ? ok({ id: 1, name: 'Team 1', members: [{ id: 2, name: 'A', email: 'a@x' }, { id: 4, name: 'B', email: 'b@x' }] })
          : new Response(JSON.stringify({ error: 'not_found', message: 'no team' }), { status: teamStatus })
      }
      const list = path.match(/^\/modules\/(\d+)\/enrollments$/)
      if (method === 'GET' && list) {
        if (list[1] === forbidWeek) return new Response(JSON.stringify({ error: 'forbidden', message: 'not enrolled' }), { status: 403 })
        return ok([2, 4, 9].map((u) => ({ id: u, module_id: Number(list[1]), user_id: u, grade: grades[`${list[1]}:${u}`] ?? null, created_at: '2026-11-01T00:00:00Z' })))
      }
      const grade = path.match(/^\/modules\/(\d+)\/enrollments\/(\d+)\/grade$/)
      if (method === 'PATCH' && grade) {
        if (grade[2] === '77') return new Response(JSON.stringify({ error: 'not_found', message: 'enrollment not found' }), { status: 404 })
        grades[`${grade[1]}:${grade[2]}`] = (JSON.parse(init.body as string) as { grade: string }).grade
        return ok({})
      }
      return new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', BASE)
  saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
  grades = { '5:2': 'green', '5:4': 'yellow', '7:2': 'red', '5:9': 'green', '7:4': 'purple' }
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('weekly grades on the real backend (enrollment grades)', () => {
  it('the mentor reads only their team, week numbers in course order, and unknown values are dropped', async () => {
    await backend()
    const rows = await fetchTeamStandings()
    expect(rows.map((r) => [r.week, r.studentId, r.level])).toEqual([
      [1, 2, 'green'],
      [1, 4, 'yellow'],
      [2, 2, 'red'],
    ])
    // no "graded at" on the server: the week's closing date stands in
    expect(rows[0].assessedAt).toBe('2026-11-08T23:59:00Z')
  })

  it('saving PATCHes the enrollment of that week with the level, then reads the team again', async () => {
    await backend()
    const rows = await saveWeekGrade(4, 2, 'green')
    expect(calls.find((c) => c.method === 'PATCH')).toEqual({ method: 'PATCH', path: '/modules/7/enrollments/4/grade', body: { grade: 'green' } })
    expect(rows.find((r) => r.week === 2 && r.studentId === 4)?.level).toBe('green')
  })

  it('a student who is not enrolled in the week gets a plain answer', async () => {
    await backend()
    await expect(saveWeekGrade(77, 1, 'red')).rejects.toThrow('This student is not enrolled in this week, so it cannot be graded.')
  })

  it('a week that is not on the server cannot be graded', async () => {
    await backend()
    await expect(saveWeekGrade(2, 9, 'red')).rejects.toThrow('Week 9 is not on the server.')
  })

  it('a week whose enrollments the caller may not read counts as not graded', async () => {
    await backend({ forbidWeek: '5' })
    expect((await fetchTeamStandings()).map((r) => r.week)).toEqual([2])
  })

  it('a mentor without a team sees no grades', async () => {
    await backend({ teamStatus: 404 })
    expect(await fetchTeamStandings()).toEqual([])
  })

  it('a student reads their own grades only, without the team route', async () => {
    await backend()
    expect(await fetchStandings(2)).toEqual([
      { week: 1, level: 'green', assessedAt: '2026-11-08T23:59:00Z' },
      { week: 2, level: 'red', assessedAt: '2026-11-15T23:59:00Z' },
    ])
    expect(calls.some((c) => c.path === '/mentors/me/team')).toBe(false)
  })
})
