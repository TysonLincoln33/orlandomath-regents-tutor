"use client";

import { useEffect, useRef, useState } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

import RainbowBar from "@/components/progress/RainbowBar";
import PrintableSectionContent, { type PrintableQuestion } from "@/components/print/PrintableSectionContent";
import { recordQuestionAttempt } from "@/lib/progress/attemptTracking";
import { emitProgressUpdated } from "@/lib/progress/events";
import {
  ensureSectionProgress,
  getSectionPercent,
  recordAttempt as recordLocalAttempt,
} from "@/lib/sectionProgressLocal";

type Question = PrintableQuestion;

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

export default function SectionPageClient({ data }: { data: SectionData }) {
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [incorrect, setIncorrect] = useState<Record<string, boolean>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [progressPercent, setProgressPercent] = useState(0);
  const [printLayout, setPrintLayout] = useState<"single" | "double">("single");
  const [printVariant, setPrintVariant] = useState<"student" | "answerKey">("student");

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
      className="section-print-content max-w-4xl mx-auto px-4 py-8 pb-32 space-y-8"
      data-print-layout={printLayout}
    >
      <div className="section-print-toolbar no-print rounded-xl border border-slate-200 bg-white p-4 shadow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Print Section
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Choose a worksheet layout, then print this section.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1"
              aria-label="Print layout"
            >
              <button
                type="button"
                onClick={() => setPrintLayout("single")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  printLayout === "single"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-700 hover:bg-white"
                }`}
              >
                Single Column
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout("double")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  printLayout === "double"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-700 hover:bg-white"
                }`}
              >
                Double Column
              </button>
            </div>

            <div
              className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1"
              aria-label="Print version"
            >
              <button
                type="button"
                onClick={() => setPrintVariant("student")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  printVariant === "student"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-700 hover:bg-white"
                }`}
              >
                Student Version
              </button>
              <button
                type="button"
                onClick={() => setPrintVariant("answerKey")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  printVariant === "answerKey"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-700 hover:bg-white"
                }`}
              >
                Answer Key
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Print Section
            </button>
          </div>
        </div>
      </div>

      <PrintableSectionContent
        data={data}
        answers={answers}
        mastered={mastered}
        incorrect={incorrect}
        onSelect={handleSelect}
        onCheck={handleCheck}
        showHint={showHint}
        interactive
        printVariant={printVariant}
      />

      {/* FLOATING RAINBOW PROGRESS BAR */}
      <div className="section-print-progress-meter no-print fixed bottom-6 right-6 z-[9998] w-[min(960px,calc(100vw-40px))] rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.24)]">
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
