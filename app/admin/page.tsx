"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAdminOrgDashboard,
  type AdminDashboardAccessError,
  type AdminDashboardAssignment,
  type AdminDashboardClassroom,
  type AdminDashboardStudent,
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

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No activity";

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

function TeachersTable({ teachers }: { teachers: AdminDashboardTeacher[] }) {
  if (teachers.length === 0) {
    return <EmptyTableMessage>No teachers found for this administrator scope.</EmptyTableMessage>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Teacher</th>
            <th className="px-4 py-3">Classrooms</th>
            <th className="px-4 py-3">Students</th>
            <th className="px-4 py-3">Assignments</th>
            <th className="px-4 py-3">Avg. completion</th>
            <th className="px-4 py-3">Avg. accuracy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {teachers.map((teacher) => (
            <tr key={teacher.id}>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-950">{displayName(teacher)}</p>
                <p className="text-xs text-slate-500">{teacher.email ?? "No email"}</p>
              </td>
              <td className="px-4 py-3">{teacher.classroomCount}</td>
              <td className="px-4 py-3">{teacher.studentCount}</td>
              <td className="px-4 py-3">{teacher.assignmentCount}</td>
              <td className="px-4 py-3">{formatPercent(teacher.averageCompletion)}</td>
              <td className="px-4 py-3">{formatPercent(teacher.averageAccuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentsTable({ students }: { students: AdminDashboardStudent[] }) {
  if (students.length === 0) {
    return <EmptyTableMessage>No students found for this administrator scope.</EmptyTableMessage>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Classrooms</th>
            <th className="px-4 py-3">Assigned work</th>
            <th className="px-4 py-3">Completion</th>
            <th className="px-4 py-3">Accuracy</th>
            <th className="px-4 py-3">Last activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {students.map((student) => (
            <tr key={student.id}>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-950">{displayName(student)}</p>
                <p className="text-xs text-slate-500">{student.email ?? "No email"}</p>
              </td>
              <td className="px-4 py-3">{student.classroomCount}</td>
              <td className="px-4 py-3">{student.assignedWorkCount}</td>
              <td className="px-4 py-3">{formatPercent(student.completionPercent)}</td>
              <td className="px-4 py-3">{formatPercent(student.accuracyPercent)}</td>
              <td className="px-4 py-3">{formatDateTime(student.lastActivityAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassroomsTable({ classrooms }: { classrooms: AdminDashboardClassroom[] }) {
  if (classrooms.length === 0) {
    return <EmptyTableMessage>No classrooms found for this administrator scope.</EmptyTableMessage>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Classroom</th>
            <th className="px-4 py-3">Teacher</th>
            <th className="px-4 py-3">Students</th>
            <th className="px-4 py-3">Assignments</th>
            <th className="px-4 py-3">Avg. completion</th>
            <th className="px-4 py-3">Avg. accuracy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {classrooms.map((classroom) => (
            <tr key={classroom.id}>
              <td className="px-4 py-3 font-semibold text-slate-950">{classroom.name}</td>
              <td className="px-4 py-3">
                <p>{classroom.teacherName || classroom.teacherEmail || "Unknown teacher"}</p>
                <p className="text-xs text-slate-500">{classroom.teacherEmail ?? "No email"}</p>
              </td>
              <td className="px-4 py-3">{classroom.studentCount}</td>
              <td className="px-4 py-3">{classroom.assignmentCount}</td>
              <td className="px-4 py-3">{formatPercent(classroom.averageCompletion)}</td>
              <td className="px-4 py-3">{formatPercent(classroom.averageAccuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentsTable({ assignments }: { assignments: AdminDashboardAssignment[] }) {
  if (assignments.length === 0) {
    return <EmptyTableMessage>No assignments found for this administrator scope.</EmptyTableMessage>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Assignment</th>
            <th className="px-4 py-3">Teacher</th>
            <th className="px-4 py-3">Classroom</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Recipients</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Avg. progress</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {assignments.map((assignment) => (
            <tr key={assignment.id}>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-950">{assignment.title}</p>
                <p className="text-xs text-slate-500">{assignment.archivedAt ? "Archived" : "Active"}</p>
              </td>
              <td className="px-4 py-3">{assignment.teacherName || assignment.teacherEmail || "Unknown"}</td>
              <td className="px-4 py-3">{assignment.classroomName ?? "Unknown"}</td>
              <td className="px-4 py-3">{formatDate(assignment.dueDate)}</td>
              <td className="px-4 py-3">{assignment.recipientCount}</td>
              <td className="px-4 py-3">
                {assignment.completedCount} complete · {assignment.incompleteCount} incomplete · {assignment.excusedCount} excused
              </td>
              <td className="px-4 py-3">{formatPercent(assignment.averageProgress)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-extrabold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const dashboard = await getAdminOrgDashboard();
        if (active) setDashboardState({ status: "allowed", dashboard });
      } catch (error) {
        if (!active) return;

        const typedError = error as Error & {
          code?: string;
          payload?: AdminDashboardAccessError | null;
        };

        if (typedError.code === "unauthorized") {
          router.push("/login");
          return;
        }

        if (typedError.code === "admin_pending" && typedError.payload?.profile) {
          setDashboardState({ status: "pending", profile: typedError.payload.profile });
          return;
        }

        setDashboardState({
          status: "denied",
          message:
            typedError.message ||
            "Administrator access requires an approved administrator account.",
        });
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  if (dashboardState.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administrator</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Loading organization dashboard...</h1>
        </div>
      </main>
    );
  }

  if (dashboardState.status === "pending") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Approval pending</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Administrator approval pending</h1>
          <p className="mt-4 text-slate-700">
            Your administrator request has been received and is pending manual approval. You will not have administrator access until your account is approved.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
            <p><span className="font-semibold">Requested role:</span> {dashboardState.profile.requested_role}</p>
            <p><span className="font-semibold">Approval status:</span> {dashboardState.profile.approval_status}</p>
            {dashboardState.profile.email_domain ? <p><span className="font-semibold">Email domain:</span> {dashboardState.profile.email_domain}</p> : null}
          </div>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50">
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (dashboardState.status === "denied") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Access denied</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Administrator access required</h1>
          <p className="mt-4 text-slate-700">{dashboardState.message}</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50">
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { dashboard } = dashboardState;

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-10">
      <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administrator Dashboard</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">Organization overview</h1>
        <p className="mt-4 max-w-3xl text-slate-700">
          {dashboard.scope.label}. This dashboard is read-only and summarizes teachers, students, classrooms, assignments, and Algebra 1 progress available in your administrator scope.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Organization" value={dashboard.scope.domain ?? "Global"} help={dashboard.scope.type === "master_global" ? "Master global admin view" : "Email-domain scoped"} />
        <DashboardCard label="Total teachers" value={dashboard.summary.totalTeachers} />
        <DashboardCard label="Total students" value={dashboard.summary.totalStudents} />
        <DashboardCard label="Total classrooms" value={dashboard.summary.totalClassrooms} />
        <DashboardCard label="Active assignments" value={dashboard.summary.activeAssignments} />
        <DashboardCard label="Average completion" value={formatPercent(dashboard.summary.averageCompletion)} help="From Algebra 1 progress" />
        <DashboardCard label="Average accuracy" value={formatPercent(dashboard.summary.averageAccuracy)} help="From question attempts where available" />
      </div>

      <div className="mt-8 space-y-8">
        <DashboardSection title="Teachers">
          <TeachersTable teachers={dashboard.teachers} />
        </DashboardSection>

        <DashboardSection title="Students">
          <StudentsTable students={dashboard.students} />
        </DashboardSection>

        <DashboardSection title="Classrooms">
          <ClassroomsTable classrooms={dashboard.classrooms} />
        </DashboardSection>

        <DashboardSection title="Assignments">
          <AssignmentsTable assignments={dashboard.assignments} />
        </DashboardSection>
      </div>
    </main>
  );
}
