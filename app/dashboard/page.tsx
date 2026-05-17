"use client";

import * as React from "react";
import Link from "next/link";
import RainbowBar from "@/components/progress/RainbowBar";
import ChapterCard from "@/components/course/ChapterCard";
import { getChapters } from "@/lib/course/algebra1";
import {
  buildEmptyCourseDashboardProgress,
  fetchCourseDashboardProgress,
} from "@/lib/progress/dashboardProgress";
import { RT_PROGRESS_UPDATED_EVENT } from "@/lib/progress/events";
import {
  getStudentActiveAssignments,
  type StudentActiveAssignment,
  type StudentAssignmentStatus,
} from "@/lib/assignments/getStudentActiveAssignments";

function formatDueDate(value: string | null): string {
  if (!value) return "No due date";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadgeClass(status: StudentAssignmentStatus) {
  if (status === "completed") {
    return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  }

  if (status === "excused") {
    return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  }

  return "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";
}

function formatStatus(status: StudentAssignmentStatus) {
  return status.replace("_", " ");
}

function ActiveAssignmentsPanel({
  assignments,
  loading,
}: {
  assignments: StudentActiveAssignment[];
  loading: boolean;
}) {
  return (
    <section className="mt-10 rounded-[30px] border border-white/20 bg-[rgba(10,12,35,0.58)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.34),0_0_18px_rgba(108,72,255,0.12)] backdrop-blur-xl md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">
            For you
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Active Assignments
          </h2>
        </div>
        <div className="text-sm font-medium text-slate-300">
          {loading ? "Loading..." : `${assignments.length} active`}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-slate-300">
          Loading active assignments...
        </div>
      ) : assignments.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-slate-300">
          No active assignments.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {assignments.map((assignment) => (
            <article
              key={assignment.assignmentId}
              className="rounded-[24px] border border-white/15 bg-[rgba(15,18,50,0.72)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold tracking-tight text-white">
                    {assignment.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-300">
                    {assignment.sectionLabel}
                  </p>
                </div>

                <span
                  className={[
                    "inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]",
                    getStatusBadgeClass(assignment.status),
                  ].join(" ")}
                >
                  {formatStatus(assignment.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span>Due {formatDueDate(assignment.dueDate)}</span>
                <span className="h-1 w-1 rounded-full bg-slate-500" />
                <span>{assignment.completionPercent}% complete</span>
              </div>

              {assignment.description ? (
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {assignment.description}
                </p>
              ) : null}

              <div className="mt-5">
                {assignment.sectionId ? (
                  <Link
                    href={`/section/${assignment.sectionId}`}
                    className="inline-flex items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15"
                  >
                    Go to Section →
                  </Link>
                ) : (
                  <span className="text-sm text-slate-400">No section link</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const chapters = React.useMemo(() => getChapters(), []);
  const [summary, setSummary] = React.useState(() =>
    buildEmptyCourseDashboardProgress("algebra1")
  );
  const [loading, setLoading] = React.useState(true);
  const [assignments, setAssignments] = React.useState<StudentActiveAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = React.useState(true);
  const [resumeNotice, setResumeNotice] = React.useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      setLoading(true);
      setAssignmentsLoading(true);

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

      try {
        const nextAssignments = await getStudentActiveAssignments();
        if (!cancelled) {
          setAssignments(nextAssignments);
        }
      } catch (error) {
        console.error("[DashboardPage] failed to load active assignments:", error);
        if (!cancelled) {
          setAssignments([]);
        }
      } finally {
        if (!cancelled) {
          setAssignmentsLoading(false);
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

        <ActiveAssignmentsPanel
          assignments={assignments}
          loading={assignmentsLoading}
        />

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