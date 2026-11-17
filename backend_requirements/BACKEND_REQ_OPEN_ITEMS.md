# Backend: what the front-end still needs

Written for the backend developer. Checked on 17 Nov 2026: every call the front-end makes (`src/api/`) against the
routes in `cmd/server/main.go` and the DTOs in `internal/dto` of `xsolla-capstone-backend` `dev` at **`ea1f07b`**.

This file replaces [BACKEND_INTEGRATION_CHECK.md](BACKEND_INTEGRATION_CHECK.md) (11 Nov). Most of what that check
listed is built now; the rest is below.

**Everything else the front-end uses works.**

| Area | Status |
|---|---|
| Module week dates | ✅ |
| Event meeting links | ✅ |
| Admin password reset | ✅ |
| Roles with end dates | ✅ |
| Students who left (`active`) | ✅ |
| Mentors reading modules and their team's hand-ins | ✅ |
| Week grades with feedback | ✅ |
| 1:1 slots and the per-student deadline (`task_due_at`, `due_from`) | ✅ |
| Notifications | ✅ |
| Reports | ✅ |
| Profiles | ✅ |
| Quizzes | ✅ |
| Mentor and lecture feedback | ✅ |
| Analytics for students and mentors | ✅ |

The front-end has **no demo data** any more: when a route is missing, the screen says "The server cannot … yet" or
leaves that part out. Each item below lists what users see until it is built.

| # | What | Kind | Size |
|---|---|---|---|
| 1 | Admin announcements | 2 new routes | medium |
| 2 | Delete one team | 1 new route | small |
| 3 | Mentor reads their team's quiz results | 1 new route + 1 permission | small |
| 4 | AI summary for a lecturer | 1 new route | small (copies the mentor one) |
| 5 | Late flag on hand-ins | new field | medium |
| 6 | Week grade turns red after a late hand-in | rule + field | medium |
| 7 | Tasks without a due date | rule change | small |
| 8 | Analytics count late work by the student's own deadline | rule change | small |

Items 5–8 are written out in full in [BACKEND_REQ_ONE_ON_ONE_DEADLINES.md](BACKEND_REQ_ONE_ON_ONE_DEADLINES.md);
below is only the summary.

---

## 1. Admin announcements

The admin writes a short message and sends it to a group. It lands in each person's bell (and their email, like the
other notifications). The admin's page also lists what was sent before.

### `POST /notifications/broadcast` (admin)

```json
{ "message": "The office is closed on Friday.", "link": "/calendar", "audience": "students" }
```

- `message`: trimmed, 1–500 characters; otherwise `422 validation_failed`.
- `link`: `""`, `"/calendar"` or `"/office-tour"` (an in-app page). Other values: `422`.
- `audience`: one of `all`, `students`, `mentors`, `lecturers`.
  - `all` = every active non-admin.
  - `mentors` / `lecturers` = everyone who **currently** has that role, including a role that has an end date which has
    not passed.
  - Students who left (`active = false`) and admins are never included.
- Creates one in-app notification per person, with a new `type` such as `announcement.sent`.
  - `title` = the message (the bell shows the title).
  - `message` = the same text.
- Answers `201` with the stored row (the shape below). `recipients` = how many people it reached.
- Not an admin: `403`.

### `GET /notifications/broadcasts` (admin)

Every announcement sent, in any order (the front-end sorts by `sent_at`):

```json
[
  {
    "id": 7,
    "message": "The office is closed on Friday.",
    "link": "/calendar",
    "audience": "students",
    "sent_at": "2026-11-17T09:00:00Z",
    "sent_by": "Admin name",
    "recipients": 29
  }
]
```

`link` may be `null`. `sent_by` is the sender's name.

**Until it is built:** the Announcements page cannot load its history, and sending fails.

---

## 2. Delete one team

### `DELETE /teams/{id}` (admin)

- Deletes the team.
- Its students stay, with no team (like `DELETE /teams/{id}/students`).
- Its mentor stays, with no team to mentor.
- Grades, hand-ins and reviews are kept.
- Answers `204`; an unknown id answers `404`; not an admin, `403`.

**Until it is built:** the bin icon on a team says "The server cannot delete a single team yet". Emptying the team or
replacing all teams still works.

---

## 3. A mentor reads their team's quiz results

Specified in [BACKEND_REQ_MENTOR_QUIZ_RESULTS.md](BACKEND_REQ_MENTOR_QUIZ_RESULTS.md).

In short:

- **New route:** `GET /teams/me/quiz-attempts?module_id=` (mentor) answers every attempt of every student in the
  mentor's own team, in the `QuizAttemptResponse` shape plus `student_id`.
- **Permission:** a mentor must also be able to read `GET /modules/{id}/quizzes`, which today is lecturer only.

**Until it is built:** the mentor's grading page shows no quiz results.

---

## 4. AI summary for a lecturer

The admin's analytics have a page for each lecturer, next to students and mentors. The front-end calls the same route
shape as the two that exist:

### `POST /analytics/lecturers/{lecturerId}/ai-summary` (admin)

- **Body and response:** exactly as `POST /analytics/mentors/{mentorId}/ai-summary`.
  - Body: `{ from?, to?, force_refresh }`.
  - Response: `{ summary, source_count, generated_at, cached, period }`.
- **What to summarise:** the written lecture feedback (`liked`, `improve`) about the lectures this person taught in the
  period.
  - "Taught" = the lecturer is in the lecture's `lecturers` list, as `GET /lecture-feedback` returns it today.
  - A lecture with several lecturers counts for each of them.
- **Errors:**
  - The id is not a lecturer: `404`.
  - No feedback in the period: the same answer the mentor route gives (empty summary, `source_count: 0`).
- **Like the other two:** the feedback is never returned, only the summary.

A `GET /analytics/lecturers/{id}` report is **not** needed: the lecturer page builds its numbers from
`GET /lecture-feedback`.

**Until it is built:** the lecturer page shows everything except the AI card, which says "The server cannot write
lecturer summaries yet".

---

## 5–8. 1:1 deadlines and late work

**Done in the backend on 2026-11-17** (backend `docs/one_on_one_deadlines.md`): the deadline is worked out from the
module's `opens_at` and the student's 1:1 (lecturers set none, `due_at` is optional); a late hand-in turns the week red
by itself (a mentor or admin can change it, for an exceptional case); `late` and `due_at` come on every submission;
the analytics counts use the same rule; slots only on Friday and Monday; no hand-in before a module opens. A change
after the 1:1 is not late; a change between the deadline and the end of the 1:1 is.

Still open:

| # | What | Until then |
|---|---|---|
| 9 | `late_submissions` (task titles) on each enrollment, so the mentor and the student can see **why** a week is red | The week is red, but the note "Red because of a late submission (task)" is not shown |
| 10 | Each student's deadline for a task, for staff: the mentor's team view needs it for the tasks the student has **not** handed in yet (to say "missing"). E.g. `due_at` per student on `GET /teams/me/...` or in the submission roster | The mentor's page works the deadline out itself from the booked slots (`dueLookup`), only for the "missing" label |

---

## Optional

- **Earlier versions of a hand-in** (`history` on `GET .../submissions/me`): the front-end shows them when present. The
  latest version alone is fine.
