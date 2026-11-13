# Backend requirements: weekly mentor review

Written for the backend developer. This file covers **only** the weekly mentor review; the earlier requirements are
done or parked. Checked against `xsolla-capstone-backend` `master` at `8f04f85` (no mentor-review routes exist yet).

The front-end is built and runs on its demo store. With a real server it calls the two routes in section 3. **Until
they exist the feature is off** (a 404 on `GET /mentor-reviews/me` means "not available": no reminder, no lock), so
nothing breaks in the meantime.

---

## 1. What the feature is

Every week each student reviews the week with **their mentor** (the mentor of their team; the student never picks
one). It replaces the Google Form "Mentor Session Feedback". The answers will feed an analytics page for admins later.

- **One review per student per week.** A week is a module (`modules.opens_at` .. `closes_at`).
- **It is mandatory.**
  - On **Saturday and Sunday** of the running week the student sees a reminder and can send the review.
  - **When the week is over** (`now > closes_at`) and the review is missing, the LMS is **locked** for that
    student: every page sends them to the form until it is sent.
  - Only the **last finished week** is asked for. Older missing weeks are not chased.
- **Never asked:** mentors, lecturers, admins; a student with no team; a student whose team has no mentor.

## 2. The form (what is stored)

| # | Question | Field | Type | Required |
|---|---|---|---|---|
| 1 | Did you have your 1:1 session with your mentor this week? | `had_session` | boolean | always |
| 2 | Why was there no session? | `no_session_reason` | one of `mentor-unavailable`, `student-unavailable`, `not-scheduled`, `other` | only when `had_session` is false |
| 3 | What did you discuss? (several) | `topics` | array of `goals`, `homework`, `lecture`, `project`, `career`, `other` (at least one) | only when `had_session` is true |
| 3a | The "other" topic | `other_topic` | text, max 120 | only when `topics` has `other` |
| 4 | Four statements, 1 = strongly disagree .. 5 = strongly agree | `ratings` | object, each 1-5 (keys below) | only when `had_session` is true |
| 5 | Overall, how satisfied are you with your mentor's support this week? | `overall` | 1-5 | always |
| 6 | Any comments or suggestions? | `comment` | text, max 1000 | optional |

`ratings` keys, from the old form:

| Key | Statement |
|---|---|
| `clarity` | The mentor's guidance was clear and useful |
| `engagement` | My mentor was actively engaged in helping me, not just present |
| `comfort` | I felt comfortable asking questions and getting support |
| `time` | I had enough time with my mentor to cover what I needed |

Questions 1, 2 and 5 are new compared with the Google Form. 1 and 2 separate "the session was bad" from "there was
no session" (the old form could not tell them apart); 5 gives one number per student, mentor and week for trends.
The e-mail and "Name of your mentor" questions are gone: the server knows both.

## 3. Endpoints the front-end calls now

### GET /mentor-reviews/me

Auth: student. The weeks the caller has already reviewed. The front-end uses it to decide about the reminder and
the lock.

```json
[ { "module_id": 4, "submitted_at": "2026-11-15T10:12:00Z" } ]
```

`[]` when there are none. Answers are not needed here.

### POST /mentor-reviews

Auth: student. Sends the review of one week.

With a session:
```json
{ "module_id": 4, "had_session": true,
  "topics": ["goals", "other"], "other_topic": "CV review",
  "ratings": { "clarity": 5, "engagement": 4, "comfort": 5, "time": 3 },
  "overall": 4, "comment": "More code reviews please" }
```

Without a session:
```json
{ "module_id": 4, "had_session": false, "no_session_reason": "not-scheduled", "overall": 2 }
```

Fields that do not apply are left out (never sent empty).

- **201** with `{ "module_id": 4, "submitted_at": "..." }`.
- The server sets `student_id` from the token and **`mentor_id` from the student's team at that moment** (store
  it on the row: the team's mentor may change later, the review must stay with the mentor it was about).
- **409** when this student already reviewed this week (the front-end treats it as "sent").
- **422** `validation_failed` when the rules of section 2 are broken, the student has no team or the team has no
  mentor, or the week is not open for review yet (see rule below).
- **403** for anyone who is not a student. **404** for an unknown module or one the student is not enrolled in.
- A review cannot be changed or deleted by the student.

**When a week can be reviewed:** from Saturday 00:00 of the week (school time zone, see D2) and any time after it
closed. Simplest check: `now >= closes_at - 48h`.

## 4. Data model

```sql
CREATE TABLE mentor_reviews (
    id                bigserial PRIMARY KEY,
    module_id         bigint NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    student_id        bigint NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    mentor_id         bigint NOT NULL REFERENCES users(id)   ON DELETE CASCADE,  -- the team's mentor when it was sent
    team_id           bigint NULL     REFERENCES teams(id)   ON DELETE SET NULL,
    had_session       boolean NOT NULL,
    no_session_reason text NULL CHECK (no_session_reason IN ('mentor-unavailable','student-unavailable','not-scheduled','other')),
    topics            text[] NOT NULL DEFAULT '{}',
    other_topic       text NULL,
    rating_clarity    smallint NULL CHECK (rating_clarity    BETWEEN 1 AND 5),
    rating_engagement smallint NULL CHECK (rating_engagement BETWEEN 1 AND 5),
    rating_comfort    smallint NULL CHECK (rating_comfort    BETWEEN 1 AND 5),
    rating_time       smallint NULL CHECK (rating_time       BETWEEN 1 AND 5),
    overall           smallint NOT NULL CHECK (overall BETWEEN 1 AND 5),
    comment           text NULL,
    submitted_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (module_id, student_id)
);
CREATE INDEX mentor_reviews_mentor ON mentor_reviews (mentor_id, module_id);
```

Separate rating columns (not JSON) keep the averages for the analytics page plain SQL.

## 5. The lock

The front-end enforces the lock (it redirects the student to the form). That is enough for honest use, but anyone
calling the API directly gets past it. If the school wants it enforced for real, add a middleware for the
`student` role: when the student owes last week's review (same rule as section 1), answer every route with

```json
{ "error": "mentor_review_required", "message": "Send last week's mentor review first.", "status": 423 }
```

except `GET /users/me`, `GET /teams/me`, `GET /modules`, `/mentor-reviews*`, `/auth/*`. This is **optional** (D4);
tell the front-end if you add it and it will handle the 423.

## 6. Reminder notification (when notifications exist)

Saturday 10:00 school time, to every student who has a mentor and has not reviewed the running week:
"Review your week with {mentor name}. The LMS locks on Monday until it is sent." Link: `/mentor-review`.
The front-end already shows its own reminder on every page during the weekend, so this is an extra.

## 7. For the analytics page (not called yet)

The admin dashboard will need these later; the exact shapes can be agreed then.

- `GET /mentor-reviews?module_id=&mentor_id=&team_id=` (admin): the rows, with student and mentor names.
- `GET /mentor-reviews/summary?from_module=&to_module=` (admin): per mentor and week: number of reviews, number of
  students expected, sessions held, average of each rating and of `overall`, topic counts, no-session reasons.
- `GET /mentor-reviews/missing?module_id=` (admin): students who have not sent the week's review.

## 8. Open decisions

| # | Question | What the front-end assumes |
|---|---|---|
| D1 | **Do mentors see the reviews about them?** | **No.** The form tells students "your answers go to the school team, not to your mentor". If mentors should see them (even as averages), that sentence has to change first. |
| D2 | Which time zone decides "Saturday" and "the week is over"? | The week's `opens_at` / `closes_at` as stored, and the student's browser for Saturday/Sunday. A fixed school time zone (Asia/Baku) on the server would be cleaner. |
| D3 | A student joins a team, or the team gets its mentor, in the middle of a week? | They review the mentor they have when they send it. A student with no mentor at that time is not asked. |
| D4 | Should the server enforce the lock (section 5)? | Not required for the front-end to work. |
| D5 | The week after the program's last week: lock forever if the last review is missing? | Yes, until it is sent. |

## 9. Checklist

- [ ] Migration `mentor_reviews`
- [ ] `GET /mentor-reviews/me`
- [ ] `POST /mentor-reviews` with the validation of section 2 and `mentor_id` taken from the team
- [ ] Decide D1-D5
- [ ] (Optional) lock middleware, reminder notification
- [ ] (Later) admin read routes for analytics
- [ ] `API_CONTRACT.md` updated

---

# Also needed: set my own password

There is no e-mail reset yet, so Settings has a "Change password" form for **every role**. It asks for the new
password and its repeat only: **no current password and no e-mail confirmation**, so a person who forgot theirs can
still get back in.

| Who | Route |
|---|---|
| **Admin** | `PUT /users/:id/password` with their own id: **already on the server** |
| Student, mentor, lecturer | **`PUT /users/me/password`: new, see below** |

## Admin: nothing new, one thing to know

`PUT /users/{id}/password` `{ "password": "..." }` (admin only) validates the rules, hashes, and **deletes all of that
user's refresh tokens**. For an admin changing their own password that signs them out as soon as the access token
expires, so the front-end signs the admin out right away and shows "Your password is changed. Sign in with the new
one." If you would rather keep the current session, spare the refresh token the request came with when `id` is the
caller's own (tell us and we will drop the sign-out).

## Student, mentor, lecturer: PUT /users/me/password

Auth: any signed-in user (the access token is the only proof, as there is no current password to check).

```json
{ "password": "Zebra-Quartz-7781" }
```

- **204** on success.
- **422** `validation_failed` when the new password breaks the rules (10 to 72 characters, a lowercase letter, an
  uppercase letter, a number, no spaces, not containing the user's name or e-mail). The front-end shows the `message`.
- Store it hashed like any password and **end the user's other sessions** (delete their other `refresh_tokens`), but
  keep the one the request came with, so the user stays signed in on this device.
- Never return or log the password.
- Register it so `/users/me/password` is not read as `/users/{id}/password` with id `me` (that route is admin only
  and answers 403 / 400). Until this route exists, the form says "The server cannot change your own password yet.
  Ask an admin to reset it for you."

**Security note:** with no current password and no e-mail check, whoever has a signed-in browser can take the account.
The access token should be short-lived (it is the only guard), and the front-end signs people out on request. If this
becomes a concern, the cheapest step is to require the current password again for non-admins; the form already has a
place for it in git history.

---

# Assign modules to lecturers (uses the existing enrollments endpoints)

An admin gives each module (week) to one or more **lecturers**, who prepare it. A week can have several lecturers and a lecturer can teach several weeks. **No new backend work is needed for this:** the
front-end uses the enrollment routes that already exist.

- **Assign:** `POST /modules/:id/enrollments { "user_id": <lecturer> }` (admin). A `409` (already enrolled) counts as done.
- **Take off:** `DELETE /modules/:id/enrollments/:userId` (a `404` counts as done). Only that lecturer is removed; the
  week's other lecturers stay.
- **Who teaches a week:** the front-end reads `GET /users` (once) for who has the `lecturer` role, and
  `GET /modules/:id/enrollments` per module; every enrolled user with the lecturer role is a lecturer of the week.
  Students and admins enrolled in the module are ignored. If those calls fail (403, old server) modules just show
  "no lecturer".
- `created_by` is always the admin who made the module; the front-end does not show it or treat it as the lecturer.
- If the server later sends `lecturer_id` on a module it is used when no lecturer is enrolled.

## Nice to have (not required)

- Add `role` (and `name`) to the objects of `GET /modules/:id/enrollments` (the store already has them) so the
  front-end need not call `GET /users` as well, and a lecturer-role `GET /users` for non-admins.
- `GET /modules` for a lecturer returns every module today; a "my modules" filter (`?lecturer=me`) is optional, the
  front-end filters locally.

## Permissions: "teacher of the module" becomes "the assigned lecturer"

Everywhere the server asks `IsUserTeacherOfModule` (today: `modules.created_by = caller`), accept a lecturer who is
**enrolled in the module** instead (or `lecturer_id`/a lecturers list if one is added); admins pass as before. Without
this an assigned lecturer is enrolled but still cannot edit the module:

- `PATCH` / `DELETE /modules/:id` (title, description, dates).
- `POST /modules/:id/content-items`, `PATCH` / `DELETE /content-items/:id`.
- Linking an **event** to a module (`POST` / `PATCH /events` with `module_id`), and the lecturer's list of events.
- Reading the submissions roster of a task, and writing feedback.
- Reading a hand-in file (`CanReadFile`).

A lecturer still **reads** every module (the calendar and course content need the whole course); only editing is
limited to their own. Moving a week to another lecturer moves these rights with it at once; what the previous
lecturer wrote stays in the module.

## Notes

- If a lecturer's `lecturer` role ends (`expires_at`), keep `lecturer_id` but treat the module as without a
  lecturer for permissions, and tell the admin (the Overview warning already lists weeks with no lecturer).
- *(Optional, with notifications)* tell the lecturer when a module is assigned to or taken from them:
  "Module 5 'React' is now yours." Link: `/courses/:id`.
- `GET /users` could add `"module_ids": [3, 5]` per lecturer for the admin's Lecturers page; the front-end counts
  them itself from `GET /modules` today.

---

# Also needed: quizzes, and (optionally) a bulk module import

The admin can export the modules as a template file and import it for a new group. Import uses the routes that exist
today, so **modules, tasks and links already work**. What the server cannot take yet:

## 1. Quizzes (needed: the import skips every quiz until this exists)

Lecturers write quizzes in the LMS (a title, an optional deadline, multiple-choice questions) and students see that
they exist. With a real server they cannot be saved at all ("Quizzes cannot be saved by the backend yet"), so an
imported template loses them and a lecturer's quiz form fails.

- Add `quiz` to the allowed `content_items.type` values, next to `file`, `assignment`, `link`.
- A quiz is a content item with: `title`, `description`, optional `due_at`, `is_visible`, and a list of questions.
  Suggested table:

```sql
CREATE TABLE quiz_questions (
    id          bigserial PRIMARY KEY,
    content_item_id bigint NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    position    int  NOT NULL DEFAULT 0,
    prompt      text NOT NULL,
    options     text[] NOT NULL CHECK (array_length(options, 1) BETWEEN 2 AND 8),
    correct     int  NULL CHECK (correct >= 0)      -- index into options
);
```

- `POST /modules/:id/content-items` and `PATCH /content-items/:id` accept the quiz:

```json
{ "type": "quiz", "title": "Go basics", "description": "", "due_at": "2026-11-20T18:00:00Z",
  "questions": [ { "prompt": "2 + 2?", "options": ["3", "4", "5"], "correct": 1 } ] }
```

  `422` when a question has fewer than 2 options or `correct` is not one of them.
- **Never send `correct` to students** (`GET /modules/:id/content-items`): they only get `prompt` and `options`.
  Lecturers (of that module) and admins get the answers.
- Taking a quiz (answers, score) is **not** asked for here; students only see that the quiz exists.

## 2. One-call module import (optional, nicer than what we do now)

Today an import is one `POST /modules` per module plus one `POST /modules/:id/content-items` per item, one after the
other, with no undo: if the connection drops half-way, a few modules exist and the rest do not. A template of 12
modules is about 60 requests.

```
POST /modules/import   (admin)
{ "modules": [ { "title": "...", "description": "...", "opens_at": "...", "closes_at": "...",
                 "lecturer_id": null,
                 "items": [ { "type": "assignment", "title": "...", "description": "...", "due_at": "..." },
                            { "type": "link", "title": "...", "url": "https://..." },
                            { "type": "quiz", "title": "...", "questions": [ ... ] } ] } ] }
```

- Everything in **one transaction**: all modules and items are made, or none. `201` with the made modules
  (ids included); `422` with the index of the module / item that is wrong.
- Same rules as the single routes (`opens_at < closes_at`, a task needs `due_at`, a link needs an http(s) `url`).
- Auto-enrol students in each new module, as `POST /modules` does.
- The front-end would call it instead of the loop and keep the loop as the fallback for a server without it
  (`404` / `405`). Tell us when it exists.

## 3. Not needed, for the record

- Uploaded files are not part of a template (they are binary and stay on the server); admins add them again.
- The lecturer of an imported module is the admin who imports until `lecturer_id` exists (see "assign modules to
  lecturers" above); with it, a template could carry a lecturer per module.
