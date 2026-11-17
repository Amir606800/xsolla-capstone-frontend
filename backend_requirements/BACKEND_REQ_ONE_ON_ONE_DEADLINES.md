# Backend requirements: 1:1-based deadlines and late submissions

**For:** the backend team · **From:** frontend · **Date:** 2026-11-16 · **Backend checked:** `dev` at `8441472`

## The rule (product decision)

- A task has **no deadline of its own**.
- A student's work for a week is due at **08:00 (school time, Asia/Baku) on the day of their 1:1** with their mentor.
  Mentors keep opening slots as today and students book one. A Friday 1:1 means Friday 08:00; a Monday 1:1 means
  Monday 08:00.
- **No 1:1 booked:** Monday 08:00.
- **The module's `closes_at` plays no part** in the deadline.
- **Hand-ins are never refused** after the deadline. A hand-in after the student's deadline is a **late submission**,
  and it turns the student's **week grade red** automatically. While that late hand-in stands, the mentor cannot make
  the week green or yellow; they can still add their module feedback.

## What the backend already does

`docs/one_on_one_deadlines.md` (commit `c492317`) covers most of the deadline itself:

- `due_at` is per student, worked out from their booked slots.
- `due_from` is `one_on_one` or `no_one_on_one`; `task_due_at` is the stored date.
- Late hand-ins are not refused.

The frontend uses all of this. What is still missing is below.

## 1. Tasks without a due date

**Today:** creating an assignment without `due_at` is refused (`ErrAssignmentMissingDueAt`). The 1:1 rule only applies
when the stored `due_at` falls Friday to Monday; tasks due Tuesday to Thursday keep their own date.

**Needed:**

- Accept assignments without `due_at` on `POST /modules/{id}/content-items` and `PATCH /content-items/{id}`.
- Anchor the 1:1 weekend on the **module's week**, not on the task: from the first Friday on or after
  `modules.opens_at` (00:00 school time) to the Tuesday after (00:00).
- Apply the rule to **every** assignment of the module, whatever date is stored.
- Staff responses may leave `due_at` out; the frontend no longer shows a deadline on a task.

**Until then:** the frontend sends `due_at` = the week's Friday 08:00 when it creates or edits a task. With today's rule,
that gives exactly the new deadlines.

## 2. A late flag on each hand-in

**Needed:**

- A `late` boolean on the submission, worked out and **stored when the work is handed in**: `submitted_at` after the
  student's deadline at that moment.
- Storing it keeps later changes from rewriting history: a 1:1 booked or cancelled afterwards does not change it. It
  also covers the case your doc lists as not covered (a Friday slot booked after Friday 08:00).
- A new version handed in after the deadline is **also late**. Once late, the hand-in stays late.
- Return `late` on every submission response:
  - `POST /modules/{m}/content-items/{a}/submissions`
  - `GET .../submissions/me`
  - the mentor's roster `GET /modules/{m}/content-items/{a}/submissions`

The frontend reads `late` when it is present. Until then it compares `submitted_at` with the deadline itself.

## 3. The week grade turns red automatically

When a late hand-in is stored:

- Set that student's enrollment in the module to `grade = 'red'`, `graded_at = now()` and `graded_by = NULL` (made by
  the system). Keep any `grade_feedback` already there.
- `PATCH /modules/{m}/enrollments/{u}/grade` with `green` or `yellow` while a late hand-in of that week exists:
  `422` with `error: "late_submission"` and the message "A task of this week was handed in late, so the week grade
  stays red."
- `red` with feedback is still accepted (feedback stays required, 1–1000 characters).
- `GET /modules/{m}/enrollments` returns the reason on each enrollment:

  ```json
  "late_submissions": [
    { "content_item_id": 12, "title": "HTTP server", "submitted_at": "2026-11-20T09:30:00Z", "due_at": "2026-11-20T04:00:00Z" }
  ]
  ```

  It is an empty array (or missing) when there is none. A student sees their own; staff see their students'.

## 4. Smaller follow-ups

- **Notification:** an `enrollment.graded` in-app notification when the grade turns red because of a late hand-in, e.g.
  "Your week 5 grade is red: HTTP server was handed in after your deadline."
- **Analytics:** the on-time / late / missing counts (`GET /analytics/students/{id}`) still use the stored task date
  and the first submission. They should use the student's own 1:1 deadline and the late rule above, so the analytics
  match what the student and mentor see.

## What the frontend does today (no backend change needed)

**Students:**

- Their own deadline on every task, with why: "the day of your 1:1" or "no 1:1 booked yet".
- Booking or cancelling a 1:1 moves the deadline at once.
- The hand-in form stays open after the deadline and warns that late work turns the week red.
- Late work is tagged "Late submission".

**Mentors:**

- Each student's own deadline on the Grading page, worked out from the slots they booked.
- A red "Late submission" tag on late work.
- Green and yellow are disabled for a week with a late hand-in, with the reason shown.

**Lecturers:**

- The task form has no due date any more. It explains that work is due at 08:00 on each student's 1:1 day (Friday or
  Monday).

**Calendar:** shows a student's own deadlines. Staff see none, since a task has no deadline of its own.
