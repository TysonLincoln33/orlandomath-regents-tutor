"use client";

import Link from "next/link";
import RainbowBar from "@/components/progress/RainbowBar";
import type { Section } from "@/lib/course/algebra1";
import { useEffect, useState } from "react";
import { getSectionStatus } from "@/lib/progressLocal";
import { resetSectionProgress } from "@/lib/sectionProgressLocal";
import { RT_PROGRESS_UPDATED_EVENT } from "@/lib/progress/events";
import { getSectionPercent } from "@/lib/sectionProgressLocal";

type Props = {
  section: Section;
};

export default function SectionRow({ section }: Props) {
  const [status, setStatus] = useState<"not_started" | "in_progress" | "complete">("not_started");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setStatus(getSectionStatus(section.id));
      setPct(getSectionPercent(section.id));
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(RT_PROGRESS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(RT_PROGRESS_UPDATED_EVENT, refresh);
    };
  }, [section.id]);

  const pillClass = (target: typeof status) =>
    target === status
      ? "border-blue-500 bg-blue-600 text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]"
      : "border-white/15 bg-white/5 text-slate-200";

  const badgeClass =
    status === "complete"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : status === "in_progress"
        ? "border-blue-400/25 bg-blue-400/10 text-blue-200"
        : "border-white/15 bg-white/5 text-slate-200";

  const onReset = () => {
    resetSectionProgress(section.id);
    setStatus("not_started");
    setPct(0);
  };

  return (
    <div className="w-full rounded-[24px] border border-white/20 bg-[rgba(10,12,35,0.56)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.34),0_0_18px_rgba(108,72,255,0.12)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 w-full flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/section/${section.id}`}
              className="text-2xl font-bold tracking-tight text-white hover:underline"
            >
              {section.title}
            </Link>

            <span className={`rounded-full border px-3 py-1 text-sm capitalize ${badgeClass}`}>
              {status.replace("_", " ")}
            </span>
          </div>

          {section.standardCode ? (
            <div className="mt-2 text-slate-200">Standard: {section.standardCode}</div>
          ) : null}

          <div className="mt-4 w-full">
            <RainbowBar
              value={pct}
              heightPx={12}
              labelLeft="Section Progress"
              labelRight={`${pct}%`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <div className="mr-1 text-sm font-medium uppercase tracking-[0.12em] text-slate-200">
            Status
          </div>

          <div
            className={`rounded-xl border px-4 py-2 text-sm transition pointer-events-none select-none cursor-default ${pillClass("not_started")}`}
            aria-hidden="true"
          >
            Not started
          </div>
          <div
            className={`rounded-xl border px-4 py-2 text-sm transition pointer-events-none select-none cursor-default ${pillClass("in_progress")}`}
            aria-hidden="true"
          >
            In progress
          </div>
          <div
            className={`rounded-xl border px-4 py-2 text-sm transition pointer-events-none select-none cursor-default ${pillClass("complete")}`}
            aria-hidden="true"
          >
            Complete
          </div>

          <button
            type="button"
            onClick={onReset}
            className="ml-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-100"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
