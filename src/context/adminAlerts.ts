import { createContext } from 'react'
import type { LoadStatus } from './courses'
import type { AdminAlert } from '../utils/adminAlerts'

export interface AdminAlertsContextValue {
  status: LoadStatus
  alerts: AdminAlert[]
  /** How many need attention (the badge on the sidebar). */
  attention: number
  reload: () => void
}

export const AdminAlertsContext = createContext<AdminAlertsContextValue | null>(null)
