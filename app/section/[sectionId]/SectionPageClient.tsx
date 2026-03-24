"use client";

import { useEffect, useRef, useState } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

import RainbowBar from "@/components/progress/RainbowBar";
import { recordQuestionAttempt } from "@/lib/progress/attemptTracking";
import { emitProgressUpdated } from "@/lib/progress/events";
import {
  ensureSectionProgress,
  getSectionPercent,
  recordAttempt as recordLocalAttempt,
} from "@/lib/sectionProgressLocal";

type Question = {
  id: string;
  type: string;
  prompt: string;
  image?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
  choiceImages?: string[];
  choices: string[];
  answerIndex: number;
  explanation?: string;
  hint?: string;
};

type WorkedExample = {
  enabled?: boolean;
  problem?: string;
  steps?: string[];
  answer?: string;
  aiHint?: string;
};

type SectionData = {
  sectionId: string;
  title: string;
  lesson: {
    title: string;
    intro: string[];
  };
  workedExample?: WorkedExample;
  questions: Question[];
};

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return <span key={index}>{part}</span>;
  });
}

export default function SectionPageClient({ data }: { data: SectionData }) {
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [incorrect, setIncorrect] = useState<Record<string, boolean>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [progressPercent, setProgressPercent] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const totalQuestions = data.questions.length;
  const sectionId = data.sectionId;

  useEffect(() => {
    if (!containerRef.current) return;

    const timer = window.setTimeout(() => {
      renderMathInElement(containerRef.current as HTMLElement, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "$$", right: "$$", display: true },
        ],
        throwOnError: false,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [data, mastered, incorrect, showHint]);

  useEffect(() => {
    ensureSectionProgress(sectionId, totalQuestions);
    setProgressPercent(getSectionPercent(sectionId, totalQuestions));
  }, [sectionId, totalQuestions]);

  const refreshProgress = () => {
    setProgressPercent(getSectionPercent(sectionId, totalQuestions));
  };

  const handleSelect = (questionId: string, choiceIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: choiceIndex,
    }));

    setIncorrect((prev) => ({
      ...prev,
      [questionId]: false,
    }));
  };

  const handleCheck = async (question: Question) => {
    const selected = answers[question.id];

    if (selected === undefined || selected === null) return;

    const isCorrect = selected === question.answerIndex;
    const wasMastered = mastered[question.id];

    if (isCorrect) {
      setMastered((prev) => ({
        ...prev,
        [question.id]: true,
      }));

      setIncorrect((prev) => ({
        ...prev,
        [question.id]: false,
      }));

      setShowHint((prev) => ({
        ...prev,
        [question.id]: false,
      }));
    } else {
      setIncorrect((prev) => ({
        ...prev,
        [question.id]: true,
      }));

      setShowHint((prev) => ({
        ...prev,
        [question.id]: true,
      }));
    }

    try {
      const chapterId = sectionId.split("_")[0] ?? "unknown";

      if (isCorrect && !wasMastered) {
        recordLocalAttempt({
          sectionId,
          questionId: question.id,
          isCorrect: true,
          answerIndex: selected,
          totalQuestions,
        });

        refreshProgress();
      }

      await recordQuestionAttempt({
        courseId: "algebra1",
        chapterId,
        sectionId,
        questionId: question.id,
        selectedAnswer: String(selected),
        correct: isCorrect,
        sectionTotalQuestions: totalQuestions,
      });

      emitProgressUpdated();
    } catch (err) {
      console.error("Attempt/progress autosave error:", err);
    }
  };

  return (
    <div
      ref={containerRef}
      className="max-w-4xl mx-auto px-4 py-8 pb-32 space-y-8"
    >
      {/* MINI LESSON */}
      <div className="bg-white rounded-xl shadow p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          MINI LESSON
        </p>

        <h2 className="text-xl font-bold mb-4 text-gray-900">
          {data.lesson.title}
        </h2>

        {data.lesson.intro.map((line, i) => (
          <p key={i} className="mb-4 text-gray-800 leading-8">
            {renderBoldText(line)}
          </p>
        ))}
      </div>

      {/* QUESTIONS */}
      {data.questions.map((question, idx) => {
        const selected = answers[question.id];
        const isMastered = mastered[question.id];
        const isIncorrect = incorrect[question.id];

        return (
          <div key={question.id} className="bg-white rounded-xl shadow p-6">
            <p className="text-xs font-semibold text-gray-500 mb-3">
              Question {idx + 1}
            </p>

            <div className="text-lg mb-4 leading-8 text-gray-900">
              {renderBoldText(question.prompt)}
            </div>

            {/* ANSWERS */}
            <div className="space-y-3 mt-4">
              {question.choices.map((choice, choiceIndex) => {
                const isSelected = selected === choiceIndex;

                let buttonClass =
                  "w-full text-left border rounded-lg px-4 py-3 transition text-gray-900";

                if (isMastered && isSelected) {
                  buttonClass += " bg-green-100 border-green-400";
                } else if (isIncorrect && isSelected) {
                  buttonClass += " bg-red-100 border-red-400";
                } else {
                  buttonClass += isSelected
                    ? " bg-blue-50 border-blue-400"
                    : " bg-white border-gray-300";
                }

                return (
                  <button
                    key={choiceIndex}
                    onClick={() => handleSelect(question.id, choiceIndex)}
                    className={buttonClass}
                  >
                    <span className="font-semibold mr-2">
                      {String.fromCharCode(65 + choiceIndex)}.
                    </span>
                    {renderBoldText(choice)}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleCheck(question)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              Check answer
            </button>

            {isIncorrect && (
              <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 font-medium">
                Incorrect. Try again.
              </div>
            )}

            {showHint[question.id] && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
                <strong className="font-semibold">Hint:</strong>{" "}
                {question.hint ??
                  "Eliminate choices that don't match conditions."}
              </div>
            )}

            {isMastered && question.explanation && (
              <div className="mt-4 p-3 bg-gray-50 border rounded-lg text-sm text-gray-800 leading-7">
                {renderBoldText(question.explanation)}
              </div>
            )}
          </div>
        );
      })}

      {/* FLOATING RAINBOW PROGRESS BAR */}
      <div className="fixed bottom-6 right-6 z-[9998] w-[min(960px,calc(100vw-40px))] rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.24)]">
        <RainbowBar
          value={progressPercent}
          heightPx={12}
          labelLeft="Section progress"
          labelRight={`${progressPercent}%`}
        />
      </div>
    </div>
  );
}