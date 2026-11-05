import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultLayout,
  hiddenWidgets,
  loadLayout,
  moveWidget,
  moveWidgetBy,
  normalizeLayout,
  resizeWidget,
  saveLayout,
  setWidgetVisible,
  visibleWidgets,
} from './dashboardLayout'

const ids = (l: { id: string }[]) => l.map((w) => w.id)

describe('defaultLayout', () => {
  it('shows all five widgets, the module path full width first', () => {
    const l = defaultLayout()
    expect(ids(l)).toEqual(['progress', 'current-task', 'deadlines', 'grades', 'activity'])
    expect(l.every((w) => w.visible)).toBe(true)
    expect(l[0]).toMatchObject({ id: 'progress', size: 'full' })
    expect(l[1]).toMatchObject({ id: 'current-task', size: 'sm' })
  })

  it('returns a fresh copy each time', () => {
    expect(defaultLayout()).not.toBe(defaultLayout())
  })
})

describe('moveWidget', () => {
  it('puts the widget where the other one is', () => {
    expect(ids(moveWidget(defaultLayout(), 'activity', 'progress'))).toEqual([
      'activity',
      'progress',
      'current-task',
      'deadlines',
      'grades',
    ])
  })

  it('moves forwards too', () => {
    expect(ids(moveWidget(defaultLayout(), 'progress', 'deadlines'))).toEqual([
      'current-task',
      'deadlines',
      'progress',
      'grades',
      'activity',
    ])
  })

  it('does nothing for the same widget or an unknown one', () => {
    const l = defaultLayout()
    expect(moveWidget(l, 'grades', 'grades')).toBe(l)
    expect(moveWidget(l, 'grades', 'nope' as never)).toBe(l)
  })
})

describe('moveWidgetBy', () => {
  it('swaps with the next shown widget, skipping hidden ones', () => {
    let l = setWidgetVisible(defaultLayout(), 'current-task', false)
    l = moveWidgetBy(l, 'progress', 1)
    expect(ids(visibleWidgets(l))).toEqual(['deadlines', 'progress', 'grades', 'activity'])
  })

  it('does nothing at the ends', () => {
    const l = defaultLayout()
    expect(moveWidgetBy(l, 'progress', -1)).toBe(l)
    expect(moveWidgetBy(l, 'activity', 1)).toBe(l)
  })
})

describe('resizeWidget', () => {
  it('changes the size', () => {
    const l = resizeWidget(defaultLayout(), 'deadlines', 'full')
    expect(l.find((w) => w.id === 'deadlines')?.size).toBe('full')
  })

  it('refuses a size the widget cannot have (the module path needs room)', () => {
    const l = defaultLayout()
    expect(resizeWidget(l, 'progress', 'sm')).toBe(l)
  })

  it('does not change anything when the size is the same', () => {
    const l = defaultLayout()
    expect(resizeWidget(l, 'grades', 'md')).toBe(l)
  })
})

describe('setWidgetVisible', () => {
  it('hides a widget but keeps it in the list', () => {
    const l = setWidgetVisible(defaultLayout(), 'grades', false)
    expect(ids(visibleWidgets(l))).not.toContain('grades')
    expect(ids(hiddenWidgets(l))).toEqual(['grades'])
    expect(l).toHaveLength(5)
  })

  it('shows a widget again at the end of the page, keeping its size', () => {
    let l = resizeWidget(defaultLayout(), 'grades', 'full')
    l = setWidgetVisible(l, 'grades', false)
    l = setWidgetVisible(l, 'grades', true)
    expect(ids(visibleWidgets(l)).at(-1)).toBe('grades')
    expect(l.find((w) => w.id === 'grades')?.size).toBe('full')
  })

  it('is a no-op when nothing changes', () => {
    const l = defaultLayout()
    expect(setWidgetVisible(l, 'grades', true)).toBe(l)
  })
})

describe('normalizeLayout (what comes out of storage)', () => {
  it('falls back to the default for garbage', () => {
    for (const junk of [null, undefined, 42, 'x', {}, []]) {
      expect(normalizeLayout(junk)).toEqual(defaultLayout())
    }
  })

  it('drops unknown and duplicate widgets', () => {
    const l = normalizeLayout([
      { id: 'grades', size: 'md', visible: true },
      { id: 'grades', size: 'sm', visible: false },
      { id: 'weather', size: 'md', visible: true },
      null,
    ])
    expect(ids(l).filter((i) => i === 'grades')).toHaveLength(1)
    expect(ids(l)).not.toContain('weather')
    expect(l.find((w) => w.id === 'grades')).toMatchObject({ size: 'md', visible: true })
  })

  it('fixes an invalid size', () => {
    const l = normalizeLayout([
      { id: 'progress', size: 'sm', visible: true }, // not allowed for the path
      { id: 'grades', size: 'huge', visible: true },
    ])
    expect(l.find((w) => w.id === 'progress')?.size).toBe('full')
    expect(l.find((w) => w.id === 'grades')?.size).toBe('md')
  })

  it('adds widgets that did not exist when the layout was saved, and shows them', () => {
    const l = normalizeLayout([{ id: 'grades', size: 'md', visible: true }])
    expect(ids(l)).toEqual(['grades', 'progress', 'current-task', 'deadlines', 'activity'])
    expect(l.slice(1).every((w) => w.visible)).toBe(true)
  })

  it('keeps hidden widgets hidden', () => {
    const l = normalizeLayout([{ id: 'grades', size: 'md', visible: false }])
    expect(l.find((w) => w.id === 'grades')?.visible).toBe(false)
  })
})

describe('load / save', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a layout', () => {
    const l = moveWidget(defaultLayout(), 'activity', 'progress')
    saveLayout('k', l)
    expect(loadLayout('k')).toEqual(l)
  })

  it('uses the default when nothing or something broken is stored', () => {
    expect(loadLayout('k')).toEqual(defaultLayout())
    localStorage.setItem('k', '{not json')
    expect(loadLayout('k')).toEqual(defaultLayout())
  })
})
