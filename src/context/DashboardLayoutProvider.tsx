import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { WidgetId, WidgetSize } from '../config/dashboardWidgets'
import { useAuth } from '../hooks/useAuth'
import {
  LAYOUT_STORAGE_PREFIX,
  defaultLayout,
  loadLayout,
  moveWidget,
  moveWidgetBy,
  resizeWidget,
  saveLayout,
  setWidgetVisible,
} from '../utils/dashboardLayout'
import type { DashboardLayout } from '../utils/dashboardLayout'
import { DashboardLayoutContext } from './dashboardLayout'

/**
 * Holds the student's dashboard layout (order, sizes, shown/hidden). It lives above the pages
 * so the header can also know whether the "Current task" widget is on the dashboard.
 * Saved per user in localStorage for now; later this becomes a per-user setting on the backend.
 */
export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const storageKey = `${LAYOUT_STORAGE_PREFIX}:${user?.id ?? 'guest'}`
  const [layout, setLayout] = useState<DashboardLayout>(() => loadLayout(storageKey))

  // every change is saved right away
  const update = useCallback(
    (change: (current: DashboardLayout) => DashboardLayout) => {
      setLayout((current) => {
        const next = change(current)
        if (next !== current) saveLayout(storageKey, next)
        return next
      })
    },
    [storageKey],
  )

  const value = useMemo(
    () => ({
      layout,
      isShown: (id: WidgetId) => layout.some((w) => w.id === id && w.visible),
      move: (id: WidgetId, overId: WidgetId) => update((l) => moveWidget(l, id, overId)),
      moveBy: (id: WidgetId, direction: -1 | 1) => update((l) => moveWidgetBy(l, id, direction)),
      resize: (id: WidgetId, size: WidgetSize) => update((l) => resizeWidget(l, id, size)),
      setShown: (id: WidgetId, shown: boolean) => update((l) => setWidgetVisible(l, id, shown)),
      reset: () => update(() => defaultLayout()),
    }),
    [layout, update],
  )

  return <DashboardLayoutContext.Provider value={value}>{children}</DashboardLayoutContext.Provider>
}
