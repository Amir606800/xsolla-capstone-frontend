# Xsolla School Baku LMS: front-end

The web app of the school's learning platform. Students follow the course week by week, hand in work and see their
grades. Mentors look after a team, give weekly grades and comment on work. Lecturers write the course. Admins manage
people, teams, modules and the calendar in a separate section.

Built with React, TypeScript and Vite. The back-end is a separate project (a Go server); this repository is only the
front-end.

The back-end must be configured before starting the front-end.

---

## 1. Fastest start

You need [Node.js](https://nodejs.org) 22 or newer, and the back-end running on <http://localhost:8080>.

```bash
npm install
```

Create `.env.local` next to `package.json` before starting:

```
VITE_API_URL=http://localhost:8080
```

Then run:

```bash
npm run dev
```

Open <http://localhost:5173> and sign in with an account of that server (for example the seeded
`analytics.admin@xsolla.school` at <http://localhost:5173/admin/login>).

## 2. Run with Docker

You need [Docker](https://docs.docker.com/get-docker/) with Compose. Nothing else is installed on your machine.

```bash
docker compose up --build
```

Open <http://localhost:3000> (set `WEB_PORT=8081` to use another port). This is the production build, served by nginx.
It calls the back-end at `VITE_API_URL`, so set that in `.env` first; the back-end must allow this site's address (CORS).

For editing code with hot reload inside Docker:

```bash
docker compose --profile dev up dev
```

Open <http://localhost:5173>.

> The production container writes `/config.js` from its environment when it starts. After changing `.env`, restart the container; rebuilding is only needed after changing application code.

## 3. Settings

Create a file named `.env.local` (it is not committed) next to `package.json`:

```
VITE_API_URL=http://localhost:8080
```

Restart `npm run dev` after any change to it. The frontend refuses to start when `VITE_API_URL` is missing.

| Setting | What it does | Default |
|---|---|---|
| `VITE_API_URL` | Required address of the back-end, with no path (`http://localhost:8080`, or a tunnel address). | required |
| `VITE_SLACK_URL` | The Slack link in the sidebar | placeholder |
| `VITE_GITLAB_URL` | The GitLab link in the sidebar | placeholder |
| `VITE_OFFICE_TOUR_URL` | The page opened by "Office tour" | placeholder |

`.env.example` shows all of them. Which file wins: `.env.local` overrides `.env`. Vite reads these values during local development, while the Nginx container reads them at startup and writes `/config.js`.

**Screens the back-end cannot serve yet** stay on the page and say so plainly (for example "The server cannot list the
reports yet"); they never show made-up data. `backend_requirements/` lists what each one needs.

## 4. Tests use a made-up school

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
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright). Start with `npx playwright install` the first time |
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
  api/          Every call to the back-end
  context/      Shared state: signed-in user, course data, notifications, weekly review, ...
  hooks/        Small hooks that read that state
  utils/        Plain functions: dates, roles, progress, rules (easy to test)
  types/        Shared TypeScript types
  test/         Test setup, the made-up school (fixtures/) and the fakes of the API modules (fakes/)
e2e/            Browser tests
```

Roles: a person can be a **student**, **mentor**, **lecturer** or **admin**, and mentors and lecturers can be both.
Admins have their own layout under `/admin`.

## 7. Documents for the back-end team

All of them are in the [`backend_requirements/`](backend_requirements/) folder.

| File | What it is |
|---|---|
| `backend_requirements/BACKEND_REQ_OPEN_ITEMS.md` | **Start here:** what the back-end is still missing (17 Nov), with links to the detailed docs |
| `backend_requirements/BACKEND_REQUIREMENTS.md` | What the back-end must add: weekly mentor review, assigning lecturers to modules, quizzes, bulk module import, and more |
| `backend_requirements/BACKEND_REQ_PROFILE.md` | The profile page: picture, bio, contact handles, and look and accessibility settings |
| `backend_requirements/BACKEND_REQ_ONE_ON_ONE_DEADLINES.md` | Task deadlines that follow the 1:1, late hand-ins and the automatic red week grade |
| `backend_requirements/BACKEND_INTEGRATION_CHECK.md` | The first test against the real server (11 Nov), replaced by `BACKEND_REQ_OPEN_ITEMS.md`; kept for history |
| `backend_requirements/BACKEND_REQ_MENTOR_QUIZ_RESULTS.md` | A mentor reads their team's quiz results |
| `backend_requirements/BACKEND_REQ_WEEK_FEEDBACK.md` | The mentor's feedback with the week grade (built) |
| `backend_requirements/backend-fixes.patch` | A small patch for three back-end bugs found in that test |

## 8. Troubleshooting

- **The app does not start.** Configure `VITE_API_URL` in `.env.local` and restart `npm run dev`.
- **"Failed to fetch" or every page fails to load.** The back-end is not reachable, or does not allow the browser
  (CORS). Open the address in the browser and check the Network tab.
- **Port 5173 or 3000 is already in use.** Stop the other program, or use `WEB_PORT=8081 docker compose up --build`
  / `npm run dev -- --port 5174`.
- **I changed `.env` but Docker shows the old address.** Restart the web container: `docker compose up -d`.
- **Tests behave differently on my machine.** Run them from a folder path with the same letter case as on disk
  (on Windows, `D:\...` not `d:\...`); Vitest can fail to start otherwise.
