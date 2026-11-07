import { describe, expect, it, vi } from 'vitest'
import { addUser, setLeft, setRoles } from '../mocks/directory'

// test/setup.ts swaps ../api/auth for a stub; the offline mock itself is tested here
const { login } = await vi.importActual<typeof import('./auth.mock')>('./auth.mock')

describe('offline sign-in reads the admin’s directory', () => {
  it('an account the admin added signs in as itself', async () => {
    const ann = addUser({ name: 'Ann Lee', email: 'ann@example.com', roles: ['student'] })
    expect(await login('Ann@Example.com', 'anything')).toEqual({ id: ann.id, name: 'Ann Lee', email: 'ann@example.com', roles: ['student'] })
  })

  it('a lecturer role given until a date comes with its end date, so it ends by itself', async () => {
    setRoles(901, ['mentor', 'lecturer'], { lecturer: '2999-01-01T00:00:00.000Z' })
    expect(await login('mentor@xsolla.school', 'x')).toMatchObject({ id: 901, roles: ['mentor', 'lecturer'], roleUntil: { lecturer: '2999-01-01T00:00:00.000Z' } })
    setRoles(901, ['mentor', 'lecturer'], { lecturer: '2001-01-01T00:00:00.000Z' })
    expect((await login('mentor@xsolla.school', 'x')).roles).toEqual(['mentor'])
  })

  it('a student who left the school cannot sign in', async () => {
    setLeft(101, true)
    await expect(login('leyla.hasanova@example.com', 'x')).rejects.toThrow('This account is no longer active.')
  })

  it('the demo accounts and the admin still work', async () => {
    expect((await login('lecturer@xsolla.school', 'x')).roles).toEqual(['mentor', 'lecturer'])
    expect((await login('admin@xsolla.school', 'x')).roles).toEqual(['admin'])
    expect((await login('someone@new.co', 'x')).roles).toEqual(['student'])
  })
})
