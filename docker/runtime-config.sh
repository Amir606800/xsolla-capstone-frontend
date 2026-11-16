#!/bin/sh
set -eu

json_string() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  VITE_API_URL: "$(json_string "${VITE_API_URL:-}")",
  VITE_SLACK_URL: "$(json_string "${VITE_SLACK_URL:-}")",
  VITE_GITLAB_URL: "$(json_string "${VITE_GITLAB_URL:-}")",
  VITE_OFFICE_TOUR_URL: "$(json_string "${VITE_OFFICE_TOUR_URL:-}")",
  VITE_GEMINI_API_KEY: "$(json_string "${VITE_GEMINI_API_KEY:-}")"
};
EOF
