"use client";

import { useMemo, useState } from "react";
import type { MCQuestion } from "@/lib/questionBank";
import MathText from "@/components/math/MathText";
import { recordQuestionAttempt } from "@/lib/progress/attemptTracking";

export default function MultipleChoiceCard(props: {
  question: MCQuestion;
  index: number;
  sectionTotalQuestions: number;
  onCheck: (selectedIndex: number, isCorrect: boolean) => void;
  onRetry: () => void;
}) {
  const { question, index, sectionTotalQuestions, onCheck, onRetry } = props;

  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [lockedCorrect, setLockedCorrect] = useState(false);

  const isCorrect = useMemo(() => {
    if (selected === null) return false;
    return selected === question.answerIndex;
  }, [selected, question.answerIndex]);

  const handleCheck = async () => {
    if (selected === null) return;

    setChecked(true);
    if (isCorrect) setLockedCorrect(true);

    onCheck(selected, isCorrect);

    await recordQuestionAttempt({
      courseId: "algebra1",
      chapterId: "ch1",
      sectionId: "s1",
      questionId: question.id,
      selectedAnswer: String(selected),
      correct: isCorrect,
      sectionTotalQuestions,
    });
  };

  const handleRetry = () => {
    setSelected(null);
    setChecked(false);
    setLockedCorrect(false);
    onRetry();
  };

  return (
    <article className="question-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="text-base font-semibold text-slate-600">
          Question {index + 1}
        </div>
      </div>

      <div className="mt-4 text-2xl leading-9 text-slate-900">
        {question.prompt.split("\n").map((line, i) => (
          <div key={i} className={i === 0 ? "" : "mt-1"}>
            {line === "" ? (
              <span className="block h-6" />
            ) : (
              <MathText>{line}</MathText>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {question.choices.map((choice, i) => {
          const active = selected === i;
          const disabled = lockedCorrect;

          const base =
            "w-full rounded-xl border px-4 py-3 text-left text-lg transition";

          const cls = active
            ? "border-blue-600 bg-blue-50 text-slate-900"
            : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50";

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              className={`${base} ${cls} ${disabled ? "opacity-80" : ""}`}
              onClick={() => setSelected(i)}
            >
              <span className="font-semibold text-slate-600">
                {String.fromCharCode(65 + i)}.
              </span>
              <span>{"\u00A0\u00A0"}</span>
              <MathText>{choice}</MathText>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleCheck}
          disabled={selected === null || lockedCorrect}
        >
          Check answer
        </button>

        {checked && (
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              isCorrect
                ? "bg-emerald-100 text-emerald-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            {isCorrect ? "Correct" : "Incorrect"}
          </span>
        )}

        {checked && (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50"
            onClick={handleRetry}
          >
            Retry question
          </button>
        )}
      </div>

      {checked && question.explanation && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-base leading-7 text-slate-900">
          <div className="font-semibold text-slate-900">Explanation</div>
          <div className="mt-1 whitespace-pre-wrap">
            <MathText>{question.explanation}</MathText>
          </div>
        </div>
      )}
    </article>
  );
}