# Xsolla School Baku LMS: front-end

The web app of the school's learning platform. Students follow the course week by week, hand in work and see their
grades. Mentors look after a team, give weekly grades and comment on work. Lecturers write the course. Admins manage
people, teams, modules and the calendar in a separate section.

Built with React, TypeScript and Vite. The back-end is a separate project (a Go server); this repository is only the
front-end.

It always talks to the back-end: there is no built-in demo data. Run the Go server (with its demo data:
`go run ./cmd/seed mock` in the back-end project) next to it.

---

## 1. Start (with the back-end on this machine)

You need [Node.js](https://nodejs.org) 22 or newer, and the back-end running on <http://localhost:8080>.

```bash
npm install
npm run dev
```

Open <http://localhost:5173> and sign in with an account of that server (for example the seeded
`analytics.admin@xsolla.school` at <http://localhost:5173/admin/login>).

The app calls `/api/...` on its own address, and the dev server forwards those calls to the back-end (without the
`/api`). The browser never calls another address, so there is no CORS to set up. If the back-end is somewhere else,
set `API_PROXY_TARGET` (section 3).

## 2. Run with Docker

You need [Docker](https://docs.docker.com/get-docker/) with Compose. Nothing else is installed on your machine.

```bash
docker compose up --build
```

Open <http://localhost:3000> (set `WEB_PORT=8081` to use another port). This is the production build, served by nginx,
which forwards `/api` to the back-end at `API_UPSTREAM` (default: port 8080 on this machine).

For editing code with hot reload inside Docker:

```bash
docker compose --profile dev up dev
```

Open <http://localhost:5173>.

> `VITE_*` settings are baked into the build. After you change one in `.env`, run `docker compose up --build` again.
> `API_UPSTREAM` is read when the container starts.

## 3. Settings

Put them in `.env.local` (not committed) next to `package.json`; `.env.example` shows all of them. Restart
`npm run dev` after a change.

| Setting | What it does | Default |
|---|---|---|
| `VITE_API_URL` | The back-end's address, only when it is on another address that allows this site (CORS), e.g. a tunnel. Leave it empty to use `/api` on the site's own address. | empty (`/api`) |
| `API_PROXY_TARGET` | Development: where the dev server (and `vite preview`) forwards `/api` | `http://localhost:8080` |
| `API_UPSTREAM` | Docker / nginx: where `/api` is forwarded in production | `http://host.docker.internal:8080` with docker compose, `http://127.0.0.1:8080` in the bare image |
| `VITE_SLACK_URL` | The Slack link in the sidebar | placeholder |
| `VITE_GITLAB_URL` | The GitLab link in the sidebar | placeholder |
| `VITE_OFFICE_TOUR_URL` | The page opened by "Office tour" | placeholder |

**Deploying:** serve the built `dist/` and forward `/api/` to the Go server with the `/api` taken off, as
`nginx.conf` does. Every route the app uses is then on one address.

**Screens the back-end cannot serve yet** stay on the page and say so plainly (for example "The server cannot list the
reports yet"); they never show made-up data. `backend_requirements/` lists what each one needs.

## 4. Tests use a made-up school

The app has no demo data, but the tests need a school to work with. `src/test/fixtures/` is a small made-up school
(people, teams, modules, grades, reviews) kept in the test's local storage, and `src/test/setup.ts` replaces every API
module that reaches the server with a fake from `src/test/fakes/` that answers from it. None of this is in the app's
build. A test that checks a module's real HTTP calls uses `vi.unmock` (or `useRealApi` from `src/test/realApi.ts`) and
answers the requests itself with `stubHttp`.

## 5. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm run build` | Type-checks and builds into `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | Checks the code style |
| `npm test` | Unit and component tests (Vitest), on the made-up school of section 4; they never reach a server |
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
  api/          Every call to the back-end (*.http.ts hold the requests and the mapping of the JSON)
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

- **Every page says it cannot reach the server.** The back-end is not running, or not on `API_PROXY_TARGET` /
  `API_UPSTREAM`. Open <http://localhost:8080/swagger/index.html> to check it.
- **"Failed to fetch" with `VITE_API_URL` set.** That address does not allow the browser (CORS). Leave `VITE_API_URL`
  empty and use the `/api` forwarding instead.
- **Port 5173 or 3000 is already in use.** Stop the other program, or use `WEB_PORT=8081 docker compose up --build`
  / `npm run dev -- --port 5174`.
- **I changed a `VITE_*` setting but Docker shows the old one.** Rebuild: `docker compose up --build`.
- **Tests behave differently on my machine.** Run them from a folder path with the same letter case as on disk
  (on Windows, `D:\...` not `d:\...`); Vitest can fail to start otherwise.
