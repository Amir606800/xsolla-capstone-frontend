# Xsolla School Baku LMS: front-end

The web app of the school's learning platform. Students follow the course week by week, hand in work and see their
grades. Mentors look after a team, give weekly grades and comment on work. Lecturers write the course. Admins manage
people, teams, modules and the calendar in a separate section.

Built with React, TypeScript and Vite. The back-end is a separate project (a Go server); this repository is only the
front-end.

**You do not need the back-end to try it.** Without one, the app runs on built-in demo data stored in your browser.

---

## 1. Fastest start (no back-end)

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

Sign in with any of these demo accounts (**any password works**):

| Who | E-mail | What they get |
|---|---|---|
| Student | `student@xsolla.school` | Courses, tasks, grades, team, 1:1 booking, calendar |
| Mentor and lecturer | `lecturer@xsolla.school` | Team page, grading, calendar, writes the course |
| Mentor only | `mentor@xsolla.school` | Team page, grading, calendar |
| Lecturer only | `teacher@xsolla.school` | Writes the course, calendar |
| Admin | `admin@xsolla.school` | Sign in at <http://localhost:5173/admin/login> |

Any other e-mail signs in as a student. Your changes are kept in the browser's local storage; to start from scratch,
clear the site data for `localhost:5173`.

## 2. Run with Docker

You need [Docker](https://docs.docker.com/get-docker/) with Compose. Nothing else is installed on your machine.

```bash
docker compose up --build
```

Open <http://localhost:3000> (set `WEB_PORT=8081` to use another port). This is the production build, served by nginx.

For editing code with hot reload inside Docker:

```bash
docker compose --profile dev up dev
```

Open <http://localhost:5173>.

> The settings in section 3 are baked into the build. After you change `.env`, run `docker compose up --build` again.

## 3. Connect it to the back-end

Create a file named `.env.local` (it is not committed) next to `package.json`:

```
VITE_API_URL=http://localhost:8080
```

Restart `npm run dev` after any change to it. With a back-end address set, sign in with a real account from that
server; the demo accounts above only work without one.

| Setting | What it does | Default |
|---|---|---|
| `VITE_API_URL` | Address of the back-end, with no path (`http://localhost:8080`, or a tunnel address). **Empty = demo mode.** | empty |
| `VITE_SLACK_URL` | The Slack link in the sidebar | placeholder |
| `VITE_GITLAB_URL` | The GitLab link in the sidebar | placeholder |
| `VITE_OFFICE_TOUR_URL` | The page opened by "Office tour" | placeholder |

`.env.example` shows all of them. Which file wins: `.env.local` overrides `.env`. With Docker, Compose reads `.env`.

**Things to know when using a real back-end**

- The back-end must allow the browser to call it (CORS). If you see "Failed to fetch" in the browser, check this first.
  Behind an ngrok tunnel the free plan shows a warning page that also blocks the calls.
- Some screens have no back-end routes yet and keep showing demo data: 1:1 slots, notifications and announcements,
  quizzes. `backend_requirements/BACKEND_INTEGRATION_CHECK.md` lists what works today and what is missing.
- The weekly mentor review (`backend_requirements/BACKEND_REQUIREMENTS.md`) switches itself off until the server has its routes.

## 4. The weekly mentor review (try it in demo mode)

Every student must review their mentor each week. On the weekend a reminder shows on every page; once the week is
over and the review is missing, the LMS is locked until the student sends it. In demo mode students count as
"already reviewed", so nothing is locked. To see the feature, open the browser console (F12) and run one of these,
then reload:

```js
localStorage.setItem('mentor_review_demo', 'locked')    // last week is missing: the LMS is locked
localStorage.setItem('mentor_review_demo', 'reminder')  // this week's reminder, as on a weekend
localStorage.removeItem('mentor_review_demo')           // back to normal
```

## 5. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm run build` | Type-checks and builds into `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | Checks the code style |
| `npm test` | Unit and component tests (Vitest). Always uses demo data, whatever `.env` says |
| `npm run test:e2e` | Browser tests (Playwright). Start with `npx playwright install` the first time. Always uses demo data |
| `npm run test:backend` | Checks the app's API code against a **live** back-end. See below |

`npm run test:backend` creates accounts, a team, a module and events on the server, so point it at a test database:

```bash
LMS_API_URL=http://localhost:8080 LMS_ADMIN_EMAIL=admin@example.com LMS_ADMIN_PASSWORD=... npm run test:backend
```

On Windows PowerShell set the three values with `$env:LMS_API_URL = '...'` first.

## 6. How the code is organised

```
src/
  pages/        One file per screen (student, mentor, lecturer, admin/ for the admin section)
  components/   Parts the pages share: layout, calendar, dashboard, forms, modals
  api/          Every call to the back-end. Each has a real version (*.http.ts) and a demo version (mocks/)
  mocks/        The demo data and the in-browser store that stands in for the back-end
  context/      Shared state: signed-in user, course data, notifications, weekly review, ...
  hooks/        Small hooks that read that state
  utils/        Plain functions: dates, roles, progress, rules (easy to test)
  types/        Shared TypeScript types
e2e/            Browser tests
```

The switch between real and demo data is one place: if `VITE_API_URL` is set, the `api/` modules call the server,
otherwise they use `mocks/`. The screens do not know the difference.

Roles: a person can be a **student**, **mentor**, **lecturer** or **admin**, and mentors and lecturers can be both.
Admins have their own layout under `/admin`.

## 7. Documents for the back-end team

All of them are in the [`backend_requirements/`](backend_requirements/) folder.

| File | What it is |
|---|---|
| `backend_requirements/BACKEND_REQUIREMENTS.md` | What the back-end must add: weekly mentor review, set own password, assigning lecturers to modules, quizzes, bulk module import, and more |
| `backend_requirements/BACKEND_INTEGRATION_CHECK.md` | Result of testing the front-end against the real server: bugs and gaps |
| `backend_requirements/backend-fixes.patch` | A small patch for three back-end bugs found in that test |

## 8. Troubleshooting

- **The app still shows demo data after I set `VITE_API_URL`.** Restart `npm run dev`, then sign out and sign in again
  (an old demo login is remembered in the browser), or clear the site data.
- **"Failed to fetch" or every page fails to load.** The back-end is not reachable, or does not allow the browser
  (CORS). Open the address in the browser and check the Network tab.
- **Port 5173 or 3000 is already in use.** Stop the other program, or use `WEB_PORT=8081 docker compose up --build`
  / `npm run dev -- --port 5174`.
- **I changed `.env` but Docker shows the old address.** Rebuild: `docker compose up --build`.
- **Tests behave differently on my machine.** Run them from a folder path with the same letter case as on disk
  (on Windows, `D:\...` not `d:\...`); Vitest can fail to start otherwise.
