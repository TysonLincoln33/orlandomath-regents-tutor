"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type AdminApprovalRequest,
  getAdminApprovalRequests,
  updateAdminApprovalRequest,
} from "@/lib/admin/approvalRequests";
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
import {
  getAdminUserDirectory,
  type AdminDirectoryUser,
  type AdminUserDirectory,
} from "@/lib/admin/userDirectory";

type DashboardState =
  | { status: "loading" }
  | { status: "allowed"; dashboard: AdminOrgDashboard }
  | { status: "pending"; profile: NonNullable<AdminDashboardAccessError["profile"]> }
  | { status: "denied"; message: string };

type ApprovalCenterState =
  | { status: "idle" | "loading" | "hidden" }
  | { status: "allowed"; requests: AdminApprovalRequest[] }
  | { status: "error"; message: string };

type UserDirectoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "allowed"; directory: AdminUserDirectory }
  | { status: "error"; message: string };

type UserDirectoryRoleFilter = "all" | "student" | "teacher" | "admin";
type UserDirectoryApprovalFilter = "all" | "approved" | "pending" | "denied";

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

function displayApprovalRequestName(request: AdminApprovalRequest) {
  return request.full_name?.trim() || request.email?.trim() || "Unnamed requester";
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

function ApprovalCenter({
  state,
  updatingRequestId,
  onRefresh,
  onUpdate,
}: {
  state: ApprovalCenterState;
  updatingRequestId: string | null;
  onRefresh: () => void;
  onUpdate: (requestId: string, action: "approve" | "deny") => void;
}) {
  if (state.status === "idle" || state.status === "hidden") return null;

  return (
    <section className="mt-8 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Master only</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Administrator Approval Center</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-700">Review pending administrator requests. Approved administrators do not have access to this center or its APIs.</p>
        </div>
        <button type="button" onClick={onRefresh} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-100 hover:bg-indigo-50">Refresh</button>
      </div>

      {state.status === "loading" ? <p className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">Loading pending administrator requests...</p> : null}
      {state.status === "error" ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{state.message}</p> : null}
      {state.status === "allowed" && state.requests.length === 0 ? <p className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">No pending administrator requests.</p> : null}
      {state.status === "allowed" && state.requests.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Requester</th><th className="px-4 py-3">Current role</th><th className="px-4 py-3">Requested role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {state.requests.map((request) => {
                const disabled = updatingRequestId === request.id;

                return (
                  <tr key={request.id}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-950">{displayApprovalRequestName(request)}</p><p className="text-xs text-slate-500">{request.email ?? "No email"}</p>{request.email_domain ? <p className="text-xs text-slate-500">{request.email_domain}</p> : null}</td>
                    <td className="px-4 py-3">{request.role}</td>
                    <td className="px-4 py-3">{request.requested_role}</td>
                    <td className="px-4 py-3">{request.approval_status}</td>
                    <td className="px-4 py-3">{formatDateTime(request.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={disabled} onClick={() => onUpdate(request.id, "approve")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
                        <button type="button" disabled={disabled} onClick={() => onUpdate(request.id, "deny")} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">Deny</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function formatCompactValue(value: string | null | undefined) {
  return value?.trim() || "Not available";
}

function matchesUserDirectorySearch(user: AdminDirectoryUser, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) return true;

  return [user.fullName, user.username, user.email, user.emailDomain].some((value) =>
    value?.toLowerCase().includes(normalizedSearch),
  );
}

function UserDirectory({
  state,
  searchTerm,
  roleFilter,
  approvalFilter,
  onSearchTermChange,
  onRoleFilterChange,
  onApprovalFilterChange,
}: {
  state: UserDirectoryState;
  searchTerm: string;
  roleFilter: UserDirectoryRoleFilter;
  approvalFilter: UserDirectoryApprovalFilter;
  onSearchTermChange: (value: string) => void;
  onRoleFilterChange: (value: UserDirectoryRoleFilter) => void;
  onApprovalFilterChange: (value: UserDirectoryApprovalFilter) => void;
}) {
  if (state.status === "idle" || state.status === "loading") {
    return (
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Read-only</p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">User Directory</h2>
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading user directory...</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Read-only</p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">User Directory</h2>
        <p className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-rose-700">{state.message}</p>
      </section>
    );
  }

  const directory = state.directory;
  const filteredUsers = directory.users.filter((user: AdminDirectoryUser) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesApproval = approvalFilter === "all" || user.approvalStatus === approvalFilter;
    return matchesRole && matchesApproval && matchesUserDirectorySearch(user, searchTerm);
  });

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Read-only</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">User Directory</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-700">
            {directory.scope.label}. Search and review identity, role, and approval status for users available in your administrator scope.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-bold text-slate-950">{filteredUsers.length}</span> of {directory.users.length} users shown
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <label className="text-sm font-semibold text-slate-700">
          Search users
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search name, username, email, or domain"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Role
          <select
            value={roleFilter}
            onChange={(event) => onRoleFilterChange(event.target.value as UserDirectoryRoleFilter)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All</option>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Approval status
          <select
            value={approvalFilter}
            onChange={(event) => onApprovalFilterChange(event.target.value as UserDirectoryApprovalFilter)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="denied">Denied</option>
          </select>
        </label>
      </div>

      {filteredUsers.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No users match the current search and filters.</p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredUsers.map((user: AdminDirectoryUser) => (
            <article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-950">{formatCompactValue(user.fullName || user.email)}</h3>
                  <p className="truncate text-xs text-slate-500">{user.username ? `@${user.username}` : "No username"}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">{user.role}</span>
              </div>

              <dl className="mt-4 grid gap-2 text-xs text-slate-600">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-500">Email</dt>
                  <dd className="mt-1 break-words font-bold text-slate-950">{formatCompactValue(user.email)}</dd>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="font-semibold text-slate-500">Domain</dt>
                    <dd className="mt-1 break-words font-bold text-slate-950">{formatCompactValue(user.emailDomain)}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="font-semibold text-slate-500">Status</dt>
                    <dd className="mt-1 font-bold capitalize text-slate-950">{formatCompactValue(user.approvalStatus)}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="font-semibold text-slate-500">Requested role</dt>
                    <dd className="mt-1 font-bold capitalize text-slate-950">{formatCompactValue(user.requestedRole)}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="font-semibold text-slate-500">Created</dt>
                    <dd className="mt-1 font-bold text-slate-950">{formatDate(user.createdAt)}</dd>
                  </div>
                </div>
              </dl>

              <p className="mt-3 text-xs text-slate-500">Last activity: {formatDateTime(user.lastActivityAt)}</p>
            </article>
          ))}
        </div>
      )}
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

function StudentsList({ students, selectedStudentId, onSelectStudent }: { students: AdminDashboardStudent[]; selectedStudentId: string | null; onSelectStudent: (studentId: string) => void }) {
  if (students.length === 0) return <EmptyTableMessage>No Regents Algebra 1 students found for this administrator scope.</EmptyTableMessage>;

  return (
    <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
      {students.map((student) => {
        const selected = selectedStudentId === student.id;

        return (
          <article key={student.id} className={`rounded-2xl border p-4 shadow-sm ${selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold text-slate-950">{displayName(student)}</h3>
                <p className="truncate text-xs text-slate-500">{student.email ?? "No email"}</p>
              </div>
              <button type="button" onClick={() => onSelectStudent(student.id)} className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700">Details</button>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="rounded-xl bg-slate-50 p-2">
                <dt className="font-semibold text-slate-500">Completion</dt>
                <dd className="mt-1 font-bold text-slate-950">{formatPercent(student.completionPercent)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <dt className="font-semibold text-slate-500">Accuracy</dt>
                <dd className="mt-1 font-bold text-slate-950">{formatPercent(student.accuracyPercent)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-slate-500">Last activity: {formatDateTime(student.lastActivityAt)}</p>
          </article>
        );
      })}
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
  const [approvalCenterState, setApprovalCenterState] = useState<ApprovalCenterState>({ status: "idle" });
  const [userDirectoryState, setUserDirectoryState] = useState<UserDirectoryState>({ status: "idle" });
  const [userDirectorySearch, setUserDirectorySearch] = useState("");
  const [userDirectoryRoleFilter, setUserDirectoryRoleFilter] = useState<UserDirectoryRoleFilter>("all");
  const [userDirectoryApprovalFilter, setUserDirectoryApprovalFilter] = useState<UserDirectoryApprovalFilter>("all");
  const [updatingApprovalRequestId, setUpdatingApprovalRequestId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const loadApprovalCenter = useCallback(async () => {
    setApprovalCenterState({ status: "loading" });
    try {
      const response = await getAdminApprovalRequests();
      setApprovalCenterState({ status: "allowed", requests: response.requests });
    } catch (error) {
      const typedError = error as Error & { status?: number };
      if (typedError.status === 403) {
        setApprovalCenterState({ status: "hidden" });
        return;
      }

      if (typedError.status === 401) {
        router.push("/login");
        return;
      }

      setApprovalCenterState({ status: "error", message: typedError.message || "Failed to load approval requests." });
    }
  }, [router]);

  const loadUserDirectory = useCallback(async () => {
    setUserDirectoryState({ status: "loading" });
    try {
      const directory = await getAdminUserDirectory();
      setUserDirectoryState({ status: "allowed", directory });
    } catch (error) {
      const typedError = error as Error & { status?: number; code?: string };
      if (typedError.status === 401 || typedError.code === "unauthorized") {
        router.push("/login");
        return;
      }
      setUserDirectoryState({ status: "error", message: typedError.message || "Failed to load user directory." });
    }
  }, [router]);

  const handleApprovalRequestUpdate = useCallback(async (requestId: string, action: "approve" | "deny") => {
    setUpdatingApprovalRequestId(requestId);
    try {
      await updateAdminApprovalRequest(requestId, action);
      await loadApprovalCenter();
    } catch (error) {
      const typedError = error as Error & { status?: number };
      setApprovalCenterState({ status: "error", message: typedError.message || "Failed to update approval request." });
    } finally {
      setUpdatingApprovalRequestId(null);
    }
  }, [loadApprovalCenter]);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const dashboard = await getAdminOrgDashboard();
        if (active) {
          setDashboardState({ status: "allowed", dashboard });
          void loadApprovalCenter();
          void loadUserDirectory();
        }
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
  }, [loadApprovalCenter, loadUserDirectory, router]);

  if (dashboardState.status === "loading") return <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12"><div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administrator</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Loading organization dashboard...</h1></div></main>;

  if (dashboardState.status === "pending") return <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12"><div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Approval pending</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Administrator approval pending</h1><p className="mt-4 text-slate-700">Your administrator request has been received and is pending manual approval. You will not have administrator access until your account is approved.</p><div className="mt-6 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700"><p><span className="font-semibold">Requested role:</span> {dashboardState.profile.requested_role}</p><p><span className="font-semibold">Approval status:</span> {dashboardState.profile.approval_status}</p>{dashboardState.profile.email_domain ? <p><span className="font-semibold">Email domain:</span> {dashboardState.profile.email_domain}</p> : null}</div><Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50">Return to Dashboard</Link></div></main>;

  if (dashboardState.status === "denied") return <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12"><div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Access denied</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Administrator access required</h1><p className="mt-4 text-slate-700">{dashboardState.message}</p><Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50">Return to Dashboard</Link></div></main>;

  const { dashboard } = dashboardState;
  const selectedStudentDetail = selectedStudentId ? dashboard.studentDetails[selectedStudentId] ?? null : null;

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-10">
      <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administrator Dashboard</p><h1 className="mt-2 text-4xl font-extrabold text-slate-950">Organization overview</h1><p className="mt-4 max-w-3xl text-slate-700">{dashboard.scope.label}. This read-only dashboard summarizes Regents Algebra 1 teachers, students, classrooms, assignments, and progress available in your administrator scope.</p></div>
      <ApprovalCenter state={approvalCenterState} updatingRequestId={updatingApprovalRequestId} onRefresh={() => void loadApprovalCenter()} onUpdate={(requestId, action) => void handleApprovalRequestUpdate(requestId, action)} />
      <UserDirectory state={userDirectoryState} searchTerm={userDirectorySearch} roleFilter={userDirectoryRoleFilter} approvalFilter={userDirectoryApprovalFilter} onSearchTermChange={setUserDirectorySearch} onRoleFilterChange={setUserDirectoryRoleFilter} onApprovalFilterChange={setUserDirectoryApprovalFilter} />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><DashboardCard label="Organization" value={dashboard.scope.domain ?? "Global"} help={dashboard.scope.type === "master_global" ? "Master global admin view" : "Email-domain scoped"} /><DashboardCard label="Total teachers" value={dashboard.summary.totalTeachers} /><DashboardCard label="Total students" value={dashboard.summary.totalStudents} /><DashboardCard label="Total classrooms" value={dashboard.summary.totalClassrooms} /><DashboardCard label="Grouped assignments" value={dashboard.summary.totalGroupedAssignments} help={`${dashboard.summary.activeAssignments} active · ${dashboard.summary.archivedAssignments} archived`} /><DashboardCard label="Average completion" value={formatPercent(dashboard.summary.averageCompletion)} help="From Algebra 1 progress" /><DashboardCard label="Average accuracy" value={formatPercent(dashboard.summary.averageAccuracy)} help="From question attempts where available" /></div>
      <div className="mt-8 space-y-8"><DashboardSection title="Teachers"><TeachersTable teachers={dashboard.teachers} /></DashboardSection><DashboardSection title="Students"><div className="grid gap-5 xl:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]"><div><StudentsList students={dashboard.students} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} /></div><div>{selectedStudentDetail ? <StudentDetailPanel detail={selectedStudentDetail} /> : <WholeSchoolActivityPanel activities={dashboard.recentActivity} />}</div></div></DashboardSection><DashboardSection title="Classrooms"><ClassroomsTable classrooms={dashboard.classrooms} /></DashboardSection><DashboardSection title="Assignments"><AssignmentsTable assignments={dashboard.assignments} /></DashboardSection></div>
    </main>
  );
}
