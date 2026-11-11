import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { commentOnSubmission, fetchTeamSubmissions, latestPerStudent } from './reviews.http'
import { saveTokens } from './session'

const BASE = 'https://api.test'
type Call = { method: string; path: string; body?: unknown }
let calls: Call[]

const sub = (id: number, student: number, at: string, extra: object = {}) => ({
  id,
  content_item_id: 11,
  student_id: student,
  text_body: `work ${id}`,
  submitted_at: at,
  created_at: at,
  ...extra,
})

/** A week (module 1) with one task (11) and one file; the mentor's team handed in 3 attempts (student 3 twice). */
async function backend() {
  calls = []
  await stubHttp(
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '')
      const method = init.method ?? 'GET'
      calls.push({ method, path, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) })
      const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
      if (path === '/modules') return ok([{ id: 1, title: 'cs101', created_by: 1, created_at: '2026-11-11T00:00:00Z' }])
      if (path === '/modules/1/content-items') {
        return ok([
          { id: 11, type: 'assignment', title: 'task', position: 0, is_visible: true, file_id: null, due_at: '2026-11-20T18:00:00Z' },
          { id: 12, type: 'file', title: 'kitab', position: 1, is_visible: true, file_id: 2 },
        ])
      }
      if (path === '/modules/1/content-items/11/submissions') {
        return ok([
          sub(1, 3, '2026-11-11T13:00:00Z', { files: [{ id: 1, original_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 9 }] }),
          sub(4, 3, '2026-11-11T15:00:00Z', { feedback: 'Nice', graded_at: '2026-11-11T16:00:00Z' }),
          sub(5, 6, '2026-11-11T14:00:00Z'),
        ])
      }
      if (method === 'POST' && path === '/submissions/5/feedback') return ok({})
      return new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', BASE)
  saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("the mentor's view of the team's hand-ins on the real backend", () => {
  it('reads every task roster of every week; files are not tasks', async () => {
    await backend()
    const list = await fetchTeamSubmissions()
    expect(calls.map((c) => c.path)).toEqual(['/modules', '/modules/1/content-items', '/modules/1/content-items/11/submissions'])
    expect(list.map((s) => [s.studentId, s.assignmentId, s.id])).toEqual([
      [3, '11', '4'],
      [6, '11', '5'],
    ])
  })

  it('one entry per student: the latest attempt, the earlier ones as history, the comment and when it was written', async () => {
    await backend()
    const [three] = await fetchTeamSubmissions()
    expect(three).toMatchObject({ textBody: 'work 4', feedback: 'Nice', commentedAt: '2026-11-11T16:00:00Z' })
    expect(three.history).toEqual([{ submittedAt: '2026-11-11T13:00:00Z', textBody: 'work 1', files: [{ id: '1', name: 'a.pdf', sizeBytes: 9 }] }])
  })

  it('a comment goes to the latest attempt of that student and task', async () => {
    await backend()
    await commentOnSubmission(6, '11', '  Good start  ')
    expect(calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', path: '/submissions/5/feedback', body: { feedback: 'Good start' } })
  })

  it('commenting on work that is not there says so', async () => {
    await backend()
    await expect(commentOnSubmission(99, '11', 'Hi')).rejects.toThrow('This work is not on the server any more.')
  })

  it('no attempts, no entries', () => {
    expect(latestPerStudent([], '11')).toEqual([])
  })
})
