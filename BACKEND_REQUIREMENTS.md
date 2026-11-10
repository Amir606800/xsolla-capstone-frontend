# Backend requirements for the Xsolla School LMS front-end

Written for the backend developer. Compared against `xsolla-capstone-backend` at commit `ba9ec9f` (7 Nov 2026).
The front-end already runs end to end on an **offline demo store**; every item below is something the real
backend has to provide so the demo store can be switched off (`VITE_API_URL` set) with nothing lost.

**How to read it.** Section 1 is the one-page summary. Section 2 are rules that apply everywhere. Sections 3-4
are the work: changes to endpoints you already have, then new endpoints, each with the exact JSON the front-end
sends and expects. Section 5 is the data model, 6 the permission table, 7 the business rules, 8 the open
decisions, 9 a suggested order and a checklist. Items marked **P1** block the admin section, **P2** block
mentor/student features, **P3** are nice to have.

---

## 1. Where things stand

| Area | Backend today | Front-end today | What is missing |
|---|---|---|---|
| Sign in / sign up / refresh / logout | Done | Done, real calls | Nothing (see 3.1 for small fixes) |
| Roles (`student` `mentor` `lecturer` `admin`) | `users.roles TEXT[]` (migration 013) | Role *sets*, abilities checked per role | Changing roles, **temporary roles**, a fixed **main role** (4.1) |
| Password reset by the admin | Nothing | Built (Students, Mentors, Lecturers) | `PUT /users/:id/password` (4.1) - P1 |
| Modules (= weeks) | CRUD, enrollments | Real calls | `position`, week dates, a lecturer per week, auto-enrolment (3.2) |
| Content items | `file`, `assignment`, `link` | Files + tasks real; **links/quizzes not yet wired** | Quiz type, per-item author (3.3) |
| Files | S3, upload/download | Real calls | Nothing |
| Submissions | Multiple attempts, grade endpoint | Real calls (one attempt assumed) | Mentor comment without a grade, team scoping (3.4) |
| Calendar events | CRUD | Real calls | Admin must see every event (3.5) |
| **Google Calendar** (connect + sync) | `GET /auth/google/{login,callback,me}`, `sync_to_google` on `POST /events`, `google_event_id` (checked at `47fc00b`) | Built: Settings page, tick on the event form, marks, filter | Fixes and small additions in 3.5.1 - P2 |
| **Users list / create / edit / delete** | Only `GET /users/me` | Admin screens built | **Whole group (4.1) - P1** |
| **Teams** | Admin routes done (`GET/PUT/POST /teams`, students, mentor), checked at `4de5fd0` | Admin screens call them; student and mentor pages still on demo data | **`DELETE /teams/:id`** (one team); `GET /teams/me` and `/mentors/me/team` are not used by the LMS pages yet (4.2) |
| **Weekly grades** (green/yellow/red) | Nothing | Built on demo data | **Group 4.3 - P2** |
| **1:1 slots** | In the contract, **not registered** in `main.go` | Built on demo data | **Group 4.4 - P2** |
| **Notifications** | Nothing | Bell + list built on demo data; admin "send to everyone" next | **Group 4.5 - P2** |
| Quizzes | Nothing | Lecturers write them, students see they exist | Group 4.6 - P3 |
| Deadlines `GET /users/me/deadlines`, gradebook | In the contract, **not registered** | Not used (deadlines come from the tasks) | Optional |

Routes in `API_CONTRACT.md` that are **not registered** in `cmd/server/main.go`: `GET /users`,
`/mentor-slots*`, `GET /users/me/deadlines`, `GET /modules/:id/gradebook`. Either register them or take them out
of the contract so it stays true.

---

## 2. Rules for every endpoint

1. **Auth.** `Authorization: Bearer <access_token>`. Nothing else is sent: no custom headers (CORS only allows
   `Authorization, Content-Type`, keep it that way). On `401` the front-end calls `POST /auth/refresh` once and
   repeats; if that fails it signs the user out.
2. **CORS.** Allow the front-end origin(s) and `PATCH, PUT, DELETE, OPTIONS`. Currently `Allow-Origin: *`; if it is
   restricted later, the ngrok/dev origins must be on the list.
3. **Ids.** int64 as JSON **numbers or strings** both work; the front-end converts. Be consistent per response.
4. **Dates.** RFC 3339 in UTC (`2026-11-10T23:59:00Z`). The front-end shows them in the browser's time zone.
5. **Errors.** `{ "error": "<code>", "message": "<sentence a person can read>", "status": 400 }`. The message is
   shown as-is: write it for the end user ("There is already an account with this email.").
   Use `409` for duplicates (e-mail taken, slot taken), `422` for rule violations, `403` for role problems.
6. **Lists** return `[]`, never `null`.
7. **Soft delete** (`deleted_at`) for modules, items, events, slots, users. Handed-in work is never lost.
8. **Roles are evaluated at request time.** A role can have an end date (4.1). "Holds the role" means
   `expires_at IS NULL OR expires_at > now()`. Put effective roles in the JWT, keep the access token short (the
   current 15 minutes is fine: an expired role may still work until the next refresh, but `refresh` and `login`
   must recompute). If you would rather check the database on every request, that is better.
9. **Idempotent-friendly writes.** The front-end may repeat a request after a failure; `PUT` endpoints must
   be safe to repeat.
10. **Never trust the screen.** The front-end hides what a role may not do, but every rule in section 6 must be
    enforced here.

---

## 3. Changes to endpoints that already exist

### 3.1 Auth
- `POST /auth/login`: a user whose account is **inactive** (4.1, "left the school") gets `403` with
  `{"error":"account_inactive","message":"This account is no longer active."}`. A wrong password stays `401`.
- Every response with a user (`/auth/*`, `/users/me`, `/users`) must carry
  ```json
  { "id": 7, "email": "...", "name": "...", "roles": ["mentor", "lecturer"],
    "role_expires_at": { "lecturer": "2026-12-01T23:59:59Z" }, "created_at": "..." }
  ```
  `role_expires_at` only lists roles that have an end; `null` or missing = no end. The front-end drops a role by
  itself when its date passes, so it needs the date.
- `POST /auth/signup` stays public and creates a `student`. The admin **sign-in page** (`/admin/login`) uses the
  normal `POST /auth/login` and then checks that the user has the `admin` role. No separate admin login route.
- The first registered user becomes `admin` (already so). There must be a way to create further admins (4.1).

### 3.2 Modules (a module is one **week** of the program)
Response gets:
```json
{ "id": 4, "title": "React", "description": "...", "position": 5,
  "opens_at": "2026-11-02T00:00:00Z", "closes_at": "2026-11-08T23:59:00Z",
  "lecturer_id": 902, "created_by": 1, "created_at": "..." }
```
- **`position`** (1..12, unique, editable). The front-end currently numbers modules by creation order; `position`
  makes "Week 5" stable. New modules go to `max(position)+1`.
- **`opens_at` / `closes_at`** - see open decision 8.1. Students must not see a module's content before `opens_at`
  (the front-end locks it; the backend should refuse the content list with `403` for students too).
- **`lecturer_id`** (nullable) - the lecturer who teaches the week. Separate from `created_by` (an audit field).
  `PATCH /modules/:id` accepts `lecturer_id` (a user with the `lecturer` role, or `null` to take the lecturer off).
  Admin only. Today the front-end sends `{ "lecturer_id": 12 }` and checks the module afterwards; once this exists
  the front-end will read `lecturer_id` instead of `created_by`.
- **Students must see every module**, not only "enrolled" ones. Simplest: when a student account is created,
  enrol them in all current modules; when a module is created, enrol all active students (a database trigger or
  the create handlers). Without this, a student added by the admin sees an empty course.
- `GET /modules` returns **all** non-deleted modules to admins (already so), lecturers and mentors (the calendar and
  the team pages need the whole course). Only editing is limited to a lecturer's own weeks (section 6).
- `PATCH /modules/:id` for admins: title, description, `position`, dates, `lecturer_id`.
- `DELETE /modules/:id` (already there): its items go with it; submissions are kept.

### 3.3 Content items (tasks, materials, links, quizzes)
- Responses get **`created_by`** (user id) on every item. The admin screens show "Lecturer" per item; today the
  front-end falls back to the module's lecturer.
- Admin `GET /modules/:id/content-items` already returns hidden items (`is_visible:false`); keep it. Students and
  mentors never get hidden items.
- **`link` items** now exist (migration 014): the front-end has to start using them - it still says "links cannot
  be saved". No back-end work, just confirm `type:"link"` returns `url` and `PATCH` accepts `url`.
- **Assignments**
  - `PATCH /content-items/:id` accepts `due_at` now (good: the front-end sends it).
  - Add an optional **`requirements`** field (`string[]`, "what to hand in"). Today the front-end packs it into the
    description after the text `"\n\nWhat to hand in:\n"`; a real field removes that hack.
  - `max_points` should be optional/ignored: the program grades **weeks**, not tasks (front-end sends `0`).
- **Quizzes** - 4.6.

### 3.4 Submissions
- Multiple attempts are allowed now. Define "the" submission: `GET .../submissions/me` returns the **latest**
  attempt; add `GET .../submissions/me/history` if the front-end should show earlier ones (P3).
- **Tasks have no grade.** Mentors read the work and may **comment**. Add a comment-only call and make `grade`
  optional on the existing one:
  ```
  PUT /submissions/:id/comment   { "comment": "Nice structure, add tests." }
  ```
  Allowed for: the mentor of that student's team, an admin. Response: the submission with `feedback` and
  `graded_at` (use as "commented at"). Students see the comment on their task.
- `GET /modules/:m/content-items/:a/submissions` (the roster) is allowed for lecturers/admins today. A **mentor**
  must be able to read **only their own team's students'** rows. Add `?team=me` or enforce it from the role.
- A mentor needs one call for the whole team's work, not one per task:
  `GET /mentors/me/submissions` -> every submission by their team's students, newest first, each with
  `student_id`, `assignment_id`, `module_id`, `submitted_at`, `text_body`, `files[]`, `feedback`.

### 3.5 Calendar events
- `GET /events` for an **admin** returns every event; the contract says "events for courses they teach", which
  would hide events from the admin calendar. Same for a lecturer who needs to see the whole school calendar.
- Kinds the front-end writes: `lecture`, `meeting`, `off-campus`. (`deadline` and 1:1 slots are derived by the
  front-end from tasks and slots, not stored here.)
- `PATCH /events/:id` must accept any subset of fields (the admin **postpones** an event by changing `starts_at`
  and `ends_at` together, keeping its length). Already so; keep `ends_at > starts_at` validation (`400`).
- Admins create/edit/delete **any** event; a lecturer only their own.
- When an event is created, changed (time) or deleted, create notifications (4.5).
- **`meeting_url`** (string or `null`) on `lecture` and `meeting` events: the online meeting link, normally Google
  Meet. Accept it in `POST /events` and `PATCH /events/:id` (`null` clears it) and return it in `GET /events`.
  Validate: `https://` only (`400` otherwise), at most 300 characters, no spaces; ignore it for `off-campus`.
  The front-end shows students a Join button from **30 minutes before `starts_at` until `ends_at`**, but the
  server should also keep the address out of `GET /events` for **students** earlier than that (a student who
  opens the network tab would otherwise see it hours ahead). Admins, lecturers and mentors always get it.
- **Notification when the link is added.** When `meeting_url` goes from empty to set (or changes to a different
  address) on a lecture that has not ended, every active **student** gets a notification of type `event`:
  `"Lecture, Mon, Nov 9, 10:00: the meeting link is ready."` (`"... was changed."` when it replaced another),
  with `link: "/calendar"`. Saving the same link again, or removing it, notifies nobody.

### 3.5.1 Google Calendar (what the front-end uses, and what it would like fixed)

Used today (all of it works with the backend as it is):
- **Connect:** the Settings page sends the browser to `GET /auth/google/login?access_token=<jwt>` (a page
  navigation cannot carry a header; the token is renewed just before). Google returns to
  `GOOGLE_OAUTH_FRONTEND_REDIRECT_URI`, which **must be `<frontend>/settings`** (the page reads `?google=connected`
  or `?google=error`, shows it once, and removes it; an admin is forwarded to `/admin/settings`).
- **Status:** `GET /auth/google/me` once per sign-in: `200` connected (shows name, address, picture), `404
  google_not_connected` not connected, `401 google_token_expired` "Reconnect", `502/500` "could not check",
  any other `404/405/501` "this server has no Google routes".
- **Sync:** the event form shows "Also add to my Google Calendar" for **new** events and sends
  `sync_to_google: true`. The front-end decides that it worked from the created row: **no `google_event_id` =
  the Google copy failed** (the server logs it and still returns `201`). Events with a `google_event_id` get an
  "On Google Calendar" mark for staff, and the admin list has a filter for them.

Would like (none of it blocks the front-end):
1. **Tell us when the sync failed.** Return e.g. `"google_sync": "failed"` (and the reason: `not_connected`,
   `token_expired`, `google_error`) on the `201`, instead of leaving it to be guessed from a missing id.
2. **Use the creator's token when an admin edits or deletes someone else's synced event.** Today `PATCH`/`DELETE`
   call Google with the *editor's* token against an event id that lives in the *creator's* calendar, so it fails
   silently and the Google copy goes stale. Store `google_user_id` with `google_event_id` and use that user's token.
3. **`sync_to_google` on `PATCH /events/:id`** (create the Google copy of an existing event). Today the tick is only
   offered on new events.
4. **`DELETE /auth/google`** (disconnect: delete the stored token and revoke it at Google). The Settings card has no
   Disconnect button until it exists; it links to https://myaccount.google.com/permissions instead.
5. **Send more than title and time:** `location`, `description` (and `meeting_url` once it exists) and `all_day`
   (as `date`, not `dateTime`; an all-day event is created as 00:00-23:59 UTC today).
6. `GET /auth/google/me` makes two calls to Google every time; fine once per sign-in, but a cheap "is a token
   stored?" answer (`{"connected": true}`) would let the front-end check without them.
7. Keep the OAuth `state` in a signed cookie or the database, not in memory (lost on restart, breaks with two
   instances). The JWT in `?access_token=` ends up in server and proxy logs: strip it there, or accept a short-lived
   one-purpose token from a `POST /auth/google/start` instead.

### 3.6 Files
Nothing to change. Keep: the admin may download any file; students only files of visible items in their modules
and their own submission files.

---

## 4. New endpoints

### 4.1 Users, roles and temporary roles (P1)

The admin section lists, adds, edits, removes people and changes roles. All routes below are **admin only**
(`403` otherwise).

**`GET /users?search=&role=&status=`**
- `search`: substring of name or e-mail (case-insensitive). `role`: `student|mentor|lecturer|admin`.
  `status`: `active` (default), `left`, `all`.
- Returns **everyone** (no pagination needed: ~60 accounts). One row:
  ```json
  { "id": 41, "email": "ann@x.co", "name": "Ann Lee", "roles": ["student"], "main_role": "student",
    "role_expires_at": {}, "left_at": null, "created_at": "..." }
  ```
- Roles in the response are **effective** ones (expired roles removed).
- **`main_role`** is the role the account was **created with** (`student`, `mentor`, `lecturer` or `admin`). It is
  stored once, at creation (the first role in `POST /users`, `student` for sign-up), and **never changes**. The
  admin screens show it locked and only offer the *other* staff role on top. Without the field the front-end
  guesses (the role held with no end date, mentor first), which is wrong for a lecturer who was later made a
  mentor with no end date, so please send it.

**`POST /users`** - create an account with a password the admin chose.
```json
{ "email": "nil@x.co", "name": "Nil Aydin", "password": "Secret123", "roles": ["mentor"] }
```
The first role in `roles` becomes `main_role`. `201` with the user. `409` if the e-mail exists (message: "There is already an account with this email."), `400`
if the password is shorter than 8. Students may also be created this way (the front-end currently uses public
`POST /auth/signup` for students and closes the session it opens; either works, `POST /users` is cleaner).
A new student is enrolled in all modules (3.2).

**`PATCH /users/:id`** - correct a person. Any subset of:
```json
{ "name": "Ann Leigh", "email": "ann.leigh@x.co", "active": false }
```
- `active:false` = **left the school**: set `left_at = now()`, sign them out (revoke refresh tokens), remove them
  from their team (4.2), keep the account, submissions and grades. `active:true` brings them back (no team).
- Changing e-mail: unique, `409` otherwise. Passwords are never changed here (see the password route below).

**`DELETE /users/:id`** - delete for good (for accounts made by mistake). Soft delete is fine, but the e-mail must
become reusable. Their team slot is freed; if they mentor a team it is left without a mentor. `204`.
Refuse deleting the **last admin** (`422`).

**`PUT /users/:id/roles`** - replace the whole role set, with optional end dates.
```json
{ "roles": ["lecturer", "mentor"], "expires_at": { "mentor": "2026-12-01T23:59:59Z" } }
```
- **The main role is fixed.** `roles` must contain the user's `main_role`, and `expires_at` must not have an
  entry for it. Otherwise `422` with a readable message, e.g. `"Elvin Huseynov is a lecturer: that role cannot be
  taken away."` / `"The main role cannot end."`
- For staff the only change allowed is adding or removing the **other** staff role: a mentor may get `lecturer`, a
  lecturer may get `mentor`, each for a while (with a date) or with no end. `admin` and `student` are never given
  or taken here (`422`). So in practice the body is always `[main]` or `[main, other]`.
- `expires_at` keys must be in `roles`; a date in the past is `400`. Missing or `null` = no end.
- Taking away `mentor` (from a lecturer who had it) removes them as mentor of their team (the team stays without one).
- **Expiry is automatic.** After the date the role no longer counts (rule 2.8); also run a daily job that deletes
  expired rows so the lists stay clean, and **notifies** the person ("Your lecturer role has ended") and the admin.
- The front-end uses this for "make a mentor a lecturer for a while" and "make a lecturer a mentor for a while".

**`PUT /users/:id/password`** - the admin sets a new password for someone who cannot sign in.
```json
{ "password": "fresh-start-1" }
```
- `204`. `400` if shorter than 8 characters (message: "At least 8 characters."). `404` for an unknown user.
- Store it hashed like any password (bcrypt), **revoke all of that user's refresh tokens** (they are signed out
  everywhere), and make sure the old password no longer works.
- Admin only. An admin changing their **own** password should go through a separate "change my password" route
  that asks for the current one (not built in the front-end yet).
- Never return or log the password. The front-end shows it once to the admin so they can hand it over.

**Bootstrap.** First registered user = `admin`. Provide a CLI or seed (`go run ./cmd/seed --admin email password`)
to create more admins; the admin UI does not create admins.

### 4.2 Teams (P1)
A cohort (~29 students) is split into teams of 4-5 students. **Each team has exactly one mentor** (or none yet);
a student is in **at most one** team; a mentor mentors **at most one** team.

**Tables** (section 5): `teams`, `team_members`.

**`GET /teams`** (admin) - all teams:
```json
[ { "id": 3, "name": "Team 3", "mentor_id": 900,
    "student_ids": [1, 101, 102, 103, 104] } ]
```
Left or deleted students never appear. A mentor who lost the role appears as `mentor_id: null`.

**`PUT /teams`** (admin) - **replace every team** in one transaction (the "create random teams" button; the
random split itself is made in the browser and shown to the admin first, then sent here):
```json
{ "teams": [ { "mentor_id": 901, "student_ids": [1, 101, 102, 103, 104] },
             { "mentor_id": null, "student_ids": [105, 106, 107, 108] } ] }
```
Names are generated `Team 1..n`. Validate: every id exists and is an active student/mentor, no duplicates, `422`
otherwise. `[]` is allowed and means "no teams" (the **Remove all teams** button). Returns the new `GET /teams`.

**`POST /teams`** (admin) - add **one** team without touching the others (the **Add team** button):
```json
{ "name": "Team 7", "mentor_id": 906, "student_ids": [161, 162] }
```
- `name` is required and unique among the teams (case-insensitive, trimmed), `409` with
  `"There is already a team called Team 7."` otherwise. The front-end suggests the next `Team N` but any name is fine.
- `mentor_id` may be `null`. If that mentor leads another team they are taken off it (one team per mentor).
- `student_ids` may be empty; students in other teams are moved out of them (one team per student).
- `201` with the new team in the `GET /teams` row shape.

**`DELETE /teams/:id`** (admin) - delete **one** team. **Missing on the server today** (commit `4de5fd0`: it answers 405), so the Delete team button shows "The server cannot delete a single team yet." and nothing is deleted. The front-end already sends this exact call. Its students are left without a team and its mentor without
one to mentor; accounts, submissions and grades are kept. The other teams keep their ids and names (no renumbering).
`204`; `404` for an unknown team.

**`PUT /students/:id/team`** (admin) - add, move or remove a student: `{ "team_id": 5 }` or `{ "team_id": null }`.
**`PUT /teams/:id/mentor`** (admin) - `{ "mentor_id": 902 }` or `null`. If that mentor leads another team they
are taken off it (one team per mentor). Both are repeat-safe; a team may go over 5 students (the admin is warned
on screen, do not block it).

**Read side for the LMS pages**
- `GET /teams/me` (student) -> `{ "id", "name", "mentor": {id,name,email}, "members": [{id,name,email}], "cohort_size": 29, "team_count": 6 }`
- `GET /mentors/me/team` (mentor) -> same shape; `404` if the mentor has no team.
Mentors may see their team's students' e-mail and work; no one else's.

### 4.3 Weekly grades - green / yellow / red (P2)
Every week the student's mentor rates the student: `green` (on track), `yellow` (falling behind but trying),
`red` (no meaningful progress). **Only weeks are graded, never tasks.**

**Table:** `weekly_standings(student_id, week, level, note, assessed_by, assessed_at)`, unique `(student_id, week)`.
`week` = the module's `position`.
- `PUT /students/:id/standings/:week` `{ "level": "green", "note": "optional" }` - the **mentor of that student**
  (or an admin). Upsert; `assessed_at = now()`. `422` for a week that has not started, `403` for another team's
  student.
- `GET /standings/me` (student) -> `[ { "week": 3, "level": "green", "assessed_at": "...", "note": null } ]`.
- `GET /mentors/me/standings` (mentor) -> the same rows for every student in their team, each with `student_id`.
- Notify the student when their grade is set or changed (4.5).

### 4.4 1:1 meetings with the mentor (P2)
Already designed in `API_PLAN.md`; **register the routes**. Shape the front-end uses:
- `GET /mentor-slots` - student: slots of **their own mentor** (future only, plus their own booking);
  mentor: their own slots. Row:
  `{ "id", "mentor_id", "mentor_name", "starts_at", "ends_at", "booked": true, "booked_by": { "id", "name" } }`
  Other students must **not** see who booked a slot (`booked_by` only for the mentor and the booker).
- `POST /mentor-slots` (mentor) `{ "date": "2026-11-12", "start": "15:00", "end": "18:00", "slot_minutes": 30 }`
  -> the server cuts the window into 30-minute slots. `422` if it overlaps their existing slots or is in the past.
  The front-end sends local time; send the browser's UTC offset or accept ISO `starts_at`/`ends_at` instead
  (simplest: let the front-end send ISO timestamps for the window).
- `DELETE /mentor-slots/:id` (mentor, only a **free** slot; `409` if booked).
- `POST /mentor-slots/:id/book` (student): `409` if taken **or** if the student already holds a future booking.
- `DELETE /mentor-slots/:id/book`: the student cancels theirs; the mentor can cancel any of theirs.
- Every call may return the caller's updated list. Booking/cancelling notifies the other side (4.5).

### 4.5 Notifications (P2)
**Table:** `notifications(id, user_id, type, message, link, created_at, read_at)`.
Types the front-end knows: `task`, `deadline`, `graded`, `material`, `meeting`, `event`, `submission`
(+ `announcement` for the admin's messages, and `role` for role changes).
- `GET /notifications` - the caller's, newest first (limit 100). Row:
  `{ "id", "type", "message", "link": "/courses/4", "created_at", "read_at": null }`. `link` is an in-app route.
- `POST /notifications/:id/read`, `POST /notifications/read-all` -> `204`. Only your own.
- **Admin announcements** (the Announce section of the admin pages; the admin Notifications section is worked out by the front-end from the lists it already loads, so it needs nothing extra): `POST /notifications/broadcast`
  ```json
  { "message": "No classes on Friday.", "link": "/calendar", "audience": "all" }
  ```
  `audience`: `all` | `students` | `mentors` | `lecturers`. Writes one row per recipient (active users only).
  Admin only. `201` returns the history row below. `link` is optional (`""` / missing = none); the front-end offers
  `/calendar` and `/office-tour`. Message required, 1-500 characters (`400` otherwise).
  `GET /notifications/broadcasts` (admin) -> everything sent, newest first, so the admin sees what went out:
  ```json
  [ { "id": 7, "message": "No classes on Friday.", "link": "/calendar", "audience": "students",
      "sent_at": "2026-11-07T10:00:00Z", "sent_by": "School Admin", "recipients": 29 } ]
  ```
  `recipients` counts active people at send time; admins are never recipients, and a mentor who also lectures
  counts once in `all`. Each recipient gets a normal `GET /notifications` row of type `announcement`, with its own
  `read_at`. A sent announcement cannot be recalled (the admin is told so before sending).
- **Created by the system** (no front-end call): new task or material in a module -> students; a task's due date
  changed; a mentor comment or weekly grade -> that student; a new submission -> the student's mentor;
  event created/moved/deleted -> everyone it concerns; slot booked/cancelled -> the other person.
- **Reminders (scheduled job, every 15 minutes):** `deadline` 24 hours before a task's `due_at` for students who
  have not submitted; `meeting` 1 hour before a booked slot. De-duplicate (one reminder per user per item).

### 4.6 Quizzes (P3)
Lecturers write short multiple-choice quizzes; students only see that a quiz exists (taking one is not built).
- New content type `quiz` (like `link`): `title`, `description`, optional `due_at`, plus
  ```json
  "questions": [ { "id": "q1", "prompt": "Which hook ...?", "options": ["useRef","useState"], "correct": 1 } ]
  ```
- `correct` is returned **only** to lecturers/admins/mentors; students get the questions without it.
- Storage: `quiz_questions(id, item_id, position, prompt, options JSONB, correct INT)` or one JSONB column.
- `POST` and `PATCH /content-items` accept `questions`; replacing the list replaces all questions.

---

## 5. Data model additions (PostgreSQL)

```sql
-- 016_users_admin.up.sql
ALTER TABLE users ADD COLUMN left_at timestamptz NULL;                 -- left the school
ALTER TABLE users ADD COLUMN deleted_at timestamptz NULL;
ALTER TABLE users ADD COLUMN main_role text NULL                       -- the role the account was created with
  CHECK (main_role IN ('student','mentor','lecturer','admin'));
UPDATE users SET main_role = roles[1] WHERE main_role IS NULL;         -- existing accounts: their first role
CREATE TABLE user_role_expiry (                                        -- temporary roles
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text   NOT NULL CHECK (role IN ('student','mentor','lecturer','admin')),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, role)
);
-- e-mail unique only among live accounts, so a deleted account's e-mail can be reused
DROP INDEX IF EXISTS users_email_key;
CREATE UNIQUE INDEX users_email_live ON users (email) WHERE deleted_at IS NULL;

-- 017_modules_weeks.up.sql
ALTER TABLE modules ADD COLUMN position    int         NULL;
ALTER TABLE modules ADD COLUMN opens_at    timestamptz NULL;
ALTER TABLE modules ADD COLUMN closes_at   timestamptz NULL;
ALTER TABLE modules ADD COLUMN lecturer_id bigint NULL REFERENCES users(id);
UPDATE modules SET position = r.n FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) n FROM modules) r WHERE modules.id = r.id;
ALTER TABLE content_items ADD COLUMN created_by bigint NULL REFERENCES users(id);
ALTER TABLE content_items ADD COLUMN requirements jsonb NULL;

-- 018_teams.up.sql
CREATE TABLE teams (
  id         bigserial PRIMARY KEY,
  name       text   NOT NULL,
  mentor_id  bigint NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX teams_one_team_per_mentor ON teams (mentor_id) WHERE mentor_id IS NOT NULL;
CREATE TABLE team_members (
  team_id    bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, student_id),
  UNIQUE (student_id)                                                   -- one team per student
);

-- 019_standings_notifications.up.sql
CREATE TABLE weekly_standings (
  student_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week        int    NOT NULL CHECK (week BETWEEN 1 AND 52),
  level       text   NOT NULL CHECK (level IN ('green','yellow','red')),
  note        text   NULL,
  assessed_by bigint NOT NULL REFERENCES users(id),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, week)
);
CREATE TABLE notifications (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text   NOT NULL,
  message    text   NOT NULL,
  link       text   NOT NULL DEFAULT '',
  dedupe_key text   NULL,                                               -- "deadline:<task>:<user>" for reminders
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz NULL
);
CREATE INDEX notifications_user_new ON notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_dedupe ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE TABLE broadcasts (
  id bigserial PRIMARY KEY, message text NOT NULL, link text NOT NULL DEFAULT '',
  audience text NOT NULL CHECK (audience IN ('all','students','mentors','lecturers')),
  sent_by bigint NOT NULL REFERENCES users(id), sent_at timestamptz NOT NULL DEFAULT now(), recipients int NOT NULL
);

-- 020_mentor_slots.up.sql (as in API_PLAN.md) and quizzes (4.6): add `quiz` to content_items.type + quiz_questions
```
Effective roles query: `SELECT r FROM unnest(u.roles) r WHERE NOT EXISTS (SELECT 1 FROM user_role_expiry e WHERE e.user_id=u.id AND e.role=r AND e.expires_at<=now())`.

---

## 6. Who may do what

| Action | student | mentor | lecturer | admin |
|---|---|---|---|---|
| Read modules, items (visible), files | enrolled / all, after `opens_at` | all | all | all incl. hidden |
| Create / edit / delete items and modules | - | - | own weeks | any |
| Assign a lecturer to a week | - | - | - | yes |
| Submit work | yes (own) | - | - | - |
| See submissions | own | **own team only** | all (roster) | all |
| Comment on a submission | - | own team only | - | any |
| Set weekly grade | - | own team only | - | any |
| Read own grades | yes | team's | - | all |
| Calendar events: read | yes | yes | yes | all |
| Calendar events: write | - | - | own | any |
| 1:1 slots | book own mentor's | manage own | - | - |
| Users list / create / edit / delete / roles | - | - | - | **yes** |
| Reset someone's password | - | - | - | **yes** |
| Teams: read all / change | - | - | - | **yes** |
| Team: read own | yes | yes | - | - |
| Notifications: own | yes | yes | yes | yes |
| Broadcast announcement | - | - | - | yes |

A lecturer who holds a **temporary** lecturer role has these lecturer rights until the role's end date, then loses
them (rule 2.8). An admin never has a team; admins are not students, mentors or lecturers (they may author content).

---

## 7. Business rules to enforce

1. One team per student, one team per mentor, one mentor per team; enforced by the unique indexes in section 5.
2. A student who **left** (`left_at`): cannot sign in, tokens revoked, removed from the team, not counted anywhere,
   still has all submissions/grades. Brought back = active again, **no team**.
3. A mentor or lecturer **role ending** never deletes their work: items they wrote stay; a mentor's team stays,
   without a mentor, until the admin picks one.
4. Deleting a lecturer keeps the modules and items they wrote (they show "no lecturer").
5. A week (module) may have **no lecturer**.
6. Weekly grades only for weeks that have started; only the student's own mentor writes them.
7. A task has **no grade**; the mentor's comment is text only.
8. E-mails are unique among live accounts and compared case-insensitively.
9. The last admin cannot be deleted, deactivated or lose the `admin` role.
10. Passwords: at least 8 characters, hashed (bcrypt/argon2), never returned.

---

## 8. Open decisions (need an answer before building)

1. **Week dates.** The front-end locks a week for students until it opens and shows "finished / running /
   upcoming". It needs dates: either the backend stores `opens_at`/`closes_at` per module (section 3.2), or the
   program has one **start date** and a week's dates are `start + 7 * (position-1)` computed in the browser. The
   second needs only one setting (`GET /settings` with `program_start`). Pick one.
2. **Who is "the" lecturer of a week** - one person (`lecturer_id`, proposed) or several. The admin screens assume one.
3. **Where random teams are computed** - proposed: the browser (the admin sees and can re-shuffle), the backend
   only stores (`PUT /teams`). If you prefer the server to shuffle, add `POST /teams/preview` and keep the rest.
4. **Notification delivery** - in-app only (proposed), or e-mail/Slack as well.

---

## 9. Suggested order and checklist

1. **Roles + users (4.1), 3.1, 3.2** - unblocks the whole admin section and student/mentor/lecturer sign-in with
   real accounts.
2. **Teams (4.2)** - unblocks team pages for students and mentors.
3. **Submissions for mentors (3.4), weekly grades (4.3), slots (4.4)** - the mentor's daily work.
4. **Notifications (4.5)**, then **quizzes (4.6)**.

Done when these pass against the real server (the front-end ships Vitest + Playwright suites that run on the demo
store; the same flows are the acceptance tests):

- [ ] Admin signs in at `/admin/login`; a student/mentor/lecturer is refused there.
- [ ] Admin adds a student/mentor/lecturer with a password; that person signs in on the normal login with it.
- [ ] Admin resets someone's password: the old one fails, the new one works, their open sessions end.
- [ ] A lecturer can be given the mentor role (for a while or for good) and lose it again; trying to remove a
      user's main role, or give it an end date, is refused with `422`.
- [ ] A student added by the admin sees all weeks, with no manual enrolment.
- [ ] Admin edits a name/e-mail; marks a student as left (cannot sign in, leaves the team, work kept); brings back; deletes.
- [ ] Admin gives a mentor the lecturer role until a date; before it: lecturer rights; after it: none, without any action.
- [ ] Admin assigns a week to a lecturer and takes it off again.
- [ ] Admin replaces all teams; adds one team (name must be new); deletes one team (its students are left without a team, the others keep their names); moves a student; changes a mentor; removes all teams; each repeat is safe.
- [ ] A mentor sees only their team's work and grades, comments on a submission, sets a week's colour.
- [ ] A student books and cancels a 1:1 with their own mentor; another student never sees who booked.
- [ ] Admin broadcasts an announcement; every active user gets it; deadline reminders arrive once.
- [ ] Admin sees every calendar event; postponing keeps its length.
- [ ] A lecturer connects Google, creates an event with `sync_to_google`, sees `google_event_id`; editing and deleting it changes the Google copy; a revoked connection shows as `401` on `/auth/google/me`.
- [ ] Every item in section 6 returns `403` for the wrong role (one automated test per row).
