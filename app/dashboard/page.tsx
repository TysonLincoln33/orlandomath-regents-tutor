"use client";

import * as React from "react";
import RainbowBar from "@/components/progress/RainbowBar";
import ChapterCard from "@/components/course/ChapterCard";
import { getChapters } from "@/lib/course/algebra1";
import {
  buildEmptyCourseDashboardProgress,
  fetchCourseDashboardProgress,
} from "@/lib/progress/dashboardProgress";
import { RT_PROGRESS_UPDATED_EVENT } from "@/lib/progress/events";

export default function DashboardPage() {
  const chapters = React.useMemo(() => getChapters(), []);
  const [summary, setSummary] = React.useState(() =>
    buildEmptyCourseDashboardProgress("algebra1")
  );
  const [loading, setLoading] = React.useState(true);
  const [resumeNotice, setResumeNotice] = React.useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const next = await fetchCourseDashboardProgress("algebra1");
        if (!cancelled) {
          setSummary(next);
        }
      } catch (error) {
        console.error("[DashboardPage] failed to load dashboard progress:", error);
        if (!cancelled) {
          setSummary(buildEmptyCourseDashboardProgress("algebra1"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    refresh();

    try {
      const raw = window.localStorage.getItem("rt_resume_notice");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.message) {
          setResumeNotice({
            message: String(parsed.message),
            type: parsed.type || "info",
          });
        }
        window.localStorage.removeItem("rt_resume_notice");
      }
    } catch {
      // ignore
    }

    const handleFocus = () => {
      void refresh();
    };

    const handleProgressUpdated = () => {
      void refresh();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(RT_PROGRESS_UPDATED_EVENT, handleProgressUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(RT_PROGRESS_UPDATED_EVENT, handleProgressUpdated);
    };
  }, []);

  const pctLabel = `${Math.round(summary.overallCompletionPercent)}%`;

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-6 md:py-10">
        <div className="dashboard-hero-wrap">
          <div className="dashboard-banner-shell">
            <img
              src="/dashboard/algebra1-course-dashboard-banner.png"
              alt="Algebra 1 Course Dashboard"
              className="dashboard-banner-image"
            />
          </div>

          <div className="dashboard-live-progress">
            {resumeNotice && (
              <div
                className={[
                  "mt-4 rounded-2xl border p-4 text-sm",
                  resumeNotice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : resumeNotice.type === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-900"
                      : "border-slate-200 bg-slate-50 text-slate-800",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>{resumeNotice.message}</div>
                  <button
                    type="button"
                    onClick={() => setResumeNotice(null)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold hover:bg-black/5"
                    aria-label="Dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className="mt-1">
              <div className="mb-3 flex items-center justify-between text-base font-semibold text-white/90">
                <span>Overall progress</span>
                <span className="dashboard-progress-percent">
                  {loading ? "Loading..." : pctLabel}
                </span>
              </div>
              <RainbowBar
                value={summary.overallCompletionPercent}
                heightPx={18}
                className="dashboard-progress"
              />
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {chapters.map((chapter) => {
            const chapterProgress =
              summary.chapters.find((item) => item.id === chapter.id)?.completionPercent ?? 0;

            return (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                completion={chapterProgress}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}