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
