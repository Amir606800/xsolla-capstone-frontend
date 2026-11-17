import { runtimeEnv } from './runtime'

/**
 * Outside places the LMS links to. Set the real addresses in .env.local (see .env.example);
 * until then these placeholders are used.
 */
const env = (value: string | undefined, fallback: string) => (value && value.trim()) || fallback

export const LINKS = {
  slack: env(runtimeEnv('VITE_SLACK_URL'), 'https://slack.com/'),
  gitlab: env(runtimeEnv('VITE_GITLAB_URL'), 'https://gitlab.com/'),
  officeTour: env(runtimeEnv('VITE_OFFICE_TOUR_URL'), 'https://example.com/office-tour'),
}
