"use client";

import { Check, Circle, Target, X } from "lucide-react";
import type { ChapterQuizQuestion } from "@/app/book/data/mockChapters";
import type { QuizResult } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

type QuizPanelProps = {
  questions: ChapterQuizQuestion[];
  answers: Record<string, number>;
  result: QuizResult | null;
  explanationOpen: Record<string, boolean>;
  requiredScore: number;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onSubmit: () => void;
  onReviewSummary: () => void;
  onRetry: () => void;
  onUnlockNext: () => void;
  onToggleExplanation: (questionId: string) => void;
  nextChapterLabel: string;
};

function questionCardClass(hasFailed: boolean, hasPassed: boolean): string {
  if (hasPassed) return "border-emerald-300/30 bg-emerald-500/7";
  if (hasFailed) return "border-rose-300/35 bg-rose-500/7";
  return "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]";
}

export function QuizPanel({
  questions,
  answers,
  result,
  explanationOpen,
  requiredScore,
  onAnswer,
  onSubmit,
  onReviewSummary,
  onRetry,
  onUnlockNext,
  onToggleExplanation,
  nextChapterLabel,
}: QuizPanelProps) {
  const answeredCount = questions.filter((question) => typeof answers[question.id] === "number").length;
  const canSubmit = answeredCount === questions.length && !result;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-sky-300/25 bg-sky-500/8 px-4 py-3 text-sm text-sky-100">
        <p className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          {requiredScore}% required to unlock the next chapter · {questions.length} questions
        </p>
      </div>

      {result ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3",
            result.passed
              ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
              : "border-rose-300/35 bg-rose-500/10 text-rose-100",
          ].join(" ")}
        >
          <p className="text-lg font-semibold">
            {result.passed ? `✓ ${result.score}% — Great work` : `${result.score}% — Not quite`}
          </p>
          <p className="text-sm opacity-90">
            {result.passed
              ? "Chapter quiz passed. You can unlock the next chapter now."
              : `${requiredScore}% required. Review answers below.`}
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {questions.map((question, index) => {
          const selectedIndex = answers[question.id];
          const submitted = Boolean(result);
          const answeredCorrectly = submitted ? selectedIndex === question.correctIndex : false;
          const hasFailed = submitted && !answeredCorrectly;
          const hasPassed = submitted && answeredCorrectly;

          return (
            <article
              key={question.id}
              className={[
                "rounded-[24px] border p-5 shadow-[0_18px_40px_rgba(2,6,23,0.38)]",
                questionCardClass(hasFailed, hasPassed),
              ].join(" ")}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xl font-semibold text-slate-100">
                  <span className="mr-2 text-base uppercase tracking-[0.14em] text-slate-500">Q{index + 1}</span>
                  {question.prompt}
                </p>
                {submitted ? (
                  answeredCorrectly ? (
                    <Check className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <X className="h-4 w-4 text-rose-300" />
                  )
                ) : null}
              </div>

              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const selected = selectedIndex === optionIndex;
                  const isCorrect = optionIndex === question.correctIndex;

                  const className = (() => {
                    if (!submitted) {
                      return selected
                        ? "border-sky-300/45 bg-sky-500/16 text-sky-100"
                        : "border-white/12 bg-white/[0.02] text-slate-300 hover:border-white/25";
                    }

                    if (isCorrect) return "border-emerald-300/40 bg-emerald-500/14 text-emerald-100";
                    if (selected && !isCorrect) return "border-rose-300/45 bg-rose-500/14 text-rose-100";
                    return "border-white/12 bg-white/[0.02] text-slate-400";
                  })();

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={submitted}
                      onClick={() => onAnswer(question.id, optionIndex)}
                      className={[
                        "w-full rounded-xl border px-4 py-3 text-left transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
                        className,
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center gap-3">
                        {selected ? (
                          <Circle className="h-4 w-4 fill-current" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                        <span className="text-lg">{option}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {submitted && !answeredCorrectly ? (
                <p className="mt-3 text-sm text-rose-200">
                  Correct answer: <span className="font-semibold">{question.options[question.correctIndex]}</span>
                </p>
              ) : null}

              {submitted ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onToggleExplanation(question.id)}
                    className="text-sm text-sky-200 underline decoration-dotted underline-offset-4"
                  >
                    Show me why
                  </button>
                  {explanationOpen[question.id] ? (
                    <p className="mt-2 text-sm text-slate-300">{question.explanation}</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {result ? (
        result.passed ? (
          <button
            type="button"
            onClick={onUnlockNext}
            className="w-full rounded-2xl border border-emerald-300/35 bg-emerald-500/20 px-4 py-3 text-lg font-semibold text-emerald-50 shadow-[0_12px_30px_rgba(16,185,129,0.25)]"
          >
            ✓ {nextChapterLabel}
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onReviewSummary}
              className="rounded-2xl border border-white/20 bg-white/[0.03] px-4 py-3 text-lg font-semibold text-slate-100"
            >
              Review Summary
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-2xl border border-sky-300/35 bg-sky-500/16 px-4 py-3 text-lg font-semibold text-sky-100"
            >
              Try Again
            </button>
          </div>
        )
      ) : (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className={[
            "w-full rounded-2xl px-4 py-3 text-lg font-semibold transition",
            canSubmit
              ? "bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-[0_14px_32px_rgba(14,165,233,0.34)]"
              : "cursor-not-allowed border border-white/12 bg-white/[0.03] text-slate-500",
          ].join(" ")}
        >
          Submit Answers ({answeredCount}/{questions.length})
        </button>
      )}
    </section>
  );
}
