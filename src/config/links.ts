/**
 * Outside places the LMS links to. Set the real addresses in .env.local (see .env.example);
 * until then these placeholders are used.
 */
const env = (value: string | undefined, fallback: string) => (value && value.trim()) || fallback

export const LINKS = {
  slack: env(import.meta.env.VITE_SLACK_URL, 'https://slack.com/'),
  gitlab: env(import.meta.env.VITE_GITLAB_URL, 'https://gitlab.com/'),
  officeTour: env(import.meta.env.VITE_OFFICE_TOUR_URL, 'https://example.com/office-tour'),
}
