import { DEFAULT_ORDER, SIZES, WIDGETS } from '../config/dashboardWidgets'
import type { WidgetId, WidgetSize } from '../config/dashboardWidgets'

/** One widget in the student's layout. Hidden widgets stay in the list so nothing gets lost. */
export interface WidgetState {
  id: WidgetId
  size: WidgetSize
  visible: boolean
}

/** Array order = order on the page. */
export type DashboardLayout = WidgetState[]

export const LAYOUT_STORAGE_PREFIX = 'dashboard_layout'

export function defaultLayout(): DashboardLayout {
  return DEFAULT_ORDER.map((id) => ({ id, size: WIDGETS[id].defaultSize, visible: true }))
}

function isWidgetId(v: unknown): v is WidgetId {
  return typeof v === 'string' && v in WIDGETS
}

/**
 * Turns whatever was stored into a valid layout: unknown or duplicate widgets are dropped,
 * a size the widget can't have falls back to its default, and widgets that did not exist when
 * the layout was saved (added in a later release) are appended and shown.
 */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const seen = new Set<WidgetId>()
  const result: DashboardLayout = []

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== 'object' || entry === null) continue
      const { id, size, visible } = entry as Record<string, unknown>
      if (!isWidgetId(id) || seen.has(id)) continue
      seen.add(id)
      const allowed = WIDGETS[id].sizes
      result.push({
        id,
        size: SIZES.includes(size as WidgetSize) && allowed.includes(size as WidgetSize) ? (size as WidgetSize) : WIDGETS[id].defaultSize,
        visible: visible !== false,
      })
    }
  }

  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) result.push({ id, size: WIDGETS[id].defaultSize, visible: true })
  }
  return result
}

export function loadLayout(key: string): DashboardLayout {
  try {
    const saved = localStorage.getItem(key)
    if (saved) return normalizeLayout(JSON.parse(saved))
  } catch {
    // unreadable or blocked storage: use the default
  }
  return defaultLayout()
}

export function saveLayout(key: string, layout: DashboardLayout): void {
  try {
    localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    // storage unavailable: the layout just won't be remembered
  }
}

export const visibleWidgets = (layout: DashboardLayout) => layout.filter((w) => w.visible)
export const hiddenWidgets = (layout: DashboardLayout) => layout.filter((w) => !w.visible)

/** Puts `id` where `overId` is (drag and drop). */
export function moveWidget(layout: DashboardLayout, id: WidgetId, overId: WidgetId): DashboardLayout {
  const from = layout.findIndex((w) => w.id === id)
  const to = layout.findIndex((w) => w.id === overId)
  if (from < 0 || to < 0 || from === to) return layout
  const next = layout.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Moves a widget one place earlier (-1) or later (+1) among the widgets that are shown. */
export function moveWidgetBy(layout: DashboardLayout, id: WidgetId, direction: -1 | 1): DashboardLayout {
  const shown = visibleWidgets(layout)
  const index = shown.findIndex((w) => w.id === id)
  const neighbour = shown[index + direction]
  if (index < 0 || !neighbour) return layout
  return moveWidget(layout, id, neighbour.id)
}

export function resizeWidget(layout: DashboardLayout, id: WidgetId, size: WidgetSize): DashboardLayout {
  const current = layout.find((w) => w.id === id)
  if (!current || current.size === size || !WIDGETS[id].sizes.includes(size)) return layout
  return layout.map((w) => (w.id === id ? { ...w, size } : w))
}

/** Hides a widget, or shows it again at the end of the page. */
export function setWidgetVisible(layout: DashboardLayout, id: WidgetId, visible: boolean): DashboardLayout {
  const current = layout.find((w) => w.id === id)
  if (!current || current.visible === visible) return layout
  if (!visible) return layout.map((w) => (w.id === id ? { ...w, visible } : w))
  return [...layout.filter((w) => w.id !== id), { ...current, visible }]
}
