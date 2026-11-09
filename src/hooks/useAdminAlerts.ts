import { useContext } from 'react'
import { AdminAlertsContext } from '../context/adminAlerts'

export function useAdminAlerts() {
  const ctx = useContext(AdminAlertsContext)
  if (!ctx) throw new Error('useAdminAlerts must be used inside the admin layout')
  return ctx
}
