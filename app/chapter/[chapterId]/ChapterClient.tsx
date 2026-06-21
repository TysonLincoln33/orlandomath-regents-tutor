"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import RainbowBar from "@/components/progress/RainbowBar";
import SectionRow from "@/components/course/SectionRow";

import { CHAPTERS, SECTIONS, type Section } from "@/lib/course/algebra1";
import { getAveragePercent } from "@/lib/sectionProgressLocal";
import { RT_PROGRESS_UPDATED_EVENT } from "@/lib/progress/events";

type Props = { chapterId: string };

export default function ChapterClient({ chapterId }: Props) {
  const chapter = useMemo(() => CHAPTERS.find((c) => c.id === chapterId), [chapterId]);

  const sections: Section[] = useMemo(() => {
    if (!chapter) return [];
    return SECTIONS.filter((s) => s.chapterId === chapter.id);
  }, [chapter]);

  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [overallPercent, setOverallPercent] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setCompletionPercent(getAveragePercent(sectionIds));
      setOverallPercent(getAveragePercent(SECTIONS.map((section) => section.id)));
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(RT_PROGRESS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(RT_PROGRESS_UPDATED_EVENT, refresh);
    };
  }, [sectionIds]);

  if (!chapter) {
    return (
      <main className="min-h-screen bg-transparent px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Chapter not found</h1>
        <p className="mt-2 text-sm text-slate-600">This chapter ID does not exist.</p>
        <div className="mt-6">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Return to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">
            ← Return to dashboard
          </Link>
          <div className="text-sm text-slate-600">
            Overall progress: <span className="font-semibold text-slate-900">{overallPercent}%</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/20 bg-[rgba(10,12,35,0.55)] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.55),0_0_25px_rgba(108,72,255,0.25)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide text-slate-200">
                Chapter {chapter.number} • {chapter.percent.toFixed(1)}% of exam
              </div>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">{chapter.title}</h1>
              {chapter.dashboardBlurb ? (
                <p className="mt-3 max-w-2xl text-slate-200">{chapter.dashboardBlurb}</p>
              ) : null}
            </div>

            <div className="shrink-0 rounded-2xl border border-white/20 bg-[rgba(15,18,50,0.75)] px-6 py-4 text-center shadow-[0_0_18px_rgba(108,72,255,0.35)]">
              <div className="text-xs tracking-widest text-slate-200">PROGRESS</div>
              <div className="text-3xl font-bold text-white">{completionPercent}%</div>
            </div>
          </div>

          <div className="mt-8">
            <RainbowBar
              value={completionPercent}
              heightPx={16}
              labelLeft="Chapter Progress"
              labelRight={`${completionPercent}%`}
            />
          </div>
        </div>

        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <SectionRow key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
