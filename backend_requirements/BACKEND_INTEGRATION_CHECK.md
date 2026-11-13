# Front-end ↔ backend integration check

Written for the backend developer. Checked on 11 Nov 2026 against `xsolla-capstone-backend` `master` at **`5ffcd5f`**
(auto-enrolment, enrollment grades, squashed migrations).

**How it was checked.** A fresh copy of the backend (own Postgres and MinIO) was run, and the front-end's **own API
code** was pointed at it: every call the screens make, followed by a read-back to see that what was saved is what
the screen shows. The suite is in the front-end repo and can be re-run any time:

```
LMS_API_URL=http://localhost:8080 LMS_ADMIN_EMAIL=... LMS_ADMIN_PASSWORD=... npm run test:backend
```

It creates accounts, a team, a module and events on that server, so use a test database.

Result on `5ffcd5f`: **3 bugs** (section 1), **8 missing pieces** (section 2), everything else works (section 3).

### Update: `1809a7c` (11 Nov, afternoon), checked on the dev tunnel with the demo accounts

- **Fixed:** 1.1 (task deadlines) and 1.2 (link addresses); week dates (`opens_at` / `closes_at`, 2.1); password
  reset (`PUT /users/:id/password`, 2.5). The front-end already sends and reads all of these.
- **Still open:** 1.3 (`.md` / `.zip` uploads, `mime.TypeByExtension` is unchanged).
- **Weekly grades are now wired to the enrollment grades.** The mentor reads every week's
  `GET /modules/:m/enrollments` and saves with `PATCH /modules/:m/enrollments/:u/grade`; the student reads their own
  row. What the backend still has to do for the mentor's Grading page to work:
  1. **Let mentors see the course.** `GET /modules` returns `[]` for a mentor, and every module route answers 403
     "not enrolled", so the Grading page has no weeks. Enrol mentors like students, or give the `mentor` role read
     access to all modules.
  2. **Only the student's own mentor may grade them.** Today any mentor can grade any student.
  3. **Do not show every grade to every student.** `GET /modules/:m/enrollments` gives any enrolled user every
     enrollment with its `grade`, so students can read each other's grades. Filter it to the caller's own row for
     students (mentors: their team; lecturers and admins: all).
  4. **Answer an invalid grade with 422, not 500.**
  5. *(Optional)* A note and a "graded at" on the enrollment. Until then the front-end hides the note field and
     shows the week's closing date.
- **Mentors still cannot read hand-ins** (the roster is lecturer/admin only), so the Grading page says so instead of
  showing work.

---

## 1. Bugs: please fix first

A patch for all three is in the front-end repo: **`backend_requirements/backend-fixes.patch`** (`git apply backend-fixes.patch` in the
backend repo; 21 lines in 3 files). With it applied, every part of the suite that does not need a new feature passes.

### 1.1 New tasks lose their deadline, so they disappear (regression in `740b786` / `154ab02`)

`ContentService.CreateContentItem` no longer calls `CreateAssignment`, and `CreateContentItem`'s SQL does not write
`due_at` either. The deadline is read back from the `assignments` table (`LEFT JOIN assignments`), so every task created
since this change has **no deadline**. A task without a deadline cannot be placed on the timeline, so the front-end
does not show it: **a lecturer adds a task and it is gone.** Editing the deadline does nothing too
(`UpdateAssignment` updates a row that does not exist).

Fix: after the item is stored, `if itemType == "assignment" { s.store.CreateAssignment(ctx, ci.ID, dueAt) }`. Tasks
created since the regression need an `assignments` row (or move `due_at` to `content_items.due_at` everywhere,
which the column already exists for, and drop the join).

### 1.2 Links come back without their address

`buildContentTree` (handlers/content.go) does not copy `Url`, so `GET /modules/:id/content-items` returns link items
without `url`. The front-end cannot open such a link and leaves it out. One line: `Url: ci.Url`.

### 1.3 Uploads of `.md` and `.zip` are refused depending on the machine (415)

The file type comes from `mime.TypeByExtension`, which reads the operating system's table:

| Extension | Windows (this check) | Linux container without `/etc/mime.types` |
|---|---|---|
| `.md` | `""` → `application/octet-stream` → **415** | **415** |
| `.zip` | `application/x-zip-compressed` → **415** | **415** |
| `.txt` | `text/plain; charset=utf-8` → **415** (parameter not stripped) | depends |
| `.pptx` | ok | **415** |

The front-end lets students and lecturers upload **pdf, pptx, md, zip**. Fix: a fixed extension → type map for those,
and strip `; charset=...` before comparing.

---

## 2. Missing on the backend (the front-end is ready and sends them)

| # | What | What happens today | Front-end side | Where specified |
|---|---|---|---|---|
| 2.1 | **Week dates** `opens_at` / `closes_at` on modules | Ignored. The module is saved without dates; nothing is locked for students | Sends `opens_at` / `closes_at` on `POST` and `PATCH /modules`, reads them back, and **tells the admin/lecturer when they were not kept** | BACKEND_REQUIREMENTS 3.2 |
| 2.2 | **Lecturer of a week** (`lecturer_id`) | Ignored; `created_by` is the only link. A lecturer can link events only to weeks **they created**, so weeks made by the admin can never get lecture events from a lecturer | Sends `PATCH /modules/:id { lecturer_id }` and says "cannot change the lecturer yet" when it is not kept. Offers a lecturer only the weeks they lead in the event form | 3.2 |
| 2.3 | **Meeting link** on events (`meeting_url`) | Ignored, the link is lost | Sends it, checks the saved event, and warns "the server does not store meeting links yet" | 3.5 |
| 2.4 | **Who made an event** (`events.created_by`) | A lecturer can create an event without a week but can **never change or delete it** (404 "event not found": the update/delete SQL only allows events of their own modules) | Hides Edit/Delete where the server would refuse | 3.5 |
| 2.5 | **Admin password reset** `PUT /users/:id/password` | No route (404) | Built; says "the server cannot reset passwords yet" | 4.1 |
| 2.6 | **Delete one team** `DELETE /teams/:id` | No route | Built; says "cannot delete a single team yet" | 4.2 |
| 2.7 | **Earlier versions of a hand-in** | `GET .../submissions/me` returns only the latest | Shows the history when `history` is present | 3.4 |
| 2.8 | **Mentors see the course** | `GET /modules` returns `[]` for a mentor (not enrolled, not a creator), and mentors only get events without a week | Mentor dashboard and grading page have no weeks to show | 3.2 |

### Grades, reviews and the rest

- **Weekly grades** (`PATCH /modules/:m/enrollments/:u/grade`, `154ab02`, marked NON-COMPLETE): not wired yet, because
  - **any** mentor can grade **any** student (it must be the mentor of that student's team);
  - a student cannot read their own grades (`modules.grade` is one grade per module, not per student, and
    `GET /modules` does not return the enrollment grade);
  - an invalid value such as `"blue"` answers **500** instead of 422;
  - there is no note and no "graded at".

  Section 4.3 has the shape the front-end expects. Once a student can read their grades and the mentor check is in,
  the front-end can switch over.
- **Mentor comments on hand-ins**: the roster `GET .../submissions` and `POST /submissions/:id/feedback` exist but are
  **lecturer/admin only**. A mentor gets 403, so the mentor's grading page stays on demo data (3.4).
- **1:1 slots, notifications, admin announcements, quizzes**: no routes yet (4.4, 4.5, 4.6). These screens run on demo
  data even with a backend configured.

---

## 3. Works end to end (checked against `5ffcd5f`)

- Sign in for every role; refresh on 401.
- Admin creates accounts: students (`POST /auth/signup`), mentors and lecturers (`POST /users`).
- `GET /users` lists them with roles. Renames are saved (`PATCH /users/:id`).
- Temporary roles round-trip with their end date (`PUT /users/:id/roles`). Accounts can be deleted.
- Teams: add one with students (`POST /teams`), set its mentor (`PUT /teams/:id/mentor`), list them.
- **Student "My team" and mentor "My team" now use `GET /teams/me` and `GET /mentors/me/team`** (they were demo data
  before). "No team" (404) and "no mentor yet" are shown as such.
- Modules: create, rename, delete. New modules are visible to existing students (auto-enrolment works).
- Tasks with requirements; file materials (pdf/pptx); **link materials, which are now used** (they used to say "cannot be saved").
- **Deadline changes, which are now sent** (`PATCH /content-items/:id { due_at }`).
  These two items need fixes 1.1 and 1.2 to come back correctly.
- Students hand in text + files, see them, and download them.
- Events: create with place and description; students and admins see them; admin edits and deletes.
- **Taking a place or a description away when editing an event now works** (the front-end sends `""`).

## 4. Small things noticed

- `cmd/seed` has the database address hard-coded (`127.0.0.1:5432`, user `maqa`). It cannot seed any other database;
  reading `DATABASE_URL` like the server does would fix it.
- `POST /auth/signup` on an empty database makes the first account an **admin** without asking. That is fine for a
  first setup, but it should not stay open in production.
- CORS still allows any origin (`TODO: temporarily disabled`).
