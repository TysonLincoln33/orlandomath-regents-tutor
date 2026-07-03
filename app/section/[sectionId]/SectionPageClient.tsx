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
  const [printMode, setPrintMode] = useState<"student" | "answerKey">("student");
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);

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

  const printWithSettings = (mode: "student" | "answerKey", layout: "single" | "double") => {
    setPrintMode(mode);
    setPrintLayout(mode === "answerKey" ? "single" : layout);
    setIsPrintMenuOpen(false);

    window.requestAnimationFrame(() => {
      window.print();
    });
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
      data-print-mode={printMode}
    >
      <div className="section-print-toolbar no-print flex justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPrintMenuOpen((open) => !open)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            aria-expanded={isPrintMenuOpen}
          >
            Print ▼
          </button>

          {isPrintMenuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-xl">
              <div className="border-b border-slate-200 pb-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Student Worksheet</p>
                <button type="button" onClick={() => printWithSettings("student", "single")} className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100">Single Column</button>
                <button type="button" onClick={() => printWithSettings("student", "double")} className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100">Double Column</button>
              </div>

              <div className="pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Answer Key</p>
                <button type="button" onClick={() => printWithSettings("answerKey", "single")} className="block w-full rounded-md px-3 py-2 text-left font-medium hover:bg-slate-100">Print Answer Key</button>
              </div>
            </div>
          ) : null}
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
        printMode={printMode}
        interactive
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
