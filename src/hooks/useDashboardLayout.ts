import { useContext } from 'react'
import { DashboardLayoutContext } from '../context/dashboardLayout'

export function useDashboardLayout() {
  const ctx = useContext(DashboardLayoutContext)
  if (!ctx) throw new Error('useDashboardLayout must be used inside <DashboardLayoutProvider>')
  return ctx
}
