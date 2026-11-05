import { createContext } from 'react'
import type { WidgetId, WidgetSize } from '../config/dashboardWidgets'
import type { DashboardLayout } from '../utils/dashboardLayout'

export interface DashboardLayoutContextValue {
  /** Every widget in order, shown or hidden. */
  layout: DashboardLayout
  /** True when the widget is on the dashboard. */
  isShown: (id: WidgetId) => boolean
  move: (id: WidgetId, overId: WidgetId) => void
  moveBy: (id: WidgetId, direction: -1 | 1) => void
  resize: (id: WidgetId, size: WidgetSize) => void
  setShown: (id: WidgetId, shown: boolean) => void
  reset: () => void
}

export const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null)
