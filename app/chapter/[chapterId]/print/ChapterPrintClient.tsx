"use client";

import { useEffect, useRef, useState } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

import PrintableSectionContent, { type PrintableSectionData } from "@/components/print/PrintableSectionContent";

type ChapterPrintData = {
  chapterId: string;
  chapterTitle: string;
  sections: PrintableSectionData[];
};

export default function ChapterPrintClient({ data }: { data: ChapterPrintData }) {
  const [printLayout, setPrintLayout] = useState<"single" | "double">("single");
  const [printMode, setPrintMode] = useState<"student" | "answerKey">("student");
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [data]);

  const printWithSettings = (mode: "student" | "answerKey", layout: "single" | "double") => {
    setPrintMode(mode);
    setPrintLayout(mode === "answerKey" ? "single" : layout);
    setIsPrintMenuOpen(false);

    window.requestAnimationFrame(() => {
      window.print();
    });
  };

  return (
    <main
      ref={containerRef}
      className="chapter-print-content section-print-content mx-auto max-w-5xl px-4 py-8 space-y-8"
      data-print-layout={printLayout}
      data-print-mode={printMode}
    >
      <div className="section-print-toolbar no-print flex justify-end">
        <div className="relative">
          <button type="button" onClick={() => setIsPrintMenuOpen((open) => !open)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700" aria-expanded={isPrintMenuOpen}>Print ▼</button>

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

      <header className="chapter-print-title rounded-2xl bg-white p-8 shadow">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{data.chapterId}</p>
        <h1 className="mt-2 text-4xl font-bold text-gray-950">{data.chapterTitle}</h1>
      </header>

      {data.sections.map((section) => (
        <PrintableSectionContent key={section.sectionId} data={section} showSectionTitle printMode={printMode} />
      ))}
    </main>
  );
}
