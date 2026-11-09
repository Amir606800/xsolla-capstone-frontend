import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { saveTokens } from './session'

const BASE = 'https://api.test'
type Call = { method: string; path: string; body?: unknown }
let calls: Call[]
let teams: { id: number; name: string; mentor_id: number | null; student_ids: number[] }[]

/** A tiny fake of the server's team routes, with the rules the real one has. */
async function server() {
  calls = []
  await stubHttp(async (url: string, init: RequestInit) => {
    const path = url.replace(BASE, '')
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push({ method: init.method ?? 'GET', path, body })
    const json = (status: number, data?: unknown) => new Response(data === undefined ? null : JSON.stringify(data), { status })
    if (path.startsWith('/users/') && init.method === 'PATCH') return json(200, { id: 903 })
    if (path === '/teams' && init.method === 'GET') return json(200, teams)
    if (path === '/teams' && init.method === 'PUT') {
      teams = body.teams.map((t: { mentor_id: number | null; student_ids: number[] }, i: number) => ({ id: i + 1, name: `Team ${i + 1}`, mentor_id: t.mentor_id, student_ids: t.student_ids }))
      return json(200, teams)
    }
    if (path === '/teams' && init.method === 'POST') {
      if (!body.name) return json(422, { error: 'validation_failed', message: 'invalid team configuration' })
      const taken = teams.find((t) => t.student_ids.some((id) => body.student_ids.includes(id)))
      if (taken) return json(422, { error: 'validation_failed', message: 'student already in another team' })
      const team = { id: Math.max(0, ...teams.map((t) => t.id)) + 1, name: body.name, mentor_id: null, student_ids: body.student_ids }
      teams.push(team)
      return json(201, team)
    }
    const m = /^\/teams\/(\d+)\/(students|mentor)(?:\/(\d+))?$/.exec(path)
    if (m) {
      const team = teams.find((t) => t.id === Number(m[1]))
      if (!team) return json(404, { error: 'not_found', message: 'team not found' })
      if (m[2] === 'students' && init.method === 'POST') {
        if (teams.some((t) => t.student_ids.some((id) => body.student_ids.includes(id)))) return json(422, { error: 'validation_failed', message: 'student already in another team' })
        team.student_ids.push(...body.student_ids)
        return json(204)
      }
      if (m[2] === 'students' && init.method === 'DELETE') {
        team.student_ids = team.student_ids.filter((id) => id !== Number(m[3]))
        return json(204)
      }
      if (m[2] === 'mentor' && init.method === 'PUT') {
        // one team per mentor: they leave the team they led
        for (const t of teams) if (body.mentor_id !== null && t.mentor_id === body.mentor_id) t.mentor_id = null
        team.mentor_id = body.mentor_id
        return json(204)
      }
    }
    // no DELETE /teams/:id on this server: Go's router answers 405 for a known path with another method
    if (/^\/teams\/\d+$/.test(path) && init.method === 'DELETE') return new Response('Method Not Allowed', { status: 405 })
    return json(404, { error: 'not_found', message: 'missing' })
  })
}

const sent = () => calls.map((c) => `${c.method} ${c.path}`)

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_URL', BASE)
  saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
  teams = [
    { id: 1, name: 'Team 1', mentor_id: 903, student_ids: [121, 122] },
    { id: 2, name: 'Team 2', mentor_id: 904, student_ids: [131] },
  ]
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('teams on the real backend', () => {
  it('GET /teams: ids become strings, mentor and students numbers, null lists are empty', async () => {
    teams.push({ id: 3, name: 'Team 3', mentor_id: null, student_ids: null as unknown as number[] })
    await server()
    const { fetchTeams, teamsAreDemoData } = await import('./directory')
    expect(await fetchTeams()).toEqual([
      { id: '1', name: 'Team 1', mentorId: 903, studentIds: [121, 122] },
      { id: '2', name: 'Team 2', mentorId: 904, studentIds: [131] },
      { id: '3', name: 'Team 3', mentorId: null, studentIds: [] },
    ])
    expect(teamsAreDemoData()).toBe(false)
  })

  it('adds one team: POST /teams with the name and students, then the mentor with PUT /teams/:id/mentor', async () => {
    await server()
    const { createTeam } = await import('./directory')
    const made = await createTeam({ name: '  Rockets ', mentorId: 903, studentIds: [161, 162] })
    expect(sent()).toEqual(['POST /teams', 'PUT /teams/3/mentor'])
    expect(calls[0].body).toEqual({ name: 'Rockets', student_ids: [161, 162] })
    expect(calls[1].body).toEqual({ mentor_id: 903 })
    expect(made).toMatchObject({ id: '3', name: 'Rockets', mentorId: 903, studentIds: [161, 162] })
    // the mentor left Team 1 (done by the server)
    expect(teams.find((t) => t.id === 1)!.mentor_id).toBeNull()
  })

  it('a team without a mentor is one call', async () => {
    await server()
    const { createTeam } = await import('./directory')
    await createTeam({ name: 'Rockets', mentorId: null, studentIds: [] })
    expect(sent()).toEqual(['POST /teams'])
  })

  it('the server’s refusals reach the screen as they are: a student already in a team, an empty name', async () => {
    await server()
    const { createTeam } = await import('./directory')
    await expect(createTeam({ name: 'Rockets', mentorId: null, studentIds: [121] })).rejects.toMatchObject({
      status: 422,
      message: 'Student already in another team',
    })
    await expect(createTeam({ name: '', mentorId: null, studentIds: [] })).rejects.toMatchObject({ status: 422 })
  })

  it('deleting one team: the server has no such route yet, and the admin is told so', async () => {
    await server()
    const { removeTeam } = await import('./directory')
    await expect(removeTeam('2')).rejects.toMatchObject({ status: 501, message: 'The server cannot delete a single team yet.' })
    expect(sent()).toEqual(['DELETE /teams/2'])
    expect(teams).toHaveLength(2)
  })

  it('moving a student: out of the old team, then into the new one (the server never moves anyone)', async () => {
    await server()
    const { moveStudent } = await import('./directory')
    await moveStudent(121, '2')
    expect(sent()).toEqual(['GET /teams', 'DELETE /teams/1/students/121', 'POST /teams/2/students'])
    expect(calls[2].body).toEqual({ student_ids: [121] })
    expect(teams.map((t) => t.student_ids)).toEqual([[122], [131, 121]])
  })

  it('putting a student in a team, or taking them out of theirs', async () => {
    await server()
    const { moveStudent } = await import('./directory')
    await moveStudent(121, null)
    expect(sent()).toEqual(['GET /teams', 'DELETE /teams/1/students/121'])
    calls.length = 0
    await moveStudent(121, '2')
    expect(sent()).toEqual(['GET /teams', 'POST /teams/2/students'])
    calls.length = 0
    await moveStudent(121, '2') // already there: nothing to do
    expect(sent()).toEqual(['GET /teams'])
  })

  it('changes a team’s mentor with PUT /teams/:id/mentor; null takes the mentor off', async () => {
    await server()
    const { changeTeamMentor } = await import('./directory')
    await changeTeamMentor('2', 903)
    expect(calls[0]).toEqual({ method: 'PUT', path: '/teams/2/mentor', body: { mentor_id: 903 } })
    expect(teams.map((t) => t.mentor_id)).toEqual([null, 903])
    await changeTeamMentor('2', null)
    expect(teams[1].mentor_id).toBeNull()
  })

  it('random teams: PUT /teams with the whole plan; removing all teams sends an empty list', async () => {
    await server()
    const { buildTeams, removeAllTeams } = await import('./directory')
    await buildTeams([
      { mentorId: 901, studentIds: [1, 101] },
      { mentorId: null, studentIds: [102] },
    ])
    expect(calls[0]).toEqual({
      method: 'PUT',
      path: '/teams',
      body: { teams: [{ mentor_id: 901, student_ids: [1, 101] }, { mentor_id: null, student_ids: [102] }] },
    })
    await removeAllTeams()
    expect(calls[1].body).toEqual({ teams: [] })
    expect(teams).toEqual([])
  })

  it('a new student goes into their team, a new mentor leads it', async () => {
    await server()
    const { createStaff, createStudent } = await import('./directory')
    const created = [
      { id: '77', email: 'ann@example.com', name: 'Ann Lee', role: 'student' },
      { id: '78', email: 'nil@example.com', name: 'Nil Ay', roles: ['mentor'] },
    ]
    await stubHttp(async (url: string, init: RequestInit) => {
      const path = url.replace(BASE, '')
      if (path === '/auth/signup') return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: created[0] }), { status: 201 })
      if (path === '/auth/logout') return new Response(null, { status: 204 })
      if (path === '/users') return new Response(JSON.stringify(created[1]), { status: 201 })
      if (path === '/teams' && init.method === 'GET') return new Response(JSON.stringify(teams), { status: 200 })
      calls.push({ method: init.method ?? 'GET', path, body: init.body ? JSON.parse(init.body as string) : undefined })
      return new Response(null, { status: 204 })
    })
    calls = []
    await createStudent({ name: 'Ann Lee', email: 'ann@example.com', password: 'Tq7mWz4kPd', teamId: '2' })
    await createStaff({ name: 'Nil Ay', email: 'nil@example.com', password: 'Tq7mWz4kPd', teamId: '1' }, 'mentor')
    expect(sent()).toEqual(['POST /teams/2/students', 'PUT /teams/1/mentor'])
    expect(calls[0].body).toEqual({ student_ids: [77] })
    expect(calls[1].body).toEqual({ mentor_id: 78 })
  })

  it('editing a mentor’s team: no team frees the team they lead', async () => {
    await server()
    const { updateMentor } = await import('./directory')
    await updateMentor(903, { name: 'Farid Mammadli', email: 'farid@example.com', teamId: null })
    expect(sent()).toEqual(['PATCH /users/903', 'GET /teams', 'PUT /teams/1/mentor'])
    expect(calls[2].body).toEqual({ mentor_id: null })
  })
})
