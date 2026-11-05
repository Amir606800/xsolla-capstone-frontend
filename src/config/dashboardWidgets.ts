import type { IconName } from '../components/Icon'

/** Every widget a student can put on the dashboard. Add new ones here + in DashboardWidgetBody. */
export type WidgetId = 'progress' | 'current-task' | 'deadlines' | 'grades' | 'activity'

/** Widths on a 12-column grid. Fixed steps (no free resizing) keep the layout from breaking. */
export type WidgetSize = 'sm' | 'md' | 'lg' | 'full'

export const SIZE_SPAN: Record<WidgetSize, number> = { sm: 4, md: 6, lg: 8, full: 12 }
export const SIZE_LABEL: Record<WidgetSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  full: 'Full',
}
export const SIZES: readonly WidgetSize[] = ['sm', 'md', 'lg', 'full']

export interface WidgetMeta {
  title: string
  description: string
  icon: IconName
  defaultSize: WidgetSize
  /** Sizes the widget stays readable at (the module path needs room). */
  sizes: readonly WidgetSize[]
}

export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  progress: {
    title: 'Progress',
    description: 'Your score, task counts and the path through the 12 modules.',
    icon: 'check',
    defaultSize: 'full',
    sizes: ['lg', 'full'],
  },
  'current-task': {
    title: 'Current task',
    description: 'The module running this week and the next task you have to hand in.',
    icon: 'tasks',
    defaultSize: 'sm',
    sizes: ['sm', 'md', 'lg'],
  },
  deadlines: {
    title: 'Upcoming deadlines',
    description: 'Tasks that are due soon, with the time left.',
    icon: 'clock',
    defaultSize: 'lg',
    sizes: SIZES,
  },
  grades: {
    title: 'Recent grades',
    description: 'Your latest graded work and the feedback you got.',
    icon: 'award',
    defaultSize: 'md',
    sizes: SIZES,
  },
  activity: {
    title: 'Recent activity',
    description: 'What happened lately: submissions, grades and newly opened modules.',
    icon: 'activity',
    defaultSize: 'md',
    sizes: SIZES,
  },
}

/** The order widgets appear in for a new user. */
export const DEFAULT_ORDER: readonly WidgetId[] = ['progress', 'current-task', 'deadlines', 'grades', 'activity']
