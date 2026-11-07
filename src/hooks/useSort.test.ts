import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { compareValues, useSort } from './useSort'

describe('compareValues', () => {
  it('sorts text in natural order, ignoring case', () => {
    const teams = ['Team 10', 'team 2', 'Team 1']
    expect([...teams].sort((a, b) => compareValues(a, b, 'asc'))).toEqual(['Team 1', 'team 2', 'Team 10'])
  })

  it('sorts numbers by size', () => {
    expect([10, 2, 33].sort((a, b) => compareValues(a, b, 'asc'))).toEqual([2, 10, 33])
    expect([10, 2, 33].sort((a, b) => compareValues(a, b, 'desc'))).toEqual([33, 10, 2])
  })

  it('puts empty values last in both directions', () => {
    const values = ['b', undefined, 'a', '', null]
    expect([...values].sort((a, b) => compareValues(a, b, 'asc')).slice(0, 2)).toEqual(['a', 'b'])
    expect([...values].sort((a, b) => compareValues(a, b, 'desc')).slice(0, 2)).toEqual(['b', 'a'])
  })
})

describe('useSort', () => {
  const rows = [
    { name: 'Cem', team: 'Team 2' },
    { name: 'Ali', team: undefined },
    { name: 'Bea', team: 'Team 1' },
  ]
  const columns = { name: (r: (typeof rows)[number]) => r.name, team: (r: (typeof rows)[number]) => r.team }

  it('keeps the given order until a column is picked', () => {
    const { result } = renderHook(() => useSort(rows, columns))
    expect(result.current.sorted.map((r) => r.name)).toEqual(['Cem', 'Ali', 'Bea'])
    expect(result.current.sort).toBeNull()
  })

  it('a column sorts ascending, again descending; another column starts ascending', () => {
    const { result } = renderHook(() => useSort(rows, columns, { key: 'name', dir: 'asc' }))
    expect(result.current.sorted.map((r) => r.name)).toEqual(['Ali', 'Bea', 'Cem'])
    act(() => result.current.toggle('name'))
    expect(result.current.sorted.map((r) => r.name)).toEqual(['Cem', 'Bea', 'Ali'])
    act(() => result.current.toggle('team'))
    expect(result.current.sort).toEqual({ key: 'team', dir: 'asc' })
    // the one without a team goes last
    expect(result.current.sorted.map((r) => r.name)).toEqual(['Bea', 'Cem', 'Ali'])
  })

  it('ties keep their original order', () => {
    const same = [
      { name: 'x', n: 1 },
      { name: 'y', n: 1 },
      { name: 'z', n: 0 },
    ]
    const { result } = renderHook(() => useSort(same, { n: (r) => r.n }, { key: 'n', dir: 'asc' }))
    expect(result.current.sorted.map((r) => r.name)).toEqual(['z', 'x', 'y'])
  })
})
