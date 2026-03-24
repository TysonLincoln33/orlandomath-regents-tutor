"use client";

import Link from "next/link";
import RainbowBar from "@/components/progress/RainbowBar";
import { Chapter } from "@/lib/course/algebra1";

type Props = {
  chapter: Chapter;
  variant?: "normal" | "wide";
  completion?: number;
};

export default function ChapterCard({
  chapter,
  variant = "normal",
  completion = 0,
}: Props) {
  const roundedCompletion = Math.round(completion);

  return (
    <Link
      href={`/chapter/${chapter.id}`}
      className={[
        "group block h-full rounded-[26px] border border-white/20 bg-[rgba(10,12,35,0.58)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.38),0_0_18px_rgba(108,72,255,0.14)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_28px_60px_rgba(0,0,0,0.48),0_0_24px_rgba(108,72,255,0.2)]",
        variant === "wide" ? "md:col-span-2" : "",
      ].join(" ")}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-[0.14em] uppercase text-slate-300/90">
              Chapter {chapter.number}
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
              {chapter.title}
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/15 bg-[rgba(15,18,50,0.72)] px-4 py-3 text-center shadow-[0_0_18px_rgba(108,72,255,0.22)]">
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-300">
              of exam
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {chapter.percent.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm leading-7 text-slate-300">
          {chapter.dashboardBlurb}
        </div>

        <div className="mt-5">
          <RainbowBar
            value={roundedCompletion}
            heightPx={12}
            labelLeft="Chapter Progress"
            labelRight={`${roundedCompletion}%`}
          />
        </div>

        <div className="mt-auto flex items-center justify-between pt-5 text-sm">
          <span className="inline-flex items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300/70 shadow-[0_0_10px_rgba(103,232,249,0.75)] transition group-hover:bg-cyan-200" />
            Open chapter
          </span>
          <span className="font-semibold text-white/90 transition group-hover:text-white">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}