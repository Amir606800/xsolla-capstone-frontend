# Backend request: module feedback with the week grade

**For:** the backend developer (`xsolla-capstone-backend`).

**Status:** the front-end is built and already sends the field below. Until the server keeps it, the grade still saves
(the server ignores the extra field) and the mentor is told "The server did not keep the module feedback yet", so
nothing breaks in the meantime.

## What changed

A mentor grades each student's **week** (green, yellow or red) with `PATCH /modules/:moduleId/enrollments/:userId/grade`.
Until now the grade was only a colour. From now on every week grade comes with a **module feedback**: a few words from the
mentor on the week. It is **required**. The comments on single tasks stay **optional** (`POST /submissions/:id/feedback`
is unchanged).

| | Where | Required |
|---|---|---|
| **Module feedback** | with the week grade | **yes** |
| Task comment | on one hand-in | no |

## 1. Giving the grade

**`PATCH /modules/:moduleId/enrollments/:userId/grade`** (mentor of the student, or admin), body:

```json
{ "grade": "yellow", "feedback": "Routing app was late. Please tell me early if you are stuck." }
```

- `feedback`: text, trimmed, **1 to 1000 characters**. Missing, empty or only spaces: `422 validation_failed`
  ("feedback is required"). More than 1000: `422` naming the field. The front-end checks both before sending.
- A new grade for the same week replaces the old grade **and** the old feedback (the last one counts, as today).
- Answer `200` with the enrollment, now including the two new fields (section 2).
- The existing rules do not change: the colour is `red`, `yellow` or `green`; `404` when the student is not enrolled;
  `403` for anyone else.

## 2. Reading it

Wherever the grade is returned, return the feedback next to it:

- the enrollment objects of `GET /modules/:moduleId/enrollments` (the mentor's team page reads these);
- the `PATCH` answer above;
- **the student's own view.** A student must see the feedback of their own weeks on My grades. The front-end reads the
  grade from the enrollments today; if a student reads their own grade from `GET /modules` (the module's `grade`), add the
  same two fields there.

```json
{ "id": 12, "module_id": 4, "user_id": 31, "grade": "yellow",
  "feedback": "Routing app was late. Please tell me early if you are stuck.",
  "graded_at": "2026-11-15T10:12:00Z", "created_at": "2026-11-01T00:00:00Z" }
```

- `feedback` is `null` (or left out) for a week graded before this existed. The front-end shows only the colour then.
- `graded_at` is when the grade was last written. Without it the front-end uses the week's closing date.

## 3. Data

One text column is enough, next to the grade on the enrollment: `grade_feedback text NULL` (check: 1 to 1000 characters
when set) and `graded_at timestamptz NULL`. No new table.

## What the front-end does

- The week grade form asks for the module feedback ("Module feedback for {name} (required)", with a character counter)
  and will not save without it. A colour alone is refused with "Write the module feedback for {name}: it is required."
- It sends `{ grade, feedback }` and shows the feedback to the student under their week, and to the mentor on the locked
  week.
- If the saved grade comes back without feedback (the server does not keep it yet), the mentor sees: "The server did not
  keep the module feedback yet, so the student will only see the colour."

## Checklist

- [ ] `feedback` accepted and validated on `PATCH .../enrollments/:userId/grade` (required, 1 to 1000)
- [ ] `grade_feedback` and `graded_at` stored on the enrollment
- [ ] `feedback` and `graded_at` returned by the enrollments, the PATCH answer and the student's own module/grade read
- [ ] Swagger and `FRONTEND_REQUIREMENTS.md` updated
