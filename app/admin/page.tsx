"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AdminApprovalRequest,
  getAdminApprovalRequests,
  updateAdminApprovalRequest,
} from "@/lib/admin/approvalRequests";
import {
  addAdminClassroomMember,
  getAdminClassroomManagement,
  removeAdminClassroomMember,
  type AdminClassroomManagement,
  type AdminEligibleStudent,
  type AdminManagedClassroom,
  type AdminClassroomRosterMember,
} from "@/lib/admin/classroomManagement";
import {
  addAdminAssignmentRecipient,
  addAdminAssignmentRecipientsBulk,
  createAdminOwnClassroom,
  createAdminOwnClassroomChapterAssignments,
  getAdminOwnClassroom,
  getAdminOrgDashboard,
  updateAdminAssignmentRecipient,
  updateAdminAssignmentRecipientsBulk,
  type AdminAssignmentRecipientAction,
  type AdminDashboardAccessError,
  type AdminDashboardAssignmentCandidateStudent,
  type AdminDashboardActivity,
  type AdminDashboardAssignment,
  type AdminDashboardClassroom,
  type AdminDashboardStudent,
  type AdminDashboardStudentDetail,
  type AdminDashboardTeacher,
  type AdminOrgDashboard,
  type AdminOwnClassroomState,
} from "@/lib/admin/orgDashboard";
import {
  archiveAdminQuickAssignChapter,
  createAdminQuickAssign,
  getAdminQuickAssignData,
  unassignAdminQuickAssignChapter,
  type AdminQuickAssignData,
} from "@/lib/admin/quickAssign";
import {
  getAdminUserDirectory,
  type AdminDirectoryUser,
  type AdminUserActivationAction,
  type AdminUserDirectory,
  updateAdminUserActivation,
} from "@/lib/admin/userDirectory";
import { CHAPTERS, SECTIONS } from "@/lib/course/algebra1";

type DashboardState =
  | { status: "loading" }
  | { status: "allowed"; dashboard: AdminOrgDashboard }
  | {
      status: "pending";
      profile: NonNullable<AdminDashboardAccessError["profile"]>;
    }
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

type ClassroomManagementState =
  | { status: "idle" | "loading" }
  | { status: "allowed"; data: AdminClassroomManagement }
  | { status: "error"; message: string };

type ClassroomMemberMutation =
  | { type: "add"; userId: string }
  | { type: "remove"; userId: string }
  | null;

type AssignmentAddCandidate = {
  userId: string;
  fullName: string | null;
  email: string | null;
  inClassroom: boolean;
  alreadyAssigned: boolean;
};

type UserDirectoryRoleFilter = "all" | "student" | "teacher" | "admin";
type UserDirectoryApprovalFilter = "all" | "approved" | "pending" | "denied";
type UserDirectoryActivationFilter = "all" | "active" | "inactive";
type StudentPanelMode = "whole_school" | "overall" | "assign" | "assignment_summary";

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

function displayName(entity: {
  fullName?: string | null;
  email?: string | null;
}) {
  return entity.fullName?.trim() || entity.email?.trim() || "Unnamed user";
}

function displayApprovalRequestName(request: AdminApprovalRequest) {
  return (
    request.full_name?.trim() || request.email?.trim() || "Unnamed requester"
  );
}

function DashboardCard({
  label,
  value,
  help,
}: {
  label: string;
  value: string | number;
  help?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
      {help ? <p className="mt-2 text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

function EmptyTableMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
      {children}
    </p>
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
            Master only
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
            Administrator Approval Center
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-700">
            Review pending administrator requests. Approved administrators do
            not have access to this center or its APIs.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-100 hover:bg-indigo-50"
        >
          Refresh
        </button>
      </div>

      {state.status === "loading" ? (
        <p className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading pending administrator requests...
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {state.message}
        </p>
      ) : null}
      {state.status === "allowed" && state.requests.length === 0 ? (
        <p className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          No pending administrator requests.
        </p>
      ) : null}
      {state.status === "allowed" && state.requests.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Current role</th>
                <th className="px-4 py-3">Requested role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {state.requests.map((request) => {
                const disabled = updatingRequestId === request.id;

                return (
                  <tr key={request.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">
                        {displayApprovalRequestName(request)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {request.email ?? "No email"}
                      </p>
                      {request.email_domain ? (
                        <p className="text-xs text-slate-500">
                          {request.email_domain}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{request.role}</td>
                    <td className="px-4 py-3">{request.requested_role}</td>
                    <td className="px-4 py-3">{request.approval_status}</td>
                    <td className="px-4 py-3">
                      {formatDateTime(request.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onUpdate(request.id, "approve")}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onUpdate(request.id, "deny")}
                          className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Deny
                        </button>
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

function matchesUserDirectorySearch(
  user: AdminDirectoryUser,
  searchTerm: string,
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) return true;

  return [user.fullName, user.username, user.email, user.emailDomain].some(
    (value) => value?.toLowerCase().includes(normalizedSearch),
  );
}

function UserDirectory({
  state,
  searchTerm,
  roleFilter,
  approvalFilter,
  activationFilter,
  activationMessage,
  updatingUserId,
  onSearchTermChange,
  onRoleFilterChange,
  onApprovalFilterChange,
  onActivationFilterChange,
  onActivationUpdate,
}: {
  state: UserDirectoryState;
  searchTerm: string;
  roleFilter: UserDirectoryRoleFilter;
  approvalFilter: UserDirectoryApprovalFilter;
  activationFilter: UserDirectoryActivationFilter;
  activationMessage: { type: "success" | "error"; text: string } | null;
  updatingUserId: string | null;
  onSearchTermChange: (value: string) => void;
  onRoleFilterChange: (value: UserDirectoryRoleFilter) => void;
  onApprovalFilterChange: (value: UserDirectoryApprovalFilter) => void;
  onActivationFilterChange: (value: UserDirectoryActivationFilter) => void;
  onActivationUpdate: (
    profileId: string,
    action: AdminUserActivationAction,
  ) => void;
}) {
  if (state.status === "idle" || state.status === "loading") {
    return (
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Read-only
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
          User Directory
        </h2>
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Loading user directory...
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
          Read-only
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
          User Directory
        </h2>
        <p className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-rose-700">
          {state.message}
        </p>
      </section>
    );
  }

  const directory = state.directory;
  const filteredUsers = directory.users.filter((user: AdminDirectoryUser) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesApproval =
      approvalFilter === "all" || user.approvalStatus === approvalFilter;
    const matchesActivation =
      activationFilter === "all" ||
      (activationFilter === "active" && user.isActive) ||
      (activationFilter === "inactive" && !user.isActive);
    return (
      matchesRole &&
      matchesApproval &&
      matchesActivation &&
      matchesUserDirectorySearch(user, searchTerm)
    );
  });

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            User management
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
            User Directory
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-700">
            {directory.scope.label}. Search and review identity, role, and
            approval status for users available in your administrator scope.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-bold text-slate-950">
            {filteredUsers.length}
          </span>{" "}
          of {directory.users.length} users shown
        </div>
      </div>

      {activationMessage ? (
        <p
          className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${activationMessage.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}
        >
          {activationMessage.text}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem]">
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
            onChange={(event) =>
              onRoleFilterChange(event.target.value as UserDirectoryRoleFilter)
            }
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
            onChange={(event) =>
              onApprovalFilterChange(
                event.target.value as UserDirectoryApprovalFilter,
              )
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="denied">Denied</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Activation
          <select
            value={activationFilter}
            onChange={(event) =>
              onActivationFilterChange(
                event.target.value as UserDirectoryActivationFilter,
              )
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      {filteredUsers.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          No users match the current search and filters.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredUsers.map((user: AdminDirectoryUser) => {
            const activationAction: AdminUserActivationAction = user.isActive
              ? "deactivate"
              : "reactivate";
            const isUpdating = updatingUserId === user.id;

            return (
              <article
                key={user.id}
                className={`rounded-2xl border p-4 shadow-sm ${user.isActive ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-50 opacity-80"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-950">
                      {formatCompactValue(user.fullName || user.email)}
                    </h3>
                    <p className="truncate text-xs text-slate-500">
                      {user.username ? `@${user.username}` : "No username"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                      {user.role}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-xs text-slate-600">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="font-semibold text-slate-500">Email</dt>
                    <dd className="mt-1 break-words font-bold text-slate-950">
                      {formatCompactValue(user.email)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-semibold text-slate-500">Domain</dt>
                      <dd className="mt-1 break-words font-bold text-slate-950">
                        {formatCompactValue(user.emailDomain)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-semibold text-slate-500">Approval</dt>
                      <dd className="mt-1 font-bold capitalize text-slate-950">
                        {formatCompactValue(user.approvalStatus)}
                      </dd>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-semibold text-slate-500">
                        Requested role
                      </dt>
                      <dd className="mt-1 font-bold capitalize text-slate-950">
                        {formatCompactValue(user.requestedRole)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-semibold text-slate-500">Created</dt>
                      <dd className="mt-1 font-bold text-slate-950">
                        {formatDate(user.createdAt)}
                      </dd>
                    </div>
                  </div>
                  {!user.isActive && user.deactivatedAt ? (
                    <div className="rounded-xl bg-slate-100 p-3">
                      <dt className="font-semibold text-slate-500">
                        Deactivated
                      </dt>
                      <dd className="mt-1 font-bold text-slate-950">
                        {formatDateTime(user.deactivatedAt)}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  {user.canManageActivation ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        onActivationUpdate(user.id, activationAction)
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${user.isActive ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                    >
                      {isUpdating
                        ? user.isActive
                          ? "Deactivating..."
                          : "Reactivating..."
                        : user.isActive
                          ? "Deactivate"
                          : "Reactivate"}
                    </button>
                  ) : (
                    <p className="text-xs font-semibold text-slate-500">
                      Protected account
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeachersTable({ teachers }: { teachers: AdminDashboardTeacher[] }) {
  if (teachers.length === 0)
    return (
      <EmptyTableMessage>
        No Regents Algebra 1 teachers found for this administrator scope.
      </EmptyTableMessage>
    );
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
                <p className="font-semibold text-slate-950">
                  {displayName(teacher)}
                </p>
                <p className="text-xs text-slate-500">
                  {teacher.email ?? "No email"}
                </p>
              </td>
              <td className="px-4 py-3">{teacher.classroomCount}</td>
              <td className="px-4 py-3">{teacher.studentCount}</td>
              <td className="px-4 py-3">{teacher.assignmentCount}</td>
              <td className="px-4 py-3">
                {formatPercent(teacher.averageCompletion)}
              </td>
              <td className="px-4 py-3">
                {formatPercent(teacher.averageAccuracy)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentsList({
  students,
  selectedStudentId,
  selectedMode,
  onSelectOverall,
  onSelectAssign,
}: {
  students: AdminDashboardStudent[];
  selectedStudentId: string | null;
  selectedMode: StudentPanelMode | null;
  onSelectOverall: (studentId: string) => void;
  onSelectAssign: (studentId: string) => void;
}) {
  if (students.length === 0)
    return (
      <EmptyTableMessage>
        No Regents Algebra 1 students found for this administrator scope.
      </EmptyTableMessage>
    );

  return (
    <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-2">
      {students.map((student) => {
        const selected = selectedStudentId === student.id;
        const overallSelected =
          selected &&
          (selectedMode === "overall" || selectedMode === "assignment_summary");
        const assignSelected = selected && selectedMode === "assign";

        return (
          <article
            key={student.id}
            className={`rounded-2xl border p-4 shadow-sm ${selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold text-slate-950">
                  {displayName(student)}
                </h3>
                <p className="truncate text-xs text-slate-500">
                  {student.email ?? "No email"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onSelectOverall(student.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${overallSelected ? "bg-blue-700 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                >
                  Overall
                </button>
                <button
                  type="button"
                  onClick={() => onSelectAssign(student.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${assignSelected ? "bg-emerald-700 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                >
                  Assign
                </button>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="rounded-xl bg-slate-50 p-2">
                <dt className="font-semibold text-slate-500">Completion</dt>
                <dd className="mt-1 font-bold text-slate-950">
                  {formatPercent(student.completionPercent)}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <dt className="font-semibold text-slate-500">Accuracy</dt>
                <dd className="mt-1 font-bold text-slate-950">
                  {formatPercent(student.accuracyPercent)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-slate-500">
              Last activity: {formatDateTime(student.lastActivityAt)}
            </p>
          </article>
        );
      })}
    </div>
  );
}


function ClassroomManagement({
  state,
  selectedClassroomId,
  studentSearchTerm,
  mutation,
  mutationMessage,
  onSelectClassroom,
  onStudentSearchTermChange,
  onAddStudent,
  onRemoveStudent,
  onRefresh,
}: {
  state: ClassroomManagementState;
  selectedClassroomId: string | null;
  studentSearchTerm: string;
  mutation: ClassroomMemberMutation;
  mutationMessage: { type: "success" | "error"; text: string } | null;
  onSelectClassroom: (classroomId: string) => void;
  onStudentSearchTermChange: (value: string) => void;
  onAddStudent: (userId: string) => void;
  onRemoveStudent: (userId: string) => void;
  onRefresh: () => void;
}) {
  if (state.status === "error") {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
          Read-only
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
          Classroom Management
        </h2>
        <p className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-rose-700">
          {state.message}
        </p>
      </section>
    );
  }

  if (state.status !== "allowed") {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Read-only
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
          Classroom Management
        </h2>
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Loading classroom rosters...
        </p>
      </section>
    );
  }

  const data = state.data;
  const selectedClassroom =
    data.classrooms.find((classroom) => classroom.id === selectedClassroomId) ??
    data.classrooms[0] ??
    null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            A3.4b roster tools
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
            Classroom Management
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-700">
            {data.scope.label}. View classroom ownership, rosters, roster counts,
            and add or remove student roster memberships without changing
            assignments or progress.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50"
        >
          Refresh
        </button>
      </div>

      {data.classrooms.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          No classrooms are available in this administrator scope.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <span className="font-bold text-slate-950">
                {data.classrooms.length}
              </span>{" "}
              classrooms visible ·{" "}
              <span className="font-bold text-slate-950">
                {data.classrooms.reduce(
                  (sum, classroom) => sum + classroom.rosterCount,
                  0,
                )}
              </span>{" "}
              roster memberships
            </div>
            <div className="max-h-[38rem] space-y-3 overflow-y-auto pr-2">
              {data.classrooms.map((classroom) => (
                <ClassroomSelectorCard
                  key={classroom.id}
                  classroom={classroom}
                  selected={selectedClassroom?.id === classroom.id}
                  onSelect={() => onSelectClassroom(classroom.id)}
                />
              ))}
            </div>
          </div>
          <ClassroomRosterPanel
            classroom={selectedClassroom}
            studentSearchTerm={studentSearchTerm}
            eligibleStudents={data.eligibleStudents}
            mutation={mutation}
            mutationMessage={mutationMessage}
            onStudentSearchTermChange={onStudentSearchTermChange}
            onAddStudent={onAddStudent}
            onRemoveStudent={onRemoveStudent}
          />
        </div>
      )}
    </section>
  );
}

function ClassroomSelectorCard({
  classroom,
  selected,
  onSelect,
}: {
  classroom: AdminManagedClassroom;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-950">
            {classroom.name}
          </h3>
          <p className="truncate text-xs text-slate-500">
            {classroom.teacherName || classroom.teacherEmail || "Unknown teacher"}
          </p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
        >
          View
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div className="rounded-xl bg-white/80 p-2">
          <dt className="font-semibold text-slate-500">Roster</dt>
          <dd className="mt-1 font-bold text-slate-950">
            {classroom.rosterCount} students
          </dd>
        </div>
        <div className="rounded-xl bg-white/80 p-2">
          <dt className="font-semibold text-slate-500">Domain</dt>
          <dd className="mt-1 truncate font-bold text-slate-950">
            {classroom.teacherEmailDomain ?? "Unknown"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function ClassroomRosterPanel({
  classroom,
  studentSearchTerm,
  eligibleStudents,
  mutation,
  mutationMessage,
  onStudentSearchTermChange,
  onAddStudent,
  onRemoveStudent,
}: {
  classroom: AdminManagedClassroom | null;
  studentSearchTerm: string;
  eligibleStudents: AdminEligibleStudent[];
  mutation: ClassroomMemberMutation;
  mutationMessage: { type: "success" | "error"; text: string } | null;
  onStudentSearchTermChange: (value: string) => void;
  onAddStudent: (userId: string) => void;
  onRemoveStudent: (userId: string) => void;
}) {
  if (!classroom) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Select a classroom to view its roster.
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
            Selected classroom
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-slate-950">
            {classroom.name}
          </h3>
          <p className="text-sm text-slate-600">
            {classroom.teacherName || classroom.teacherEmail || "Unknown teacher"}
            {classroom.teacherEmail ? ` · ${classroom.teacherEmail}` : ""}
          </p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <span className="font-bold text-slate-950">{classroom.rosterCount}</span>{" "}
          roster members
        </div>
      </div>

      {mutationMessage ? (
        <p
          className={`rounded-xl p-3 text-sm font-semibold ${
            mutationMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {mutationMessage.text}
        </p>
      ) : null}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Roster</h4>
        {classroom.roster.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            This classroom has no roster members.
          </p>
        ) : (
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-2">
            {classroom.roster.map((member) => (
              <RosterMemberItem
                key={member.membershipId}
                member={member}
                isRemoving={
                  mutation?.type === "remove" && mutation.userId === member.userId
                }
                onRemove={() => onRemoveStudent(member.userId)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Eligible student search</h4>
        <p className="mt-1 text-sm text-slate-600">
          Search active eligible students to add them to this classroom. Roster
          removals only remove classroom membership.
        </p>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Search active students
          <input
            type="search"
            value={studentSearchTerm}
            onChange={(event) => onStudentSearchTermChange(event.target.value)}
            placeholder="Search by name or email"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <EligibleStudentResults
          searchTerm={studentSearchTerm}
          students={eligibleStudents}
          addingStudentId={mutation?.type === "add" ? mutation.userId : null}
          onAddStudent={onAddStudent}
        />
      </div>
    </div>
  );
}

function RosterMemberItem({
  member,
  isRemoving,
  onRemove,
}: {
  member: AdminClassroomRosterMember;
  isRemoving: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-950">
            {member.fullName || member.email || "Unknown student"}
          </p>
          <p className="truncate text-xs text-slate-500">
            {member.email ?? "No email"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${member.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
          >
            {member.isActive ? "Active" : "Inactive"}
          </span>
          {member.canRemove ? (
            <button
              type="button"
              disabled={isRemoving}
              onClick={onRemove}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Joined {formatDate(member.joinedAt)}
        {member.joinedVia ? ` · ${member.joinedVia}` : ""}
        {member.emailDomain ? ` · ${member.emailDomain}` : ""}
      </p>
    </li>
  );
}

function EligibleStudentResults({
  searchTerm,
  students,
  addingStudentId,
  onAddStudent,
}: {
  searchTerm: string;
  students: AdminEligibleStudent[];
  addingStudentId: string | null;
  onAddStudent: (userId: string) => void;
}) {
  if (searchTerm.trim().length < 2) {
    return (
      <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        Enter at least 2 characters to preview eligible active students.
      </p>
    );
  }

  if (students.length === 0) {
    return (
      <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        No active eligible students match this search.
      </p>
    );
  }

  return (
    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
      {students.map((student) => (
        <li
          key={student.id}
          className="rounded-xl border border-slate-200 p-3 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-950">
                {student.fullName || student.email || "Unknown student"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {student.email ?? "No email"}
                {student.emailDomain ? ` · ${student.emailDomain}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${student.alreadyInClassroom ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}
              >
                {student.alreadyInClassroom ? "Already enrolled" : "Eligible"}
              </span>
              {!student.alreadyInClassroom ? (
                <button
                  type="button"
                  disabled={addingStudentId === student.id}
                  onClick={() => onAddStudent(student.id)}
                  className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingStudentId === student.id ? "Adding..." : "Add"}
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ClassroomsTable({
  classrooms,
}: {
  classrooms: AdminDashboardClassroom[];
}) {
  if (classrooms.length === 0)
    return (
      <EmptyTableMessage>
        No Regents Algebra 1 classrooms found for this administrator scope.
      </EmptyTableMessage>
    );
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
              <td className="px-4 py-3 font-semibold text-slate-950">
                {classroom.name}
              </td>
              <td className="px-4 py-3">
                <p>
                  {classroom.teacherName ||
                    classroom.teacherEmail ||
                    "Unknown teacher"}
                </p>
                <p className="text-xs text-slate-500">
                  {classroom.teacherEmail ?? "No email"}
                </p>
              </td>
              <td className="px-4 py-3">{classroom.studentCount}</td>
              <td className="px-4 py-3">{classroom.assignmentCount}</td>
              <td className="px-4 py-3">
                {formatPercent(classroom.averageCompletion)}
              </td>
              <td className="px-4 py-3">
                {formatPercent(classroom.averageAccuracy)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAssignmentStatus(status: string | null | undefined) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}


type AdminAssignmentSection = AdminDashboardAssignment["sectionAssignments"][number];
type AdminAssignmentRecipient = AdminAssignmentSection["recipients"][number];

function averageNullablePercent(values: Array<number | null | undefined>) {
  const validValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (validValues.length === 0) return null;

  return Math.round(
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length,
  );
}

type OverallRecipientStatus = "assigned" | "excused" | "completed" | "mixed";

type OverallAssignmentRecipient = AdminAssignmentRecipient & {
  assignmentIds: string[];
  statuses: Array<string | null | undefined>;
  status: OverallRecipientStatus;
};

function getOverallRecipientStatus(statuses: Array<string | null | undefined>): OverallRecipientStatus {
  if (statuses.length > 0 && statuses.every((status) => status === "assigned")) {
    return "assigned";
  }

  if (statuses.length > 0 && statuses.every((status) => status === "excused")) {
    return "excused";
  }

  if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
    return "completed";
  }

  return "mixed";
}

function getOverallRecipientAction(recipient: OverallAssignmentRecipient) {
  if (recipient.status === "assigned") return { action: "excuse" as const, label: "Excuse all" };
  if (recipient.status === "excused") return { action: "unexcuse" as const, label: "Unexcuse all" };
  return null;
}

function getOverallAssignmentSummary(assignment: AdminDashboardAssignment) {
  const rowsByUser = new Map<
    string,
    {
      recipient: AdminAssignmentRecipient;
      statuses: Array<string | null | undefined>;
      completionValues: number[];
      accuracyValues: number[];
      assignmentIds: string[];
      hasProgress: boolean;
      hasAttempts: boolean;
    }
  >();

  for (const sectionAssignment of assignment.sectionAssignments) {
    for (const recipient of sectionAssignment.recipients) {
      const summary = rowsByUser.get(recipient.userId) ?? {
        recipient,
        statuses: [],
        completionValues: [],
        accuracyValues: [],
        assignmentIds: [],
        hasProgress: false,
        hasAttempts: false,
      };
      const isActive = recipient.status !== "excused" && recipient.status !== "archived" && recipient.status !== "unassigned";

      summary.statuses.push(recipient.status);
      summary.assignmentIds.push(sectionAssignment.id);
      if (isActive && typeof recipient.completionPercent === "number") {
        summary.completionValues.push(recipient.completionPercent);
      }
      if (isActive && typeof recipient.accuracyPercent === "number") {
        summary.accuracyValues.push(recipient.accuracyPercent);
      }
      summary.hasProgress = summary.hasProgress || recipient.hasProgress;
      summary.hasAttempts = summary.hasAttempts || recipient.hasAttempts;
      rowsByUser.set(recipient.userId, summary);
    }
  }

  const recipients = [...rowsByUser.values()]
    .map(({ recipient, statuses, completionValues, accuracyValues, assignmentIds, hasProgress, hasAttempts }) => ({
      ...recipient,
      assignmentIds,
      statuses,
      status: getOverallRecipientStatus(statuses),
      completionPercent: averageNullablePercent(completionValues),
      accuracyPercent: averageNullablePercent(accuracyValues),
      hasProgress,
      hasAttempts,
    }))
    .sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));

  return {
    recipients,
    completionPercent: averageNullablePercent(recipients.map((recipient) => recipient.completionPercent)),
    accuracyPercent: averageNullablePercent(recipients.map((recipient) => recipient.accuracyPercent)),
  };
}


function AdminAssignmentCreation({
  dashboard,
  onCreated,
}: {
  dashboard: AdminOrgDashboard;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [classroomState, setClassroomState] = useState<
    AdminOwnClassroomState | { status: "loading" }
  >({ status: "loading" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeStudents = useMemo<AdminDashboardAssignmentCandidateStudent[]>(
    () => dashboard.assignmentCandidateStudents,
    [dashboard.assignmentCandidateStudents],
  );
  const selectedSections = useMemo(
    () => SECTIONS.filter((section) => selectedChapterIds.includes(section.chapterId)),
    [selectedChapterIds],
  );
  const selectedStudents = useMemo(
    () => activeStudents.filter((student) => selectedStudentIds.includes(student.id)),
    [activeStudents, selectedStudentIds],
  );
  const totalAssignmentRows = selectedSections.length;
  const totalRecipientRows = totalAssignmentRows * selectedStudents.length;

  useEffect(() => {
    let active = true;

    async function loadAdminClassroom() {
      if (dashboard.scope.type === "master_global") return;

      setClassroomState({ status: "loading" });
      try {
        const state = await getAdminOwnClassroom();
        if (active) setClassroomState(state);
      } catch (error) {
        const typedError = error as Error;
        if (active) {
          setClassroomState({
            status: "missing",
            classroom: null,
            message:
              typedError.message || "Admin classroom setup could not be loaded.",
          });
        }
      }
    }

    void loadAdminClassroom();

    return () => {
      active = false;
    };
  }, [dashboard.scope.type]);

  function toggleChapter(chapterId: string) {
    setSelectedChapterIds((current) =>
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId],
    );
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  async function handleCreateAdminClassroom() {
    setMessage(null);
    setSetupLoading(true);

    try {
      const result = await createAdminOwnClassroom();
      setClassroomState({ status: "ready", classroom: result.classroom });
      setMessage({
        type: "success",
        text: result.created
          ? "Admin classroom created. You can create assignments now."
          : "Admin classroom is ready. You can create assignments now.",
      });
      await onCreated();
    } catch (error) {
      const typedError = error as Error;
      setMessage({
        type: "error",
        text:
          typedError.message || "Failed to create admin classroom.",
      });
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      const result = await createAdminOwnClassroomChapterAssignments({
        title,
        description,
        dueDate,
        chapterIds: selectedChapterIds,
        studentUserIds: selectedStudentIds,
      });
      await onCreated();
      setMessage({
        type: "success",
        text: `Created ${result.assignmentCount} assignment rows and ${result.recipientCount} recipient rows in ${result.classroom.name}.`,
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      setSelectedChapterIds([]);
      setSelectedStudentIds([]);
    } catch (error) {
      const typedError = error as Error;
      setMessage({
        type: "error",
        text: typedError.message || "Failed to create chapter assignments.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (dashboard.scope.type === "master_global") {
    return (
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-bold">Create Assignment is admin-only for v1.</p>
        <p className="mt-1">Master users are excluded until master assignment behavior is defined.</p>
      </div>
    );
  }

  if (classroomState.status === "loading") {
    return (
      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-slate-700 shadow-sm">
        Loading admin classroom setup...
      </div>
    );
  }

  if (classroomState.status === "duplicate") {
    return (
      <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 shadow-sm">
        <p className="font-bold">Administrator classroom configuration issue. Please contact support.</p>
      </div>
    );
  }

  if (classroomState.status === "missing") {
    return (
      <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-slate-700 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Create Assignment</p>
        <h3 className="mt-1 text-xl font-extrabold text-slate-950">Set up your admin classroom</h3>
        <p className="mt-2">Create your admin classroom before assigning chapters. This is a one-time setup step.</p>
        {message ? (
          <div className={`mt-4 rounded-xl border p-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {message.text}
          </div>
        ) : null}
        <button
          type="button"
          disabled={setupLoading}
          onClick={() => void handleCreateAdminClassroom()}
          className="mt-5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {setupLoading ? "Creating..." : "Create My Admin Classroom"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Create Assignment</p>
        <h3 className="mt-1 text-xl font-extrabold text-slate-950">Assign chapters to your admin classroom</h3>
        <p className="mt-2 text-sm text-slate-700">
          No classroom dropdown is shown. Assignments will be created in your admin classroom.
        </p>
      </div>

      {message ? (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message.text}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="block text-sm font-semibold text-slate-700 lg:col-span-2">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Chapter 1 Practice"
            required
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700 lg:col-span-3">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none"
            placeholder="Optional instructions for students"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold text-slate-950">Chapters</p>
          <div className="mt-2 grid max-h-72 gap-2 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
            {CHAPTERS.map((chapter) => (
              <label key={chapter.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedChapterIds.includes(chapter.id)}
                  onChange={() => toggleChapter(chapter.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Chapter {chapter.number}: {chapter.title}</span>
                  <span className="text-xs text-slate-600">{SECTIONS.filter((section) => section.chapterId === chapter.id).length} sections</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-950">Active organization students</p>
          <div className="mt-2 max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
            {activeStudents.length === 0 ? (
              <p className="text-sm text-slate-600">No active students are available in this administrator scope.</p>
            ) : activeStudents.map((student) => (
              <label key={student.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">{displayName(student)}</span>
                  <span className="text-xs text-slate-600">{student.email ?? "No email"}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="font-bold text-slate-950">Creation summary</h4>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <SummaryStat label="Selected chapters" value={selectedChapterIds.length} />
          <SummaryStat label="Resulting sections" value={selectedSections.length} />
          <SummaryStat label="Selected students" value={selectedStudents.length} />
          <SummaryStat label="Assignment rows" value={totalAssignmentRows} />
          <SummaryStat label="Recipient rows" value={totalRecipientRows} />
        </div>
        <div className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
          <p><span className="font-semibold">Chapters:</span> {selectedChapterIds.length ? CHAPTERS.filter((chapter) => selectedChapterIds.includes(chapter.id)).map((chapter) => `Chapter ${chapter.number}`).join(", ") : "None selected"}</p>
          <p><span className="font-semibold">Students:</span> {selectedStudents.length ? selectedStudents.map(displayName).join(", ") : "None selected"}</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !title.trim() || selectedChapterIds.length === 0 || selectedStudentIds.length === 0}
        className="mt-5 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Creating..." : "Create chapter assignments"}
      </button>
    </form>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

function AssignmentsTable({
  assignments,
  students,
  classroomManagement,
  onRefreshDashboard,
  onRefreshClassroomManagement,
}: {
  assignments: AdminDashboardAssignment[];
  students: AdminDashboardStudent[];
  classroomManagement: AdminClassroomManagement | null;
  onRefreshDashboard: () => Promise<void>;
  onRefreshClassroomManagement: () => Promise<void>;
}) {
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | "overall" | null>(null);
  const [updatingRecipientKey, setUpdatingRecipientKey] = useState<string | null>(null);
  const [recipientMutationMessage, setRecipientMutationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedAddCandidateId, setSelectedAddCandidateId] = useState("");

  useEffect(() => {
    setSelectedAddCandidateId("");
  }, [expandedAssignmentId, selectedSectionId]);

  async function handleRecipientAction(
    assignmentId: string,
    recipient: AdminAssignmentRecipient,
    action: AdminAssignmentRecipientAction,
  ) {
    const mutationKey = `${assignmentId}:${recipient.userId}`;
    setUpdatingRecipientKey(mutationKey);
    setRecipientMutationMessage(null);

    try {
      await updateAdminAssignmentRecipient(assignmentId, recipient.userId, action);
      await onRefreshDashboard();
      setRecipientMutationMessage({
        type: "success",
        text:
          action === "excuse"
            ? "Recipient excused successfully."
            : "Recipient unexcused successfully.",
      });
    } catch (error) {
      const typedError = error as Error;
      setRecipientMutationMessage({
        type: "error",
        text: typedError.message || "Failed to update assignment recipient.",
      });
    } finally {
      setUpdatingRecipientKey(null);
    }
  }


  async function handleOverallRecipientAction(
    groupId: string,
    recipient: OverallAssignmentRecipient,
    action: AdminAssignmentRecipientAction,
  ) {
    const mutationKey = `overall:${groupId}:${recipient.userId}`;
    setUpdatingRecipientKey(mutationKey);
    setRecipientMutationMessage(null);

    try {
      await updateAdminAssignmentRecipientsBulk(
        recipient.assignmentIds,
        recipient.userId,
        action,
      );
      await onRefreshDashboard();
      setRecipientMutationMessage({
        type: "success",
        text:
          action === "excuse"
            ? "Recipient excused from all sections successfully."
            : "Recipient unexcused from all sections successfully.",
      });
    } catch (error) {
      const typedError = error as Error;
      setRecipientMutationMessage({
        type: "error",
        text: typedError.message || "Failed to update assignment recipients.",
      });
    } finally {
      setUpdatingRecipientKey(null);
    }
  }

  async function handleAddSectionRecipient(
    assignmentId: string,
    userId: string,
    addToClassroomIfNeeded: boolean,
  ) {
    if (!userId) return;
    const mutationKey = `add:${assignmentId}`;
    setUpdatingRecipientKey(mutationKey);
    setRecipientMutationMessage(null);

    try {
      await addAdminAssignmentRecipient(assignmentId, userId, { addToClassroomIfNeeded });
      await Promise.all([onRefreshDashboard(), onRefreshClassroomManagement()]);
      setRecipientMutationMessage({
        type: "success",
        text: addToClassroomIfNeeded
          ? "Student added to class and assignment successfully."
          : "Recipient added successfully.",
      });
      setSelectedAddCandidateId("");
    } catch (error) {
      const typedError = error as Error;
      setRecipientMutationMessage({
        type: "error",
        text: typedError.message || "Failed to add assignment recipient.",
      });
    } finally {
      setUpdatingRecipientKey(null);
    }
  }

  async function handleAddOverallRecipient(
    assignmentIds: string[],
    userId: string,
    addToClassroomIfNeeded: boolean,
  ) {
    if (!userId) return;
    const mutationKey = `add:overall`;
    setUpdatingRecipientKey(mutationKey);
    setRecipientMutationMessage(null);

    try {
      await addAdminAssignmentRecipientsBulk(assignmentIds, userId, { addToClassroomIfNeeded });
      await Promise.all([onRefreshDashboard(), onRefreshClassroomManagement()]);
      setRecipientMutationMessage({
        type: "success",
        text: addToClassroomIfNeeded
          ? "Student added to class and all section assignments successfully."
          : "Recipient added to all sections successfully.",
      });
      setSelectedAddCandidateId("");
    } catch (error) {
      const typedError = error as Error;
      setRecipientMutationMessage({
        type: "error",
        text: typedError.message || "Failed to add assignment recipients.",
      });
    } finally {
      setUpdatingRecipientKey(null);
    }
  }

  if (assignments.length === 0)
    return (
      <EmptyTableMessage>
        No Regents Algebra 1 assignments found for this administrator scope.
      </EmptyTableMessage>
    );

  const expandedAssignment = assignments.find(
    (assignment) => assignment.id === expandedAssignmentId,
  );
  const selectedSection =
    selectedSectionId === "overall"
      ? null
      : expandedAssignment?.sectionAssignments.find(
          (assignment) => assignment.id === selectedSectionId,
        ) ?? expandedAssignment?.sectionAssignments[0];
  const overallSummary = expandedAssignment
    ? getOverallAssignmentSummary(expandedAssignment)
    : null;
  const expandedClassroom = expandedAssignment && classroomManagement
    ? classroomManagement.classrooms.find(
        (classroom) => classroom.id === expandedAssignment.classroomId,
      ) ?? null
    : null;
  const activeRoster = expandedClassroom?.roster.filter((member) => member.isActive) ?? [];
  const classroomRosterIds = new Set(activeRoster.map((member) => member.userId));
  const selectedSectionRecipientIds = new Set(
    selectedSection?.recipients.map((recipient) => recipient.userId) ?? [],
  );
  const overallRecipientIds = new Set(
    overallSummary?.recipients.map((recipient) => recipient.userId) ?? [],
  );
  const addCandidates: AssignmentAddCandidate[] = expandedClassroom
    ? students
        .filter((student) => student.isActive)
        .map((student) => ({
          userId: student.id,
          fullName: student.fullName,
          email: student.email,
          inClassroom: classroomRosterIds.has(student.id),
          alreadyAssigned:
            selectedSectionId === "overall"
              ? overallRecipientIds.has(student.id)
              : selectedSectionRecipientIds.has(student.id),
        }))
        .sort((a, b) =>
          (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""),
        )
    : [];
  const selectedAddCandidate = addCandidates.find(
    (candidate) => candidate.userId === selectedAddCandidateId,
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Teacher</th>
              <th className="px-4 py-3">Classroom</th>
              <th className="px-4 py-3">Sections</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Avg. Section Progress</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {assignments.map((assignment) => {
              const isExpanded = expandedAssignmentId === assignment.id;

              return (
                <tr key={assignment.id} className={isExpanded ? "bg-blue-50/60" : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">
                      {assignment.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {assignment.description || "No description"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {assignment.archivedAt ? "Archived" : "Active"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {assignment.teacherName || assignment.teacherEmail || "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    {assignment.classroomName ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    {assignment.sectionCount} {assignment.sectionCount === 1 ? "section" : "sections"}
                  </td>
                  <td className="px-4 py-3">{formatDate(assignment.dueDate)}</td>
                  <td className="px-4 py-3">{assignment.recipientCount}</td>
                  <td className="px-4 py-3">
                    {assignment.completedCount} complete · {assignment.incompleteCount} incomplete · {assignment.excusedCount} excused
                  </td>
                  <td className="px-4 py-3">
                    {formatPercent(assignment.averageProgress)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedAssignmentId(null);
                          setSelectedSectionId(null);
                          return;
                        }
                        setExpandedAssignmentId(assignment.id);
                        setSelectedSectionId("overall");
                      }}
                      className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                    >
                      {isExpanded ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {expandedAssignment ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
                Assignment detail · limited recipient actions
              </p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-950">
                {expandedAssignment.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {expandedAssignment.classroomName ?? "Unknown classroom"} · {expandedAssignment.teacherName || expandedAssignment.teacherEmail || "Unknown teacher"}
              </p>
            </div>
            <div className="text-sm text-slate-700">
              <p>{expandedAssignment.sectionCount} section{expandedAssignment.sectionCount === 1 ? "" : "s"}</p>
              <p>{expandedAssignment.recipientCount} total recipients</p>
            </div>
          </div>

          {recipientMutationMessage ? (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                recipientMutationMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {recipientMutationMessage.text}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedSectionId("overall");
              }}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${selectedSectionId === "overall" ? "border-blue-700 bg-blue-700 text-white" : "border-blue-200 bg-white text-blue-800"}`}
            >
              Overall
            </button>
            {expandedAssignment.sectionAssignments.map((sectionAssignment) => (
              <button
                type="button"
                key={sectionAssignment.id}
                onClick={() => {
                  setSelectedSectionId(sectionAssignment.id);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${selectedSection?.id === sectionAssignment.id ? "border-blue-700 bg-blue-700 text-white" : "border-blue-200 bg-white text-blue-800"}`}
              >
                {sectionAssignment.sectionTitle}
              </button>
            ))}
          </div>

          {selectedSectionId === "overall" && overallSummary ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 text-sm text-slate-800 md:grid-cols-5">
                <div>
                  <p className="font-bold text-slate-950">Sections</p>
                  <p>{expandedAssignment.sectionCount}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">Unique recipients</p>
                  <p>{expandedAssignment.recipientCount}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">Statuses</p>
                  <p>{expandedAssignment.completedCount} complete · {expandedAssignment.incompleteCount} incomplete · {expandedAssignment.excusedCount} excused</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">Avg. section progress</p>
                  <p>{formatPercent(expandedAssignment.averageProgress)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">Avg. accuracy</p>
                  <p>{formatPercent(overallSummary.accuracyPercent)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-sm font-bold text-slate-950">
                  Add recipient to all sections
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Adds an active organization student to every section assignment in this group.
                  Students not currently in the classroom are enrolled first.
                </p>
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-3 sm:flex-row sm:items-end">
                  <label className="flex-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Eligible student
                    <select
                      value={selectedAddCandidateId}
                      onChange={(event) =>
                        setSelectedAddCandidateId(event.target.value)
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Select a student...</option>
                      {addCandidates.map((candidate) => (
                        <option key={candidate.userId} value={candidate.userId}>
                          {displayName({
                            fullName: candidate.fullName,
                            email: candidate.email,
                          })}{" "}
                          · {candidate.email ?? "No email"} ·{" "}
                          {candidate.alreadyAssigned
                            ? "Already assigned"
                            : candidate.inClassroom
                              ? "In class"
                              : "Not in class"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedAddCandidate?.alreadyAssigned ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 disabled:cursor-not-allowed"
                    >
                      Already assigned
                    </button>
                  ) : selectedAddCandidate ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleAddOverallRecipient(
                          expandedAssignment.assignmentIds,
                          selectedAddCandidate.userId,
                          !selectedAddCandidate.inClassroom,
                        )
                      }
                      disabled={updatingRecipientKey === "add:overall"}
                      className="rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingRecipientKey === "add:overall"
                        ? "Adding..."
                        : selectedAddCandidate.inClassroom
                          ? "Add to assignment"
                          : "Add student to class and assignment"}
                    </button>
                  ) : null}
                </div>
                {expandedClassroom && addCandidates.length === 0 ? (
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    No active organization students are available to add to all sections.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Recipient</th>
                      <th className="px-3 py-2">Overall status</th>
                      <th className="px-3 py-2">Avg. completion</th>
                      <th className="px-3 py-2">Avg. accuracy</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {overallSummary.recipients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-slate-700">
                          No recipients found for this grouped assignment.
                        </td>
                      </tr>
                    ) : (
                      overallSummary.recipients.map((recipient) => {
                        const recipientAction = getOverallRecipientAction(recipient);
                        const mutationKey = `overall:${expandedAssignment.id}:${recipient.userId}`;
                        const isUpdating = updatingRecipientKey === mutationKey;

                        return (
                          <tr
                            key={recipient.userId}
                            className={
                              recipient.status === "excused"
                                ? "bg-amber-50/70"
                                : undefined
                            }
                          >
                            <td className="px-3 py-2">
                              <p className="font-semibold text-slate-950">
                                {displayName({ fullName: recipient.fullName, email: recipient.email })}
                              </p>
                              <p className="text-xs text-slate-600">{recipient.email ?? "No email"}</p>
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                  recipient.status === "excused"
                                    ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                                    : recipient.status === "mixed"
                                      ? "bg-purple-100 text-purple-900 ring-1 ring-purple-300"
                                      : "bg-slate-100 text-slate-800 ring-1 ring-slate-200"
                                }`}
                              >
                                {formatAssignmentStatus(recipient.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">{formatPercent(recipient.completionPercent)}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{formatPercent(recipient.accuracyPercent)}</td>
                            <td className="px-3 py-2">
                              {recipientAction ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleOverallRecipientAction(
                                      expandedAssignment.id,
                                      recipient,
                                      recipientAction.action,
                                    )
                                  }
                                  disabled={isUpdating}
                                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isUpdating ? "Updating..." : recipientAction.label}
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-slate-500">
                                  {recipient.status === "mixed" ? "Mixed statuses" : "No action"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {selectedSection ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-4">
                <div>
                  <p className="font-bold text-slate-950">Section</p>
                  <p>{selectedSection.sectionTitle}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">Due</p>
                  <p>{formatDate(selectedSection.dueDate)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">Created</p>
                  <p>{formatDateTime(selectedSection.createdAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">Status</p>
                  <p>{selectedSection.archivedAt ? "Archived" : "Active"}</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-sm font-bold text-slate-950">
                  Add recipient to this section
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Adds an active organization student to only this section assignment.
                  Students not currently in the classroom are enrolled first.
                </p>
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-3 sm:flex-row sm:items-end">
                  <label className="flex-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Eligible student
                    <select
                      value={selectedAddCandidateId}
                      onChange={(event) =>
                        setSelectedAddCandidateId(event.target.value)
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Select a student...</option>
                      {addCandidates.map((candidate) => (
                        <option key={candidate.userId} value={candidate.userId}>
                          {displayName({
                            fullName: candidate.fullName,
                            email: candidate.email,
                          })}{" "}
                          · {candidate.email ?? "No email"} ·{" "}
                          {candidate.alreadyAssigned
                            ? "Already assigned"
                            : candidate.inClassroom
                              ? "In class"
                              : "Not in class"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedAddCandidate?.alreadyAssigned ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 disabled:cursor-not-allowed"
                    >
                      Already assigned
                    </button>
                  ) : selectedAddCandidate ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleAddSectionRecipient(
                          selectedSection.id,
                          selectedAddCandidate.userId,
                          !selectedAddCandidate.inClassroom,
                        )
                      }
                      disabled={updatingRecipientKey === `add:${selectedSection.id}`}
                      className="rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingRecipientKey === `add:${selectedSection.id}`
                        ? "Adding..."
                        : selectedAddCandidate.inClassroom
                          ? "Add to assignment"
                          : "Add student to class and assignment"}
                    </button>
                  ) : null}
                </div>
                {expandedClassroom && addCandidates.length === 0 ? (
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    No active organization students are available to add to this section.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Recipient</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Assigned</th>
                      <th className="px-3 py-2">Completed</th>
                      <th className="px-3 py-2">Completion</th>
                      <th className="px-3 py-2">Accuracy</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {selectedSection.recipients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-3 text-slate-700">
                          No recipients found for this section assignment.
                        </td>
                      </tr>
                    ) : (
                      selectedSection.recipients.map((recipient) => {
                        const mutationKey = `${selectedSection.id}:${recipient.userId}`;
                        const isUpdating = updatingRecipientKey === mutationKey;
                        const canExcuse = recipient.status === "assigned";
                        const canUnexcuse = recipient.status === "excused";

                        return (
                          <tr
                            key={recipient.userId}
                            className={
                              recipient.status === "excused"
                                ? "bg-amber-50/70"
                                : undefined
                            }
                          >
                            <td className="px-3 py-2">
                              <p className="font-semibold text-slate-950">
                                {displayName({ fullName: recipient.fullName, email: recipient.email })}
                              </p>
                              <p className="text-xs text-slate-600">{recipient.email ?? "No email"}</p>
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                  recipient.status === "excused"
                                    ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                                    : "bg-slate-100 text-slate-800 ring-1 ring-slate-200"
                                }`}
                              >
                                {formatAssignmentStatus(recipient.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">{formatDateTime(recipient.assignedAt)}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{formatDateTime(recipient.completedAt)}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{formatPercent(recipient.completionPercent)}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{formatPercent(recipient.accuracyPercent)}</td>
                            <td className="px-3 py-2">
                              {canExcuse || canUnexcuse ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRecipientAction(
                                      selectedSection.id,
                                      recipient,
                                      canExcuse ? "excuse" : "unexcuse",
                                    )
                                  }
                                  disabled={isUpdating}
                                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isUpdating
                                    ? "Updating..."
                                    : canExcuse
                                      ? "Excuse"
                                      : "Unexcuse"}
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-slate-500">
                                  No action
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
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

function ActivityList({
  activities,
  showStudent = false,
  onSelectAssignment,
}: {
  activities: AdminDashboardActivity[];
  showStudent?: boolean;
  onSelectAssignment?: (activity: AdminDashboardActivity) => void;
}) {
  if (activities.length === 0) {
    return (
      <p className="mt-2 text-sm text-slate-600">No activity found.</p>
    );
  }

  return (
    <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-2 text-sm">
      {activities.map((activity, index) => {
        const content = (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                {showStudent ? (
                  <p className="text-xs font-bold uppercase tracking-wide opacity-70">
                    {activity.studentName || activity.studentEmail || "Student"}
                  </p>
                ) : null}
                <p className="font-semibold">{activity.label}</p>
              </div>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                {activity.type}
              </span>
            </div>
            <p className="mt-1">{activity.detail}</p>
            {activity.type === "assignment" ? (
              <div className="mt-1 space-y-0.5 text-xs opacity-80">
                <p>Assigned: {formatDateTime(activity.assignedAt)}</p>
                {activity.completedAt ? (
                  <p>Completed: {formatDateTime(activity.completedAt)}</p>
                ) : null}
              </div>
            ) : null}
            <p className="mt-1 text-xs opacity-70">
              {formatDateTime(activity.occurredAt)}
            </p>
          </>
        );
        const clickable = activity.type === "assignment" && onSelectAssignment;

        return (
          <li
            key={`${activity.type}-${activity.studentId ?? "student"}-${activity.label}-${activity.occurredAt ?? index}`}
            className={`rounded-xl border p-3 ${getActivityClassName(activity)}`}
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onSelectAssignment(activity)}
                className="block w-full text-left"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AttemptsList({
  attempts,
}: {
  attempts: AdminDashboardStudentDetail["recentQuestionAttempts"];
}) {
  if (attempts.length === 0) {
    return (
      <p className="mt-2 text-sm text-slate-600">No recent attempts found.</p>
    );
  }

  return (
    <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-2 text-sm text-slate-700">
      {attempts.map((attempt, index) => (
        <li
          key={`${attempt.questionId ?? "question"}-${attempt.attemptedAt ?? index}`}
          className={`rounded-xl border p-3 ${attempt.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
        >
          <p
            className={`font-semibold ${attempt.correct ? "text-emerald-950" : "text-rose-950"}`}
          >
            {attempt.correct ? "Correct" : "Incorrect"} · {attempt.chapterTitle}
          </p>
          <p className="text-xs text-slate-600">{attempt.sectionTitle}</p>
          <p className="text-xs text-slate-500">
            {attempt.questionId ? `Question ${attempt.questionId} · ` : ""}
            {formatDateTime(attempt.attemptedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function WholeSchoolActivityPanel({
  activities,
}: {
  activities: AdminDashboardActivity[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
        Whole-School Activity
      </p>
      <h3 className="mt-1 text-2xl font-extrabold text-slate-950">
        Recent Regents Algebra 1 activity
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        Select a student Details button to view a single-student read-only
        detail panel.
      </p>
      <ActivityList activities={activities} showStudent />
    </div>
  );
}

function StudentDetailPanel({
  detail,
  onSelectAssignmentActivity,
}: {
  detail: AdminDashboardStudentDetail | null;
  onSelectAssignmentActivity: (activity: AdminDashboardActivity) => void;
}) {
  if (!detail) return null;
  return (
    <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
          Student detail
        </p>
        <h3 className="mt-1 text-2xl font-extrabold text-slate-950">
          {displayName({ fullName: detail.fullName, email: detail.email })}
        </h3>
        <p className="text-sm text-slate-600">{detail.email ?? "No email"}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Assigned Sections" value={detail.assignedWorkCount} />
        <DashboardCard
          label="Completion"
          value={formatPercent(detail.overallCompletion)}
        />
        <DashboardCard
          label="Accuracy"
          value={formatPercent(detail.overallAccuracy)}
        />
        <DashboardCard
          label="Attempts"
          value={detail.totalQuestionAttempts}
          help={`${detail.correctAttempts} correct · ${detail.incorrectAttempts} incorrect`}
        />
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Classrooms</h4>
        {detail.classrooms.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No classrooms found.</p>
        ) : (
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-2 text-sm text-slate-700">
            {detail.classrooms.map((classroom) => (
              <li
                key={classroom.id}
                className="rounded-xl border border-slate-200 p-3"
              >
                <p className="font-semibold text-slate-950">{classroom.name}</p>
                <p className="text-xs text-slate-500">
                  {classroom.teacherName ||
                    classroom.teacherEmail ||
                    "Unknown teacher"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Attempt History</h4>
        <AttemptsList attempts={detail.recentQuestionAttempts} />
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Activity</h4>
        <ActivityList
          activities={detail.recentActivity}
          onSelectAssignment={onSelectAssignmentActivity}
        />
      </div>
    </div>
  );
}

function StudentAssignmentSummaryPanel({
  detail,
  activity,
  onBack,
}: {
  detail: AdminDashboardStudentDetail;
  activity: AdminDashboardActivity;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
            Student Assignment Summary
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-slate-950">
            {activity.label}
          </h3>
          <p className="text-sm text-slate-600">
            {displayName({ fullName: detail.fullName, email: detail.email })}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50"
        >
          Back to Overall
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Status" value={activity.status ?? "assigned"} />
        <DashboardCard
          label="Completion"
          value={formatPercent(activity.completionPercent)}
        />
        <DashboardCard
          label="Accuracy"
          value={formatPercent(activity.accuracyPercent)}
        />
        <DashboardCard
          label="Attempts"
          value={activity.attempts ?? 0}
          help={`${activity.correctAttempts ?? 0} correct · ${activity.incorrectAttempts ?? 0} incorrect`}
        />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Assignment Details</h4>
        <dl className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-3">
            <dt className="font-semibold text-slate-500">Student</dt>
            <dd className="mt-1 text-slate-950">
              {displayName({ fullName: detail.fullName, email: detail.email })}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <dt className="font-semibold text-slate-500">Assignment</dt>
            <dd className="mt-1 text-slate-950">{activity.label}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <dt className="font-semibold text-slate-500">Chapter</dt>
            <dd className="mt-1 text-slate-950">
              {activity.chapterTitle ?? "No chapter"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <dt className="font-semibold text-slate-500">Section</dt>
            <dd className="mt-1 text-slate-950">
              {activity.sectionTitle ?? "No section"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <dt className="font-semibold text-slate-500">Assigned</dt>
            <dd className="mt-1 text-slate-950">
              {formatDateTime(activity.assignedAt)}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <dt className="font-semibold text-slate-500">Completed</dt>
            <dd className="mt-1 text-slate-950">
              {formatDateTime(activity.completedAt)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Question Attempt Summary</h4>
        <p className="mt-2 text-sm text-slate-700">
          {(activity.attempts ?? 0) > 0
            ? `${activity.attempts ?? 0} attempts · ${activity.correctAttempts ?? 0} correct · ${activity.incorrectAttempts ?? 0} incorrect`
            : "No question attempts found for this assignment section."}
        </p>
      </div>
    </div>
  );
}

function QuickAssignPanel({
  student,
  onAssigned,
}: {
  student: AdminDashboardStudentDetail;
  onAssigned: () => Promise<void>;
}) {
  const [data, setData] = useState<AdminQuickAssignData | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [archivingChapterId, setArchivingChapterId] = useState<string | null>(null);
  const [unassigningChapterId, setUnassigningChapterId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const selectedSections = useMemo(
    () => SECTIONS.filter((section) => selectedChapterIds.includes(section.chapterId)),
    [selectedChapterIds],
  );

  const assignedChapterLabels = useMemo(() => {
    const chapterNumbers = new Set(
      (data?.assignments ?? [])
        .map((assignment) => assignment.chapterNumber)
        .filter((chapterNumber): chapterNumber is number => typeof chapterNumber === "number"),
    );

    return [...chapterNumbers]
      .sort((left, right) => left - right)
      .map((chapterNumber) => `Chapter ${chapterNumber}`);
  }, [data?.assignments]);

  const loadQuickAssignData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getAdminQuickAssignData(student.studentId));
      setMessage(null);
    } catch (error) {
      const typedError = error as Error;
      setMessage({
        type: "error",
        text: typedError.message || "Failed to load Quick Assign data.",
      });
    } finally {
      setLoading(false);
    }
  }, [student.studentId]);

  useEffect(() => {
    void loadQuickAssignData();
  }, [loadQuickAssignData]);

  function toggleChapter(chapterId: string) {
    setSelectedChapterIds((current) =>
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedChapterIds.length === 0) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await createAdminQuickAssign({
        studentUserId: student.studentId,
        chapterIds: selectedChapterIds,
      });
      setMessage({
        type: "success",
        text:
          result.assignmentCount > 0
            ? `Assigned ${result.assignmentCount} new section${result.assignmentCount === 1 ? "" : "s"}.`
            : result.reactivatedRecipientCount > 0
              ? `Reactivated ${result.reactivatedRecipientCount} previously hidden section${result.reactivatedRecipientCount === 1 ? "" : "s"}.`
              : "Selected chapters were already assigned for this student.",
      });
      setSelectedChapterIds([]);
      await Promise.all([loadQuickAssignData(), onAssigned()]);
    } catch (error) {
      const typedError = error as Error;
      setMessage({
        type: "error",
        text: typedError.message || "Failed to create Quick Assignments.",
      });
    } finally {
      setSubmitting(false);
    }
  }


  async function handleArchiveChapter(chapterId: string, chapterLabel: string) {
    const confirmed = window.confirm(
      `Archive this chapter?

The chapter will move to Archived Chapters.
Progress and history will be preserved.

${chapterLabel} for ${displayName({ fullName: student.fullName, email: student.email })}`,
    );
    if (!confirmed) return;

    setArchivingChapterId(chapterId);
    setMessage(null);

    try {
      const result = await archiveAdminQuickAssignChapter({
        studentUserId: student.studentId,
        chapterId,
      });
      setMessage({
        type: "success",
        text:
          result.archivedRecipientCount > 0
            ? `Archived ${chapterLabel}. History is preserved below.`
            : `${chapterLabel} did not have active Quick Assign sections to archive.`,
      });
      await Promise.all([loadQuickAssignData(), onAssigned()]);
    } catch (error) {
      const typedError = error as Error;
      setMessage({
        type: "error",
        text: typedError.message || "Failed to archive Quick Assign chapter.",
      });
    } finally {
      setArchivingChapterId(null);
    }
  }


  async function handleUnassignChapter(chapterId: string, chapterLabel: string) {
    const confirmed = window.confirm(
      `Unassign this chapter?

The chapter will be removed from the student's assigned Quick Assign work.

Progress and attempt history will remain available.

The student will stay in Quick Class.

${chapterLabel} for ${displayName({ fullName: student.fullName, email: student.email })}`,
    );
    if (!confirmed) return;

    setUnassigningChapterId(chapterId);
    setMessage(null);

    try {
      const result = await unassignAdminQuickAssignChapter({
        studentUserId: student.studentId,
        chapterId,
      });
      setMessage({
        type: "success",
        text:
          result.unassignedRecipientCount > 0
            ? `Unassigned ${chapterLabel}. Progress and attempt history are preserved.`
            : `${chapterLabel} did not have active Quick Assign sections to unassign.`,
      });
      await Promise.all([loadQuickAssignData(), onAssigned()]);
    } catch (error) {
      const typedError = error as Error;
      setMessage({
        type: "error",
        text: typedError.message || "Failed to unassign Quick Assign chapter.",
      });
    } finally {
      setUnassigningChapterId(null);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
            Quick Assign
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-slate-950">
            {displayName({ fullName: student.fullName, email: student.email })}
          </h3>
          <p className="text-sm text-slate-600">{student.email ?? "No email"}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadQuickAssignData()}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-50"
        >
          Refresh
        </button>
      </div>

      {message ? (
        <div
          className={`rounded-xl border p-3 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-200 bg-white text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {loading ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading Quick Assign data...
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          label="Assigned chapters"
          value={data?.metrics.chapterCount ?? 0}
          help={assignedChapterLabels.length ? assignedChapterLabels.join(", ") : "No quick chapters yet"}
        />
        <DashboardCard
          label="Assigned sections"
          value={data?.metrics.sectionCount ?? 0}
        />
        <DashboardCard
          label="Completion"
          value={formatPercent(data?.metrics.completionPercent)}
        />
        <DashboardCard
          label="Accuracy"
          value={formatPercent(data?.metrics.accuracyPercent)}
        />
        <DashboardCard
          label="Attempts"
          value={data?.metrics.attempts ?? 0}
        />
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h4 className="font-bold text-slate-950">Assign chapters</h4>
          <p className="mt-1 text-sm text-slate-600">
            Select one or more chapters. The system will create section assignments
            in Quick Class, auto-enroll this student if needed, and use no due date.
          </p>
        </div>
        <div className="mt-3 grid max-h-72 gap-2 overflow-auto rounded-xl border border-slate-200 p-3">
          {CHAPTERS.map((chapter) => (
            <label key={chapter.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedChapterIds.includes(chapter.id)}
                onChange={() => toggleChapter(chapter.id)}
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-slate-950">
                  Chapter {chapter.number}: {chapter.title}
                </span>
                <span className="text-xs text-slate-600">
                  {SECTIONS.filter((section) => section.chapterId === chapter.id).length} sections
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-slate-700">
          <p>
            <span className="font-bold text-slate-950">Selected chapters:</span>{" "}
            {selectedChapterIds.length}
          </p>
          <p>
            <span className="font-bold text-slate-950">Resulting sections:</span>{" "}
            {selectedSections.length}
          </p>
          <p>
            <span className="font-bold text-slate-950">Due date:</span> No date
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting || selectedChapterIds.length === 0}
          className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Assigning..." : "Assign selected chapters"}
        </button>
      </form>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-950">Assigned Chapters</h4>
        {!data || data.chapters.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            No chapters have been assigned for this student yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.chapters.map((chapter) => (
              <details
                key={chapter.chapterId}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 open:bg-white"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-slate-950">
                        Chapter {chapter.chapterNumber}: {chapter.chapterTitle}
                      </p>
                      <p className="text-sm text-slate-600">
                        {chapter.sectionCount} section{chapter.sectionCount === 1 ? "" : "s"} assigned
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            void handleArchiveChapter(
                              chapter.chapterId,
                              `Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`,
                            );
                          }}
                          disabled={archivingChapterId === chapter.chapterId}
                          className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {archivingChapterId === chapter.chapterId ? "Archiving..." : "Archive"}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            void handleUnassignChapter(
                              chapter.chapterId,
                              `Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`,
                            );
                          }}
                          disabled={unassigningChapterId === chapter.chapterId}
                          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {unassigningChapterId === chapter.chapterId ? "Unassigning..." : "Unassign"}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Progress</span>
                        <span className="font-bold text-slate-950">{formatPercent(chapter.completionPercent)}</span>
                      </span>
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Accuracy</span>
                        <span className="font-bold text-slate-950">{formatPercent(chapter.accuracyPercent)}</span>
                      </span>
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Attempts</span>
                        <span className="font-bold text-slate-950">{chapter.attempts}</span>
                      </span>
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Sections</span>
                        <span className="font-bold text-slate-950">{chapter.sectionCount}</span>
                      </span>
                    </div>
                  </div>
                </summary>

                <div className="mt-4 overflow-x-auto border-t border-slate-200 pt-4">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Completion</th>
                        <th className="px-3 py-2">Accuracy</th>
                        <th className="px-3 py-2">Attempts</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {chapter.sections.map((section) => (
                        <tr key={section.id}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">
                              {section.sectionNumber ? `Section ${section.sectionNumber}` : section.sectionId}
                            </p>
                            <p className="text-xs text-slate-500">{section.sectionTitle}</p>
                          </td>
                          <td className="px-3 py-2">{formatPercent(section.completionPercent)}</td>
                          <td className="px-3 py-2">{formatPercent(section.accuracyPercent)}</td>
                          <td className="px-3 py-2">{section.attempts}</td>
                          <td className="px-3 py-2">{formatAssignmentStatus(section.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-950">Archived Chapters</h4>
            <p className="text-sm text-slate-600">Archived work is hidden from active metrics but history remains available.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
            {data?.archivedMetrics.chapterCount ?? 0} archived
          </span>
        </div>
        {!data || data.archivedChapters.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            No archived Quick Assign chapters for this student yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.archivedChapters.map((chapter) => (
              <details
                key={chapter.chapterId}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 open:bg-white"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-slate-950">
                        Chapter {chapter.chapterNumber}: {chapter.chapterTitle}
                      </p>
                      <p className="text-sm text-slate-600">
                        {chapter.sectionCount} archived section{chapter.sectionCount === 1 ? "" : "s"}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                        Archived
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Progress</span>
                        <span className="font-bold text-slate-950">{formatPercent(chapter.completionPercent)}</span>
                      </span>
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Accuracy</span>
                        <span className="font-bold text-slate-950">{formatPercent(chapter.accuracyPercent)}</span>
                      </span>
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Attempts</span>
                        <span className="font-bold text-slate-950">{chapter.attempts}</span>
                      </span>
                      <span className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <span className="block text-xs font-bold uppercase text-slate-500">Sections</span>
                        <span className="font-bold text-slate-950">{chapter.sectionCount}</span>
                      </span>
                    </div>
                  </div>
                </summary>

                <div className="mt-4 overflow-x-auto border-t border-slate-200 pt-4">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Completion</th>
                        <th className="px-3 py-2">Accuracy</th>
                        <th className="px-3 py-2">Attempts</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {chapter.sections.map((section) => (
                        <tr key={section.id}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">
                              {section.sectionNumber ? `Section ${section.sectionNumber}` : section.sectionId}
                            </p>
                            <p className="text-xs text-slate-500">{section.sectionTitle}</p>
                          </td>
                          <td className="px-3 py-2">{formatPercent(section.completionPercent)}</td>
                          <td className="px-3 py-2">{formatPercent(section.accuracyPercent)}</td>
                          <td className="px-3 py-2">{section.attempts}</td>
                          <td className="px-3 py-2">{formatAssignmentStatus(section.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    status: "loading",
  });
  const [approvalCenterState, setApprovalCenterState] =
    useState<ApprovalCenterState>({ status: "idle" });
  const [userDirectoryState, setUserDirectoryState] =
    useState<UserDirectoryState>({ status: "idle" });
  const [classroomManagementState, setClassroomManagementState] =
    useState<ClassroomManagementState>({ status: "idle" });
  const [userDirectorySearch, setUserDirectorySearch] = useState("");
  const [userDirectoryRoleFilter, setUserDirectoryRoleFilter] =
    useState<UserDirectoryRoleFilter>("all");
  const [userDirectoryApprovalFilter, setUserDirectoryApprovalFilter] =
    useState<UserDirectoryApprovalFilter>("all");
  const [userDirectoryActivationFilter, setUserDirectoryActivationFilter] =
    useState<UserDirectoryActivationFilter>("all");
  const [activationMessage, setActivationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [updatingUserActivationId, setUpdatingUserActivationId] = useState<
    string | null
  >(null);
  const [updatingApprovalRequestId, setUpdatingApprovalRequestId] = useState<
    string | null
  >(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );
  const [selectedStudentMode, setSelectedStudentMode] =
    useState<StudentPanelMode>("whole_school");
  const [selectedAssignmentActivity, setSelectedAssignmentActivity] =
    useState<AdminDashboardActivity | null>(null);
  const [selectedManagedClassroomId, setSelectedManagedClassroomId] = useState<
    string | null
  >(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [classroomMemberMutation, setClassroomMemberMutation] =
    useState<ClassroomMemberMutation>(null);
  const [classroomMutationMessage, setClassroomMutationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const studentPanelContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedStudentMode !== "assignment_summary") return;

    const animationFrameId = window.requestAnimationFrame(() => {
      studentPanelContentRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [selectedStudentMode, selectedAssignmentActivity]);

  const loadClassroomManagement = useCallback(
    async (classroomId?: string | null, search?: string) => {
      setClassroomManagementState((current) =>
        current.status === "allowed" ? current : { status: "loading" },
      );
      try {
        const data = await getAdminClassroomManagement({
          classroomId: classroomId ?? null,
          search: search ?? "",
        });
        setClassroomManagementState({ status: "allowed", data });
        setSelectedManagedClassroomId(
          (current) =>
            current && data.classrooms.some((classroom) => classroom.id === current)
              ? current
              : (data.classrooms[0]?.id ?? null),
        );
      } catch (error) {
        const typedError = error as Error & { status?: number; code?: string };
        if (typedError.status === 401 || typedError.code === "unauthorized") {
          router.push("/login");
          return;
        }
        setClassroomManagementState({
          status: "error",
          message:
            typedError.message || "Failed to load classroom management data.",
        });
      }
    },
    [router],
  );

  const loadApprovalCenter = useCallback(async () => {
    setApprovalCenterState({ status: "loading" });
    try {
      const response = await getAdminApprovalRequests();
      setApprovalCenterState({
        status: "allowed",
        requests: response.requests,
      });
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

      setApprovalCenterState({
        status: "error",
        message: typedError.message || "Failed to load approval requests.",
      });
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
      setUserDirectoryState({
        status: "error",
        message: typedError.message || "Failed to load user directory.",
      });
    }
  }, [router]);

  const handleApprovalRequestUpdate = useCallback(
    async (requestId: string, action: "approve" | "deny") => {
      setUpdatingApprovalRequestId(requestId);
      try {
        await updateAdminApprovalRequest(requestId, action);
        await loadApprovalCenter();
      } catch (error) {
        const typedError = error as Error & { status?: number };
        setApprovalCenterState({
          status: "error",
          message: typedError.message || "Failed to update approval request.",
        });
      } finally {
        setUpdatingApprovalRequestId(null);
      }
    },
    [loadApprovalCenter],
  );

  const handleUserActivationUpdate = useCallback(
    async (profileId: string, action: AdminUserActivationAction) => {
      setUpdatingUserActivationId(profileId);
      setActivationMessage(null);
      try {
        await updateAdminUserActivation(profileId, action);
        await loadUserDirectory();
        setActivationMessage({
          type: "success",
          text:
            action === "deactivate"
              ? "User deactivated successfully."
              : "User reactivated successfully.",
        });
      } catch (error) {
        const typedError = error as Error & { status?: number; code?: string };
        if (typedError.status === 401 || typedError.code === "unauthorized") {
          router.push("/login");
          return;
        }
        setActivationMessage({
          type: "error",
          text: typedError.message || "Failed to update activation status.",
        });
      } finally {
        setUpdatingUserActivationId(null);
      }
    },
    [loadUserDirectory, router],
  );

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const dashboard = await getAdminOrgDashboard();
        if (active) {
          setDashboardState({ status: "allowed", dashboard });
          void loadApprovalCenter();
          void loadUserDirectory();
          void loadClassroomManagement(null, "");
        }
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
        if (
          typedError.code === "admin_pending" &&
          typedError.payload?.profile
        ) {
          setDashboardState({
            status: "pending",
            profile: typedError.payload.profile,
          });
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
  }, [loadApprovalCenter, loadClassroomManagement, loadUserDirectory, router]);

  const handleManagedClassroomSelect = useCallback(
    (classroomId: string) => {
      setSelectedManagedClassroomId(classroomId);
      setStudentSearchTerm("");
      setClassroomMutationMessage(null);
      void loadClassroomManagement(classroomId, "");
    },
    [loadClassroomManagement],
  );

  const handleStudentSearchTermChange = useCallback(
    (value: string) => {
      setStudentSearchTerm(value);
      void loadClassroomManagement(selectedManagedClassroomId, value);
    },
    [loadClassroomManagement, selectedManagedClassroomId],
  );

  const handleAddClassroomStudent = useCallback(
    async (userId: string) => {
      if (!selectedManagedClassroomId) return;

      setClassroomMemberMutation({ type: "add", userId });
      setClassroomMutationMessage(null);
      try {
        const result = await addAdminClassroomMember(
          selectedManagedClassroomId,
          userId,
        );
        await loadClassroomManagement(
          selectedManagedClassroomId,
          studentSearchTerm,
        );
        setClassroomMutationMessage({
          type: "success",
          text:
            result.status === "already_enrolled"
              ? "Student is already enrolled in this classroom."
              : "Student added to classroom.",
        });
      } catch (error) {
        const typedError = error as Error & { status?: number; code?: string };
        if (typedError.status === 401 || typedError.code === "unauthorized") {
          router.push("/login");
          return;
        }
        setClassroomMutationMessage({
          type: "error",
          text: typedError.message || "Failed to add student to classroom.",
        });
      } finally {
        setClassroomMemberMutation(null);
      }
    },
    [loadClassroomManagement, router, selectedManagedClassroomId, studentSearchTerm],
  );

  const handleRemoveClassroomStudent = useCallback(
    async (userId: string) => {
      if (!selectedManagedClassroomId) return;

      setClassroomMemberMutation({ type: "remove", userId });
      setClassroomMutationMessage(null);
      try {
        const result = await removeAdminClassroomMember(
          selectedManagedClassroomId,
          userId,
        );
        await loadClassroomManagement(
          selectedManagedClassroomId,
          studentSearchTerm,
        );
        setClassroomMutationMessage({
          type: "success",
          text:
            result.status === "not_found"
              ? "Student was not enrolled in this classroom."
              : "Student removed from classroom.",
        });
      } catch (error) {
        const typedError = error as Error & { status?: number; code?: string };
        if (typedError.status === 401 || typedError.code === "unauthorized") {
          router.push("/login");
          return;
        }
        setClassroomMutationMessage({
          type: "error",
          text: typedError.message || "Failed to remove student from classroom.",
        });
      } finally {
        setClassroomMemberMutation(null);
      }
    },
    [loadClassroomManagement, router, selectedManagedClassroomId, studentSearchTerm],
  );

  if (dashboardState.status === "loading")
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Administrator
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Loading organization dashboard...
          </h1>
        </div>
      </main>
    );

  if (dashboardState.status === "pending")
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            Approval pending
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Administrator approval pending
          </h1>
          <p className="mt-4 text-slate-700">
            Your administrator request has been received and is pending manual
            approval. You will not have administrator access until your account
            is approved.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Requested role:</span>{" "}
              {dashboardState.profile.requested_role}
            </p>
            <p>
              <span className="font-semibold">Approval status:</span>{" "}
              {dashboardState.profile.approval_status}
            </p>
            {dashboardState.profile.email_domain ? (
              <p>
                <span className="font-semibold">Email domain:</span>{" "}
                {dashboardState.profile.email_domain}
              </p>
            ) : null}
          </div>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    );

  if (dashboardState.status === "denied")
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
            Access denied
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Administrator access required
          </h1>
          <p className="mt-4 text-slate-700">{dashboardState.message}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    );

  const { dashboard } = dashboardState;
  const selectedStudentDetail = selectedStudentId
    ? (dashboard.studentDetails[selectedStudentId] ?? null)
    : null;

  const refreshDashboard = async () => {
    const nextDashboard = await getAdminOrgDashboard();
    setDashboardState({ status: "allowed", dashboard: nextDashboard });
  };

  const handleSelectStudentPanel = (studentId: string, mode: StudentPanelMode) => {
    setSelectedStudentId(studentId);
    setSelectedStudentMode(mode);
    setSelectedAssignmentActivity(null);
  };

  const handleSelectAssignmentActivity = (activity: AdminDashboardActivity) => {
    setSelectedAssignmentActivity(activity);
    setSelectedStudentMode("assignment_summary");
  };

  const handleSelectWholeSchoolActivity = () => {
    setSelectedStudentId(null);
    setSelectedStudentMode("whole_school");
    setSelectedAssignmentActivity(null);
  };

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-10">
      <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Administrator Dashboard
        </p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">
          Organization overview
        </h1>
        <p className="mt-4 max-w-3xl text-slate-700">
          {dashboard.scope.label}. This read-only dashboard summarizes Regents
          Algebra 1 teachers, students, classrooms, assignments, and progress
          available in your administrator scope.
        </p>
      </div>
      <ApprovalCenter
        state={approvalCenterState}
        updatingRequestId={updatingApprovalRequestId}
        onRefresh={() => void loadApprovalCenter()}
        onUpdate={(requestId, action) =>
          void handleApprovalRequestUpdate(requestId, action)
        }
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Organization"
          value={dashboard.scope.domain ?? "Global"}
          help={
            dashboard.scope.type === "master_global"
              ? "Master global admin view"
              : "Email-domain scoped"
          }
        />
        <DashboardCard
          label="Total teachers"
          value={dashboard.summary.totalTeachers}
        />
        <DashboardCard
          label="Total students"
          value={dashboard.summary.totalStudents}
        />
        <DashboardCard
          label="Total classrooms"
          value={dashboard.summary.totalClassrooms}
        />
        <DashboardCard
          label="Grouped assignments"
          value={dashboard.summary.totalGroupedAssignments}
          help={`${dashboard.summary.activeAssignments} active · ${dashboard.summary.archivedAssignments} archived`}
        />
        <DashboardCard
          label="Average completion"
          value={formatPercent(dashboard.summary.averageCompletion)}
          help="From Algebra 1 progress"
        />
        <DashboardCard
          label="Average accuracy"
          value={formatPercent(dashboard.summary.averageAccuracy)}
          help="From question attempts where available"
        />
      </div>
      <div className="mt-8 space-y-8">
        <DashboardSection title="Teachers">
          <TeachersTable teachers={dashboard.teachers} />
        </DashboardSection>
        <DashboardSection title="Students">
          <div className="grid gap-5 xl:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
            <div>
              <StudentsList
                students={dashboard.students}
                selectedStudentId={selectedStudentId}
                selectedMode={selectedStudentMode}
                onSelectOverall={(studentId) => handleSelectStudentPanel(studentId, "overall")}
                onSelectAssign={(studentId) => handleSelectStudentPanel(studentId, "assign")}
              />
            </div>
            <div ref={studentPanelContentRef} className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSelectWholeSchoolActivity}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Whole-School Activity
                </button>
              </div>
              {selectedStudentDetail && selectedStudentMode === "overall" ? (
                <StudentDetailPanel
                  detail={selectedStudentDetail}
                  onSelectAssignmentActivity={handleSelectAssignmentActivity}
                />
              ) : selectedStudentDetail && selectedStudentMode === "assign" ? (
                <QuickAssignPanel
                  student={selectedStudentDetail}
                  onAssigned={refreshDashboard}
                />
              ) : selectedStudentDetail &&
                selectedStudentMode === "assignment_summary" &&
                selectedAssignmentActivity ? (
                <StudentAssignmentSummaryPanel
                  detail={selectedStudentDetail}
                  activity={selectedAssignmentActivity}
                  onBack={() => setSelectedStudentMode("overall")}
                />
              ) : (
                <WholeSchoolActivityPanel
                  activities={dashboard.recentActivity}
                />
              )}
            </div>
          </div>
        </DashboardSection>
        <DashboardSection title="Classrooms">
          <ClassroomsTable classrooms={dashboard.classrooms} />
        </DashboardSection>
        <ClassroomManagement
          state={classroomManagementState}
          selectedClassroomId={selectedManagedClassroomId}
          studentSearchTerm={studentSearchTerm}
          mutation={classroomMemberMutation}
          mutationMessage={classroomMutationMessage}
          onSelectClassroom={handleManagedClassroomSelect}
          onStudentSearchTermChange={handleStudentSearchTermChange}
          onAddStudent={handleAddClassroomStudent}
          onRemoveStudent={handleRemoveClassroomStudent}
          onRefresh={() =>
            void loadClassroomManagement(
              selectedManagedClassroomId,
              studentSearchTerm,
            )
          }
        />
        <DashboardSection title="Assignments">
          <AdminAssignmentCreation
            dashboard={dashboard}
            onCreated={async () => {
              const refreshedDashboard = await getAdminOrgDashboard();
              setDashboardState({ status: "allowed", dashboard: refreshedDashboard });
              await loadClassroomManagement(selectedManagedClassroomId, studentSearchTerm);
            }}
          />
          <AssignmentsTable
            assignments={dashboard.assignments}
            students={dashboard.students}
            classroomManagement={
              classroomManagementState.status === "allowed"
                ? classroomManagementState.data
                : null
            }
            onRefreshDashboard={async () => {
              const refreshedDashboard = await getAdminOrgDashboard();
              setDashboardState({ status: "allowed", dashboard: refreshedDashboard });
            }}
            onRefreshClassroomManagement={() =>
              loadClassroomManagement(selectedManagedClassroomId, studentSearchTerm)
            }
          />
        </DashboardSection>
      </div>
      <UserDirectory
        state={userDirectoryState}
        searchTerm={userDirectorySearch}
        roleFilter={userDirectoryRoleFilter}
        approvalFilter={userDirectoryApprovalFilter}
        activationFilter={userDirectoryActivationFilter}
        activationMessage={activationMessage}
        updatingUserId={updatingUserActivationId}
        onSearchTermChange={setUserDirectorySearch}
        onRoleFilterChange={setUserDirectoryRoleFilter}
        onApprovalFilterChange={setUserDirectoryApprovalFilter}
        onActivationFilterChange={setUserDirectoryActivationFilter}
        onActivationUpdate={(profileId, action) =>
          void handleUserActivationUpdate(profileId, action)
        }
      />
    </main>
  );
}
