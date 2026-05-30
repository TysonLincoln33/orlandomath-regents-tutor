"use client";

import * as React from "react";
import Link from "next/link";
import { SECTIONS } from "@/lib/course/algebra1";
import {
  getStudentActiveAssignments,
  type StudentActiveAssignment,
  type StudentClassAssignments,
} from "@/lib/assignments/getStudentActiveAssignments";
import { RT_PROGRESS_UPDATED_EVENT } from "@/lib/progress/events";

const sectionLabels = new Map(
  SECTIONS.map((section) => [
    section.id,
    `Chapter ${section.chapterNumber}, Section ${section.sectionNumber}: ${section.title}`,
  ]),
);

function formatDueDate(value: string | null): string {
  if (!value) return "No due date";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatStatus(status: StudentActiveAssignment["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getSectionLabel(sectionId: string | null): string {
  if (!sectionId) return "No section selected";
  return sectionLabels.get(sectionId) ?? sectionId;
}

function StudentAssignmentCard({
  assignment,
}: {
  assignment: StudentActiveAssignment;
}) {
  const progressLabel =
    assignment.completionPercent === null
      ? "No progress yet"
      : `${assignment.completionPercent}% complete`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{assignment.title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {assignment.description || "No description provided."}
          </p>
        </div>
        <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
          {formatStatus(assignment.status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-950">Section</dt>
          <dd>{getSectionLabel(assignment.sectionId)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">Due date</dt>
          <dd>{formatDueDate(assignment.dueDate)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-950">Progress</dt>
          <dd>{progressLabel}</dd>
        </div>
      </dl>

      <div className="mt-4">
        {assignment.sectionId ? (
          <Link
            href={`/section/${assignment.sectionId}`}
            className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Go to Section
          </Link>
        ) : (
          <span className="text-sm font-semibold text-slate-500">
            Section link unavailable
          </span>
        )}
      </div>
    </article>
  );
}

function StudentClassCard({ classGroup }: { classGroup: StudentClassAssignments }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">
            {classGroup.classroomName}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {classGroup.teacherName || classGroup.teacherEmail ? (
              <>
                Teacher: {[classGroup.teacherName, classGroup.teacherEmail]
                  .filter(Boolean)
                  .join(" · ")}
              </>
            ) : (
              "Teacher information unavailable"
            )}
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-800 shadow-sm">
          {classGroup.activeAssignmentCount} active{" "}
          {classGroup.activeAssignmentCount === 1 ? "assignment" : "assignments"}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {classGroup.assignments.length > 0 ? (
          classGroup.assignments.map((assignment) => (
            <StudentAssignmentCard
              key={assignment.assignmentId}
              assignment={assignment}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
            You do not have any active assignments for this class right now.
          </div>
        )}
      </div>
    </section>
  );
}

export default function MyClassesPage() {
  const [classesLoading, setClassesLoading] = React.useState(true);
  const [classesError, setClassesError] = React.useState<string | null>(null);
  const [studentClasses, setStudentClasses] = React.useState<
    StudentClassAssignments[]
  >([]);

  React.useEffect(() => {
    let cancelled = false;

    const refreshClasses = async () => {
      try {
        setClassesError(null);
        const next = await getStudentActiveAssignments();
        if (!cancelled) {
          setStudentClasses(next);
        }
      } catch (error) {
        console.error("[MyClassesPage] failed to load student classes:", error);
        if (!cancelled) {
          setClassesError(
            error instanceof Error ? error.message : "Failed to load your classes.",
          );
          setStudentClasses([]);
        }
      } finally {
        if (!cancelled) {
          setClassesLoading(false);
        }
      }
    };

    refreshClasses();

    const handleRefresh = () => {
      void refreshClasses();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener(RT_PROGRESS_UPDATED_EVENT, handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener(RT_PROGRESS_UPDATED_EVENT, handleRefresh);
    };
  }, []);

  const totalActiveAssignments = studentClasses.reduce(
    (total, classGroup) => total + classGroup.activeAssignmentCount,
    0,
  );

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-6 md:py-10">
        <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-xl backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
                Student assignments
              </p>
              <h1 className="mt-1 text-3xl font-extrabold text-slate-950">
                My Classes
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                View assignments organized by class, then jump directly into the assigned section.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex w-fit items-center rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              Back to Dashboard
            </Link>
          </div>

          <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">
            {classesLoading
              ? "Loading your classes and assignments..."
              : `${studentClasses.length} ${studentClasses.length === 1 ? "class" : "classes"} · ${totalActiveAssignments} active ${totalActiveAssignments === 1 ? "assignment" : "assignments"}`}
          </div>

          {classesError && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              {classesError}
            </div>
          )}

          {!classesLoading && !classesError && studentClasses.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-700">
              You are not enrolled in any classes yet. Join a class to see your assignments here.
            </div>
          )}

          {!classesLoading && !classesError && studentClasses.length > 0 && (
            <div className="mt-5 space-y-5">
              {studentClasses.map((classGroup) => (
                <StudentClassCard
                  key={classGroup.classroomId}
                  classGroup={classGroup}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
