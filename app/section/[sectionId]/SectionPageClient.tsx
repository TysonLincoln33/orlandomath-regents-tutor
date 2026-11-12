"use client";

import { useEffect, useRef, useState } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCourseForSection } from "@/lib/course/registry";
import { gradeQuestion, serializeAnswer, type QuestionAnswer } from "@/lib/questionBank";
import RainbowBar from "@/components/progress/RainbowBar";
import PrintableAnswerKey from "@/components/print/PrintableAnswerKey";
import PrintableSectionContent, {
  type PrintableQuestion,
} from "@/components/print/PrintableSectionContent";
import { useCanUsePrintControls } from "@/lib/auth/usePrintControls";
import { recordQuestionAttempt } from "@/lib/progress/attemptTracking";
import { emitProgressUpdated } from "@/lib/progress/events";
import {
  ensureSectionProgress,
  setProgressOwner,
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
  lesson?: {
    title: string;
    intro: string[];
  };
  workedExample?: WorkedExample;
  questions: Question[];
};

export default function SectionPageClient({ data }: { data: SectionData }) {
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer | null>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const pending = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [incorrect, setIncorrect] = useState<Record<string, boolean>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [progressPercent, setProgressPercent] = useState(0);
  const [printLayout, setPrintLayout] = useState<"single" | "double">("single");
  const [printMode, setPrintMode] = useState<"worksheet" | "answer-key">(
    "worksheet",
  );
  const canPrint = useCanUsePrintControls();

  const containerRef = useRef<HTMLDivElement>(null);

  const totalQuestions = data.questions.length;
  const sectionId = data.sectionId;
  const course = getCourseForSection(sectionId);

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
    let active = true;
    const supabase = getSupabaseBrowserClient();
    async function restore() {
      setReady(false);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError && authError.name !== "AuthSessionMissingError") {
        setFeedback({ restore: "Could not load account progress. Please refresh when your connection returns." });
        return;
      }
      setProgressOwner(user?.id ?? null);
      const saved = ensureSectionProgress(sectionId, totalQuestions);
      const savedMastery = Object.fromEntries(Object.entries(saved.byQuestionId).map(([id, value]) => [id, value.correct]));
      const savedAnswers = Object.fromEntries(Object.entries(saved.byQuestionId).map(([id, value]) => [id, value.lastAnswer ?? value.lastAnswerIndex ?? null]));
      if (user && course.id === "geometry") {
        const { data: attempts, error } = await supabase.from("question_attempts")
          .select("question_id, selected_answer, correct, attempted_at")
          .eq("user_id", user.id).eq("course_id", course.id).eq("section_id", sectionId)
          .eq("correct", true).order("attempted_at", { ascending: false }).limit(1000);
        if (!active) return;
        if (error) setFeedback({ restore: "Showing saved device progress. Account progress could not be loaded." });
        for (const attempt of (attempts ?? []) as Array<{question_id:string; selected_answer:string | null}>) {
          const q = data.questions.find(q => q.id === attempt.question_id);
          if (!q || savedMastery[q.id]) continue;
          try {
            const answer = JSON.parse(attempt.selected_answer ?? "null") as QuestionAnswer;
            if (!gradeQuestion(q, answer).correct) continue;
            savedMastery[q.id] = true; savedAnswers[q.id] = answer;
            recordLocalAttempt({sectionId, questionId:q.id, isCorrect:true, answer, totalQuestions});
          } catch { /* A legacy answer must not award unverified mastery. */ }
        }
      }
      if (!active) return;
      setMastered(savedMastery); setAnswers(savedAnswers);
      setProgressPercent(getSectionPercent(sectionId, totalQuestions)); setReady(true);
    }
    void restore();
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") window.setTimeout(() => { if(active) void restore(); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [sectionId, totalQuestions, data.questions, course.id]);

  const refreshProgress = () => {
    setProgressPercent(getSectionPercent(sectionId, totalQuestions));
  };

  const handleSelect = (questionId: string, choiceIndex: QuestionAnswer) => {
    setFeedback(prev => ({ ...prev, [questionId]: "" }));
    setAnswers((prev) => ({
      ...prev,
      [questionId]: choiceIndex,
    }));

    setIncorrect((prev) => ({
      ...prev,
      [questionId]: false,
    }));
  };

  const printWorksheet = () => {
    setPrintMode("worksheet");
    window.requestAnimationFrame(() => window.print());
  };

  const printAnswerKey = () => {
    setPrintMode("answer-key");
    window.requestAnimationFrame(() => window.print());
  };

  const handleCheck = async (question: Question) => {
    const selected = answers[question.id];

    if (!ready || pending.current.has(question.id)) return;
    if (mastered[question.id] && !feedback[question.id]?.includes("sync failed")) return;
    const result = gradeQuestion(question, selected);
    if (!result.complete || selected === undefined || selected === null) {
      setFeedback(prev => ({...prev, [question.id]: question.type === "proof_dropdown" ? "Complete every dropdown before checking the proof." : "Select an answer before checking."}));
      return;
    }
    pending.current.add(question.id);
    setFeedback(prev => ({...prev, [question.id]: question.type === "proof_dropdown" ? `${result.correctCells} of ${result.total} selections correct.` : ""}));
    const isCorrect = result.correct;
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

      if (!wasMastered) {
        recordLocalAttempt({
          sectionId,
          questionId: question.id,
          isCorrect,
          answerIndex: typeof selected === "number" ? selected : undefined,
          answer: selected,
          totalQuestions,
        });

        refreshProgress();
      }

      await recordQuestionAttempt({
        courseId: course.id,
        chapterId,
        sectionId,
        questionId: question.id,
        selectedAnswer: serializeAnswer(selected),
        correct: isCorrect,
        sectionTotalQuestions: totalQuestions,
      });

      emitProgressUpdated();
    } catch (err) {
      console.error("Attempt/progress autosave error:", err);
      setFeedback(prev => ({...prev, [question.id]: "Saved on this device. Account sync failed; please check your connection and try again."}));
    } finally { pending.current.delete(question.id); }
  };

  return (
    <div
      ref={containerRef}
      className="section-print-content max-w-4xl mx-auto px-4 py-8 pb-32 space-y-8"
      data-print-layout={printLayout}
      data-print-mode={printMode}
    >
      <div className="no-print flex flex-wrap items-center justify-between gap-3 text-white"><Link href={`/chapter/${sectionId.split("_")[0]}`} className="font-semibold hover:underline">← {course.title} chapter</Link><Link href={course.dashboardPath} className="hover:underline">{course.title} dashboard</Link></div>
      {canPrint ? (
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

              <button
                type="button"
                onClick={printWorksheet}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Print Section
              </button>
              <button
                type="button"
                onClick={printAnswerKey}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Print Answer Key
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedback.restore && <p role="status" className="no-print rounded-xl bg-amber-50 p-4 text-amber-900">{feedback.restore}</p>}
      {!ready && <p role="status" className="no-print text-white">Loading saved progress…</p>}
      <div className="worksheet-print-area" aria-busy={!ready}>
        <PrintableSectionContent
          data={data}
          showSectionTitle
          sectionHeaderPrintOnly
          answers={answers}
          feedback={feedback}
          mastered={mastered}
          incorrect={incorrect}
          onSelect={handleSelect}
          onCheck={handleCheck}
          showHint={showHint}
          interactive
        />
      </div>

      {canPrint && <PrintableAnswerKey sections={[data]} />}

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
