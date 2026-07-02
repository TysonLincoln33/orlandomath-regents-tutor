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

  return (
    <main
      ref={containerRef}
      className="chapter-print-content section-print-content mx-auto max-w-5xl px-4 py-8 space-y-8"
      data-print-layout={printLayout}
    >
      <div className="section-print-toolbar no-print rounded-xl border border-slate-200 bg-white p-4 shadow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Print Chapter</p>
            <p className="mt-1 text-sm text-gray-700">Choose a worksheet layout, then print the full chapter.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1" aria-label="Print layout">
              <button type="button" onClick={() => setPrintLayout("single")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${printLayout === "single" ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-white"}`}>Single Column</button>
              <button type="button" onClick={() => setPrintLayout("double")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${printLayout === "double" ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-white"}`}>Double Column</button>
            </div>
            <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Print Chapter</button>
          </div>
        </div>
      </div>

      <header className="chapter-print-title rounded-2xl bg-white p-8 shadow">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{data.chapterId}</p>
        <h1 className="mt-2 text-4xl font-bold text-gray-950">{data.chapterTitle}</h1>
      </header>

      {data.sections.map((section) => (
        <PrintableSectionContent key={section.sectionId} data={section} showSectionTitle />
      ))}
    </main>
  );
}
