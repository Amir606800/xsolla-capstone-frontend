# Backend request: a mentor can see their students' quiz results

**For:** the backend developer (quiz routes on branch `feat/ai-quiz`).

## Why

The mentor's grading page now has one card per student for the chosen week. Each card, and each student's page, shows
how the student did on the week's quizzes (taken or not, and the score). A quiz attempt today is only ever returned to
the student who made it (`GET /modules/:id/quizzes` attaches the caller's own `attempt`). A mentor cannot see their
students' attempts, so with the real server the page says "Quiz results are not available from the server yet".

## What we ask

```
GET /teams/me/quiz-attempts?module_id=<id>     (mentor; module_id optional = every module)
```

Answer `200` with every attempt of every student in the mentor's team (only that team):

```json
[ { "id": 3, "quiz_id": 7, "student_id": 101, "answers": [1, 0, 2], "score": 2, "total": 3,
    "submitted_at": "2026-11-12T10:15:00Z" } ]
```

- Same shape as `attempt` on a quiz today (`QuizAttemptResponse`).
- A student without an attempt simply has no row.
- `403` for someone who is not a mentor; admins may get every team's attempts if that is easy.
- The mentor also needs to read the quiz itself (`GET /modules/:id/quizzes`), see "Quizzes", rule 2, in
  `BACKEND_REQUIREMENTS.md` (today that call answers `403` to a mentor).

## What the front-end does then

`src/api/quizResults.ts` calls this route instead of answering "not available"; the cards and the student page then
show "Taken 2/3" or "Not taken" per quiz. A `404` / `405` keeps the current "not available" text.
