import { memo, useState } from "react";
import type { QuizItem } from "../../types/course";
import { formatDateTime } from "../../utils/date";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { QuizRunner } from "./QuizRunner";

function QuizzesCardBase({
  quizzes = [],
  onSubmitAttempt,
}: {
  quizzes?: QuizItem[];
  onSubmitAttempt?: (quizId: string, answers: number[]) => Promise<void>;
}) {
  const readyQuizzes = quizzes.filter((q) => !q.status || q.status === "ready");
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const activeQuiz = readyQuizzes.find((q) => q.id === activeQuizId) ?? null;

  return (
    <section className="card" aria-labelledby="quizzes-title">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="sparkle" size={20} />
        </span>
        <h2 id="quizzes-title">Quizzes</h2>
        {readyQuizzes.length > 0 && (
          <span className="pill">{readyQuizzes.length}</span>
        )}
      </header>
      {readyQuizzes.length === 0 ? (
        <p className="card__empty">No quizzes in this module yet.</p>
      ) : (
        <ul className="list">
          {readyQuizzes.map((q) => {
            const n = q.questions?.length ?? 0;
            const hasAttempt = Boolean(q.attempt);
            return (
              <li key={q.id} className="list__row quiz-list__row">
                <div className="quiz-list__info">
                  <p className="list__title">{q.title}</p>
                  <p className="list__meta">
                    {n} {n === 1 ? "question" : "questions"}
                    {q.dueAt ? ` · due ${formatDateTime(q.dueAt)}` : ""}
                  </p>
                  {q.description && (
                    <p className="list__meta" title={q.description}>
                      {q.description}
                    </p>
                  )}
                  {q.attempt && (
                    <p className="quiz-list__score">
                      Score:{" "}
                      <strong>
                        {q.attempt.score}/{q.attempt.total}
                      </strong>
                    </p>
                  )}
                </div>
                {n > 0 && onSubmitAttempt && (
                  <button
                    type="button"
                    className={`btn btn--small ${hasAttempt ? "btn--ghost" : ""}`}
                    onClick={() => setActiveQuizId(q.id)}
                  >
                    {hasAttempt ? "View results" : "Start quiz"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={activeQuiz !== null}
        onClose={() => setActiveQuizId(null)}
        title={activeQuiz?.title ?? "Quiz"}
        size="lg"
      >
        {activeQuiz && onSubmitAttempt && (
          <QuizRunner
            key={activeQuiz.id}
            quiz={activeQuiz}
            onSubmit={onSubmitAttempt}
            onClose={() => setActiveQuizId(null)}
          />
        )}
      </Modal>
    </section>
  );
}

export const QuizzesCard = memo(QuizzesCardBase);
