import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { saveTokens } from './session'
import { fetchMentorTeam, fetchMyTeam, mapTeamDetail } from './teams'

// the shared test setup replaces this module with the demo store; here the real one is under test
vi.unmock('./teams')

const BASE = 'https://api.test'
const ME = { id: 1, name: 'Sam', email: 'sam@x.co' }
let paths: string[]

/** Answers one route; anything else is a 404 like the Go server. */
async function backend(path: string, status: number, body: unknown) {
  paths = []
  await stubHttp(
    vi.fn(async (url: string) => {
      const p = url.replace(BASE, '')
      paths.push(p)
      return p === path ? new Response(JSON.stringify(body), { status }) : new Response(JSON.stringify({ error: 'not_found', message: 'nope' }), { status: 404 })
    }),
  )
}

const DETAIL = {
  id: 3,
  name: 'Team 3',
  mentor: { id: 900, name: 'Rashad', email: 'rashad@x.co' },
  members: [{ id: 1, name: 'Sam', email: 'sam@x.co' }],
  cohort_size: 29,
  team_count: 6,
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

describe('"My team" on the real server', () => {
  it('a student gets their team from GET /teams/me', async () => {
    await backend('/teams/me', 200, DETAIL)
    expect(await fetchMyTeam(ME)).toEqual({
      id: '3',
      name: 'Team 3',
      mentor: { id: 900, name: 'Rashad', email: 'rashad@x.co' },
      members: [{ id: 1, name: 'Sam', email: 'sam@x.co' }],
      cohortSize: 29,
      teamCount: 6,
    })
  })

  it('a mentor gets theirs from GET /mentors/me/team', async () => {
    await backend('/mentors/me/team', 200, DETAIL)
    expect((await fetchMentorTeam(ME))?.name).toBe('Team 3')
    expect(paths).toEqual(['/mentors/me/team'])
  })

  it('404 means no team yet: null, not an error', async () => {
    await backend('/teams/me', 404, { error: 'not_found', message: 'no team found' })
    expect(await fetchMyTeam(ME)).toBeNull()
  })

  it('other failures are errors', async () => {
    await backend('/teams/me', 500, { error: 'server_error', message: 'boom' })
    await expect(fetchMyTeam(ME)).rejects.toThrow()
  })
})

describe('mapTeamDetail', () => {
  it('a team without a mentor has none, and missing counts fall back to the team itself', () => {
    const team = mapTeamDetail({ id: 4, name: 'Team 4', members: [{ id: 2, name: 'A', email: 'a@x.co' }] })
    expect(team).not.toHaveProperty('mentor')
    expect(team).toMatchObject({ cohortSize: 1, teamCount: 1 })
    expect(mapTeamDetail({ id: 5, name: 'Empty', mentor: null, members: null }).members).toEqual([])
  })

  it('the mentor and the members keep the picture address the server sends', () => {
    const team = mapTeamDetail({
      id: 4,
      name: 'Team 4',
      mentor: { id: 9, name: 'M', email: 'm@x.co', avatar_url: 'http://api.test/avatars/m.webp' },
      members: [
        { id: 2, name: 'A', email: 'a@x.co', avatar_url: 'http://api.test/avatars/a.png' },
        { id: 3, name: 'B', email: 'b@x.co', avatar_url: null },
      ],
    })
    expect(team.mentor?.avatarUrl).toBe('http://api.test/avatars/m.webp')
    expect(team.members[0].avatarUrl).toBe('http://api.test/avatars/a.png')
    expect(team.members[1]).not.toHaveProperty('avatarUrl')
  })
})
