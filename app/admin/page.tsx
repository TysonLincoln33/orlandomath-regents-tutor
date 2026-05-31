"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAdminOrgDashboard,
  type AdminDashboardAccessError,
  type AdminDashboardActivity,
  type AdminDashboardAssignment,
  type AdminDashboardClassroom,
  type AdminDashboardStudent,
  type AdminDashboardStudentDetail,
  type AdminDashboardTeacher,
  type AdminOrgDashboard,
} from "@/lib/admin/orgDashboard";

type DashboardState =
  | { status: "loading" }
  | { status: "allowed"; dashboard: AdminOrgDashboard }
  | { status: "pending"; profile: NonNullable<AdminDashboardAccessError["profile"]> }
  | { status: "denied"; message: string };

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value}%` : "No data";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No activity date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function displayName(entity: { fullName?: string | null; email?: string | null }) {
  return entity.fullName?.trim() || entity.email?.trim() || "Unnamed user";
}

function DashboardCard({ label, value, help }: { label: string; value: string | number; help?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
      {help ? <p className="mt-2 text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

function EmptyTableMessage({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{children}</p>;
}

function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-extrabold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TeachersTable({ teachers }: { teachers: AdminDashboardTeacher[] }) {
  if (teachers.length === 0) return <EmptyTableMessage>No Regents Algebra 1 teachers found for this administrator scope.</EmptyTableMessage>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Classrooms</th><th className="px-4 py-3">Students</th><th className="px-4 py-3">Assignments</th><th className="px-4 py-3">Avg. completion</th><th className="px-4 py-3">Avg. accuracy</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {teachers.map((teacher) => <tr key={teacher.id}><td className="px-4 py-3"><p className="font-semibold text-slate-950">{displayName(teacher)}</p><p className="text-xs text-slate-500">{teacher.email ?? "No email"}</p></td><td className="px-4 py-3">{teacher.classroomCount}</td><td className="px-4 py-3">{teacher.studentCount}</td><td className="px-4 py-3">{teacher.assignmentCount}</td><td className="px-4 py-3">{formatPercent(teacher.averageCompletion)}</td><td className="px-4 py-3">{formatPercent(teacher.averageAccuracy)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function StudentsTable({ students, selectedStudentId, onSelectStudent }: { students: AdminDashboardStudent[]; selectedStudentId: string | null; onSelectStudent: (studentId: string) => void }) {
  if (students.length === 0) return <EmptyTableMessage>No Regents Algebra 1 students found for this administrator scope.</EmptyTableMessage>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Classrooms</th><th className="px-4 py-3">Assigned work</th><th className="px-4 py-3">Completion</th><th className="px-4 py-3">Accuracy</th><th className="px-4 py-3">Last activity</th><th className="px-4 py-3">Details</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {students.map((student) => (
            <tr key={student.id} className={selectedStudentId === student.id ? "bg-blue-50" : undefined}>
              <td className="px-4 py-3"><p className="font-semibold text-slate-950">{displayName(student)}</p><p className="text-xs text-slate-500">{student.email ?? "No email"}</p></td>
              <td className="px-4 py-3">{student.classroomCount}</td><td className="px-4 py-3">{student.assignedWorkCount}</td><td className="px-4 py-3">{formatPercent(student.completionPercent)}</td><td className="px-4 py-3">{formatPercent(student.accuracyPercent)}</td><td className="px-4 py-3">{formatDateTime(student.lastActivityAt)}</td><td className="px-4 py-3"><button type="button" onClick={() => onSelectStudent(student.id)} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700">Details</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassroomsTable({ classrooms }: { classrooms: AdminDashboardClassroom[] }) {
  if (classrooms.length === 0) return <EmptyTableMessage>No Regents Algebra 1 classrooms found for this administrator scope.</EmptyTableMessage>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-3">Classroom</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Students</th><th className="px-4 py-3">Assignments</th><th className="px-4 py-3">Avg. completion</th><th className="px-4 py-3">Avg. accuracy</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {classrooms.map((classroom) => <tr key={classroom.id}><td className="px-4 py-3 font-semibold text-slate-950">{classroom.name}</td><td className="px-4 py-3"><p>{classroom.teacherName || classroom.teacherEmail || "Unknown teacher"}</p><p className="text-xs text-slate-500">{classroom.teacherEmail ?? "No email"}</p></td><td className="px-4 py-3">{classroom.studentCount}</td><td className="px-4 py-3">{classroom.assignmentCount}</td><td className="px-4 py-3">{formatPercent(classroom.averageCompletion)}</td><td className="px-4 py-3">{formatPercent(classroom.averageAccuracy)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentsTable({ assignments }: { assignments: AdminDashboardAssignment[] }) {
  if (assignments.length === 0) return <EmptyTableMessage>No Regents Algebra 1 assignments found for this administrator scope.</EmptyTableMessage>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Classroom</th><th className="px-4 py-3">Sections</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Recipients</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Avg. progress</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {assignments.map((assignment) => <tr key={assignment.id}><td className="px-4 py-3"><p className="font-semibold text-slate-950">{assignment.title}</p><p className="text-xs text-slate-500">{assignment.description || "No description"}</p><p className="text-xs text-slate-500">{assignment.archivedAt ? "Archived" : "Active"}</p></td><td className="px-4 py-3">{assignment.teacherName || assignment.teacherEmail || "Unknown"}</td><td className="px-4 py-3">{assignment.classroomName ?? "Unknown"}</td><td className="px-4 py-3">{assignment.sectionCount} {assignment.sectionCount === 1 ? "section" : "sections"}</td><td className="px-4 py-3">{formatDate(assignment.dueDate)}</td><td className="px-4 py-3">{assignment.recipientCount}</td><td className="px-4 py-3">{assignment.completedCount} complete · {assignment.incompleteCount} incomplete · {assignment.excusedCount} excused</td><td className="px-4 py-3">{formatPercent(assignment.averageProgress)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function getActivityClassName(activity: AdminDashboardActivity) {
  if (activity.type === "attempt") {
    return activity.correct
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-rose-200 bg-rose-50 text-rose-950";
  }

  if (activity.type === "progress") {
    return "border-blue-200 bg-blue-50 text-blue-950";
  }

  return "border-slate-200 bg-slate-50 text-slate-950";
}

function ActivityList({ activities, showStudent = false }: { activities: AdminDashboardActivity[]; showStudent?: boolean }) {
  if (activities.length === 0) {
    return <p className="mt-2 text-sm text-slate-600">No recent activity found.</p>;
  }

  return (
    <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-2 text-sm">
      {activities.map((activity, index) => (
        <li key={`${activity.type}-${activity.studentId ?? "student"}-${activity.label}-${activity.occurredAt ?? index}`} className={`rounded-xl border p-3 ${getActivityClassName(activity)}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              {showStudent ? <p className="text-xs font-bold uppercase tracking-wide opacity-70">{activity.studentName || activity.studentEmail || "Student"}</p> : null}
              <p className="font-semibold">{activity.label}</p>
            </div>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">{activity.type}</span>
          </div>
          <p className="mt-1">{activity.detail}</p>
          <p className="mt-1 text-xs opacity-70">{formatDateTime(activity.occurredAt)}</p>
        </li>
      ))}
    </ul>
  );
}

function AttemptsList({ attempts }: { attempts: AdminDashboardStudentDetail["recentQuestionAttempts"] }) {
  if (attempts.length === 0) {
    return <p className="mt-2 text-sm text-slate-600">No recent attempts found.</p>;
  }

  return (
    <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-2 text-sm text-slate-700">
      {attempts.map((attempt, index) => (
        <li key={`${attempt.questionId ?? "question"}-${attempt.attemptedAt ?? index}`} className={`rounded-xl border p-3 ${attempt.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
          <p className={`font-semibold ${attempt.correct ? "text-emerald-950" : "text-rose-950"}`}>{attempt.correct ? "Correct" : "Incorrect"} · {attempt.sectionTitle}</p>
          <p className="text-xs text-slate-500">{attempt.questionId ? `Question ${attempt.questionId} · ` : ""}{formatDateTime(attempt.attemptedAt)}</p>
        </li>
      ))}
    </ul>
  );
}

function WholeSchoolActivityPanel({ activities }: { activities: AdminDashboardActivity[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Whole-school activity</p>
      <h3 className="mt-1 text-2xl font-extrabold text-slate-950">Recent Regents Algebra 1 activity</h3>
      <p className="mt-2 text-sm text-slate-600">Select a student Details button to view a single-student read-only detail panel.</p>
      <ActivityList activities={activities} showStudent />
    </div>
  );
}

function StudentDetailPanel({ detail }: { detail: AdminDashboardStudentDetail | null }) {
  if (!detail) return null;
  return (
    <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <div><p className="text-sm font-bold uppercase tracking-wide text-blue-700">Student detail</p><h3 className="mt-1 text-2xl font-extrabold text-slate-950">{displayName({ fullName: detail.fullName, email: detail.email })}</h3><p className="text-sm text-slate-600">{detail.email ?? "No email"}</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><DashboardCard label="Assigned work" value={detail.assignedWorkCount} /><DashboardCard label="Completion" value={formatPercent(detail.overallCompletion)} /><DashboardCard label="Accuracy" value={formatPercent(detail.overallAccuracy)} /><DashboardCard label="Attempts" value={detail.totalQuestionAttempts} help={`${detail.correctAttempts} correct · ${detail.incorrectAttempts} incorrect`} /></div>
      <div className="rounded-2xl bg-white p-4 shadow-sm"><h4 className="font-bold text-slate-950">Classrooms</h4>{detail.classrooms.length === 0 ? <p className="mt-2 text-sm text-slate-600">No classrooms found.</p> : <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-2 text-sm text-slate-700">{detail.classrooms.map((classroom) => <li key={classroom.id} className="rounded-xl border border-slate-200 p-3"><p className="font-semibold text-slate-950">{classroom.name}</p><p className="text-xs text-slate-500">{classroom.teacherName || classroom.teacherEmail || "Unknown teacher"}</p></li>)}</ul>}</div>
      <div className="rounded-2xl bg-white p-4 shadow-sm"><h4 className="font-bold text-slate-950">Recent Attempts</h4><AttemptsList attempts={detail.recentQuestionAttempts} /></div>
      <div className="rounded-2xl bg-white p-4 shadow-sm"><h4 className="font-bold text-slate-950">Recent Activity</h4><ActivityList activities={detail.recentActivity} /></div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [dashboardState, setDashboardState] = useState<DashboardState>({ status: "loading" });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const dashboard = await getAdminOrgDashboard();
        if (active) setDashboardState({ status: "allowed", dashboard });
      } catch (error) {
        if (!active) return;
        const typedError = error as Error & { code?: string; payload?: AdminDashboardAccessError | null };
        if (typedError.code === "unauthorized") { router.push("/login"); return; }
        if (typedError.code === "admin_pending" && typedError.payload?.profile) { setDashboardState({ status: "pending", profile: typedError.payload.profile }); return; }
        setDashboardState({ status: "denied", message: typedError.message || "Administrator access requires an approved administrator account." });
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  if (dashboardState.status === "loading") return <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12"><div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administrator</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Loading organization dashboard...</h1></div></main>;

  if (dashboardState.status === "pending") return <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12"><div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Approval pending</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Administrator approval pending</h1><p className="mt-4 text-slate-700">Your administrator request has been received and is pending manual approval. You will not have administrator access until your account is approved.</p><div className="mt-6 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700"><p><span className="font-semibold">Requested role:</span> {dashboardState.profile.requested_role}</p><p><span className="font-semibold">Approval status:</span> {dashboardState.profile.approval_status}</p>{dashboardState.profile.email_domain ? <p><span className="font-semibold">Email domain:</span> {dashboardState.profile.email_domain}</p> : null}</div><Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50">Return to Dashboard</Link></div></main>;

  if (dashboardState.status === "denied") return <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12"><div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Access denied</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Administrator access required</h1><p className="mt-4 text-slate-700">{dashboardState.message}</p><Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50">Return to Dashboard</Link></div></main>;

  const { dashboard } = dashboardState;
  const selectedStudentDetail = selectedStudentId ? dashboard.studentDetails[selectedStudentId] ?? null : null;

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-10">
      <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administrator Dashboard</p><h1 className="mt-2 text-4xl font-extrabold text-slate-950">Organization overview</h1><p className="mt-4 max-w-3xl text-slate-700">{dashboard.scope.label}. This read-only dashboard summarizes Regents Algebra 1 teachers, students, classrooms, assignments, and progress available in your administrator scope.</p></div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><DashboardCard label="Organization" value={dashboard.scope.domain ?? "Global"} help={dashboard.scope.type === "master_global" ? "Master global admin view" : "Email-domain scoped"} /><DashboardCard label="Total teachers" value={dashboard.summary.totalTeachers} /><DashboardCard label="Total students" value={dashboard.summary.totalStudents} /><DashboardCard label="Total classrooms" value={dashboard.summary.totalClassrooms} /><DashboardCard label="Grouped assignments" value={dashboard.summary.totalGroupedAssignments} help={`${dashboard.summary.activeAssignments} active · ${dashboard.summary.archivedAssignments} archived`} /><DashboardCard label="Average completion" value={formatPercent(dashboard.summary.averageCompletion)} help="From Algebra 1 progress" /><DashboardCard label="Average accuracy" value={formatPercent(dashboard.summary.averageAccuracy)} help="From question attempts where available" /></div>
      <div className="mt-8 space-y-8"><DashboardSection title="Teachers"><TeachersTable teachers={dashboard.teachers} /></DashboardSection><DashboardSection title="Students"><div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]"><div><StudentsTable students={dashboard.students} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} /></div><div>{selectedStudentDetail ? <StudentDetailPanel detail={selectedStudentDetail} /> : <WholeSchoolActivityPanel activities={dashboard.recentActivity} />}</div></div></DashboardSection><DashboardSection title="Classrooms"><ClassroomsTable classrooms={dashboard.classrooms} /></DashboardSection><DashboardSection title="Assignments"><AssignmentsTable assignments={dashboard.assignments} /></DashboardSection></div>
    </main>
  );
}
