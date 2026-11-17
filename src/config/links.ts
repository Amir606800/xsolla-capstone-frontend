import { runtimeEnv } from './runtime'

/**
 * Outside places the LMS links to. Set the real addresses in .env.local (see .env.example);
 * until then these placeholders are used.
 */
import { runtimeEnv } from './runtime.ts'

const env = (key: 'VITE_SLACK_URL' | 'VITE_GITLAB_URL' | 'VITE_OFFICE_TOUR_URL', fallback: string) =>
  runtimeEnv(key) || fallback

export const LINKS = {
  slack: env('VITE_SLACK_URL', 'https://slack.com/'),
  gitlab: env('VITE_GITLAB_URL', 'https://gitlab.com/'),
  officeTour: env('VITE_OFFICE_TOUR_URL', 'https://example.com/office-tour'),
}
