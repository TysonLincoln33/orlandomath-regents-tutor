import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AdminClassroomManagementApiError,
  type AdminClassroomManagementRouteContext,
  type ProfileRow,
  getManageableClassroom,
  getValidatedStudent,
  parseUniqueMembershipError,
} from "../classroom-management/_utils";

export const ADMIN_RECIPIENT_SELECT =
  "assignment_id,classroom_id,user_id,status,assigned_at,completed_at";

export type AssignmentRecipientMutationRow = {
  assignment_id: string;
  classroom_id: string;
  user_id: string;
  status: string;
  assigned_at: string | null;
  completed_at: string | null;
};

export type AssignmentForRecipientMutation = {
  id: string;
  classroom_id: string;
  section_id: string | null;
  archived_at?: string | null;
};

export function parseAssignmentIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new AdminClassroomManagementApiError(
      "assignmentIds must be a non-empty array.",
      400,
    );
  }

  const assignmentIds = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  const uniqueAssignmentIds = [...new Set(assignmentIds)];

  if (uniqueAssignmentIds.length === 0) {
    throw new AdminClassroomManagementApiError(
      "assignmentIds must be a non-empty array.",
      400,
    );
  }

  if (uniqueAssignmentIds.length !== assignmentIds.length) {
    throw new AdminClassroomManagementApiError(
      "assignmentIds must not contain duplicate assignments.",
      400,
    );
  }

  return uniqueAssignmentIds;
}

export async function getVerifiedAssignment(
  ctx: AdminClassroomManagementRouteContext,
  assignmentId: string,
) {
  const { data: assignmentData, error: assignmentError } = await ctx.adminClient
    .from("assignments")
    .select("id,classroom_id,section_id,archived_at")
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentError) {
    throw new AdminClassroomManagementApiError(
      assignmentError.message || "Failed to verify assignment.",
      500,
    );
  }

  const assignment = assignmentData as AssignmentForRecipientMutation | null;

  if (!assignment) {
    throw new AdminClassroomManagementApiError("Assignment not found.", 404);
  }

  const classroom = await getManageableClassroom(ctx, assignment.classroom_id);

  if (assignment.classroom_id !== classroom.id) {
    throw new AdminClassroomManagementApiError(
      "Assignment classroom could not be verified.",
      400,
    );
  }

  return assignment;
}

export async function getVerifiedAssignmentsInOneClassroom(
  ctx: AdminClassroomManagementRouteContext,
  assignmentIds: string[],
) {
  const { data: assignmentData, error: assignmentError } = await ctx.adminClient
    .from("assignments")
    .select("id,classroom_id,section_id,archived_at")
    .in("id", assignmentIds);

  if (assignmentError) {
    throw new AdminClassroomManagementApiError(
      assignmentError.message || "Failed to verify assignments.",
      500,
    );
  }

  const assignments = (assignmentData ?? []) as AssignmentForRecipientMutation[];
  const foundAssignmentIds = new Set(assignments.map((assignment) => assignment.id));

  if (assignments.length !== assignmentIds.length) {
    const missingAssignmentId = assignmentIds.find((id) => !foundAssignmentIds.has(id));
    throw new AdminClassroomManagementApiError(
      missingAssignmentId
        ? `Assignment not found: ${missingAssignmentId}`
        : "One or more assignments were not found.",
      404,
    );
  }

  const classroomIds = [...new Set(assignments.map((assignment) => assignment.classroom_id))];

  if (classroomIds.length !== 1) {
    throw new AdminClassroomManagementApiError(
      "Bulk recipient actions must target assignments in one classroom.",
      400,
    );
  }

  const classroomId = classroomIds[0];
  const classroom = await getManageableClassroom(ctx, classroomId);

  if (classroom.id !== classroomId) {
    throw new AdminClassroomManagementApiError(
      "Assignment classroom could not be verified.",
      400,
    );
  }

  return { assignments, classroomId };
}

export async function getValidatedActiveStudentForAdd(
  ctx: AdminClassroomManagementRouteContext,
  userId: string,
) {
  return getValidatedStudent(ctx, userId, { requireActive: true });
}

export async function assertStudentInClassroomRoster(
  adminClient: SupabaseClient,
  classroomId: string,
  userId: string,
) {
  const { data, error } = await adminClient
    .from("classroom_members")
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AdminClassroomManagementApiError(
      error.message || "Failed to verify classroom roster membership.",
      500,
    );
  }

  if (!data) {
    throw new AdminClassroomManagementApiError(
      "Student must belong to this classroom roster before being added as an assignment recipient.",
      400,
    );
  }
}


export async function ensureStudentInClassroomRoster(
  ctx: AdminClassroomManagementRouteContext,
  classroomId: string,
  userId: string,
  addToClassroomIfNeeded: boolean,
) {
  const { data: existingMembership, error: existingError } = await ctx.adminClient
    .from("classroom_members")
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new AdminClassroomManagementApiError(
      existingError.message || "Failed to verify classroom roster membership.",
      500,
    );
  }

  if (existingMembership) {
    return { membershipCreated: false };
  }

  if (!addToClassroomIfNeeded) {
    throw new AdminClassroomManagementApiError(
      "Student must belong to this classroom roster before being added as an assignment recipient.",
      400,
    );
  }

  const { error: insertError } = await ctx.adminClient
    .from("classroom_members")
    .insert({
      classroom_id: classroomId,
      user_id: userId,
      joined_via: ctx.isMaster ? "master_added" : "admin_added",
    });

  if (insertError) {
    if (parseUniqueMembershipError(insertError)) {
      return { membershipCreated: false };
    }

    throw new AdminClassroomManagementApiError(
      insertError.message || "Failed to add student to classroom.",
      500,
    );
  }

  return { membershipCreated: true };
}

export async function rollbackCreatedClassroomMembership(
  ctx: AdminClassroomManagementRouteContext,
  classroomId: string,
  userId: string,
  membershipCreated: boolean,
) {
  if (!membershipCreated) return;

  // Best-effort compensation for the non-RPC implementation: if this request
  // created classroom membership but recipient insertion fails, remove only the
  // membership row created by this operation so the mutation behaves as close to
  // all-or-none as possible without touching progress, attempts, assignments,
  // profiles, or pre-existing membership rows.
  const { error } = await ctx.adminClient
    .from("classroom_members")
    .delete()
    .eq("classroom_id", classroomId)
    .eq("user_id", userId);

  if (error) {
    console.error("failed to rollback classroom membership after recipient insert failure", error);
  }
}

export async function getRecipientRows(
  adminClient: SupabaseClient,
  classroomId: string,
  userId: string,
  assignmentIds: string[],
) {
  const { data, error } = await adminClient
    .from("assignment_recipients")
    .select(ADMIN_RECIPIENT_SELECT)
    .eq("classroom_id", classroomId)
    .eq("user_id", userId)
    .in("assignment_id", assignmentIds);

  if (error) {
    throw new AdminClassroomManagementApiError(
      error.message || "Failed to verify assignment recipients.",
      500,
    );
  }

  return (data ?? []) as AssignmentRecipientMutationRow[];
}

function applySectionFilter<T>(query: T, sectionId: string | null): T {
  const filtered = sectionId === null
    ? (query as { is: (column: string, value: null) => T }).is("section_id", null)
    : (query as { eq: (column: string, value: string) => T }).eq("section_id", sectionId);
  return filtered;
}

async function countStudentProgress(
  adminClient: SupabaseClient,
  userId: string,
  sectionId: string | null,
) {
  let query = adminClient
    .from("student_progress")
    .select("user_id", { count: "exact", head: true })
    .eq("app_id", "regents-algebra")
    .eq("course_id", "algebra1")
    .eq("user_id", userId);

  query = applySectionFilter(query, sectionId);
  const { count, error } = await query;

  if (error) {
    throw new AdminClassroomManagementApiError(
      error.message || "Failed to verify student progress.",
      500,
    );
  }

  return count ?? 0;
}

async function countStudentAttempts(
  adminClient: SupabaseClient,
  userId: string,
  sectionId: string | null,
) {
  let query = adminClient
    .from("question_attempts")
    .select("user_id", { count: "exact", head: true })
    .eq("app_id", "regents-algebra")
    .eq("course_id", "algebra1")
    .eq("user_id", userId);

  query = applySectionFilter(query, sectionId);
  const { count, error } = await query;

  if (error) {
    throw new AdminClassroomManagementApiError(
      error.message || "Failed to verify question attempts.",
      500,
    );
  }

  return count ?? 0;
}

export async function assertRecipientsCanBeRemoved(
  adminClient: SupabaseClient,
  assignments: AssignmentForRecipientMutation[],
  recipients: AssignmentRecipientMutationRow[],
  userId: string,
) {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

  for (const recipient of recipients) {
    if (recipient.status === "completed") {
      throw new AdminClassroomManagementApiError(
        "Cannot remove: assignment is completed.",
        409,
      );
    }

    if (recipient.status === "archived") {
      throw new AdminClassroomManagementApiError(
        "Cannot remove: assignment recipient is archived.",
        409,
      );
    }

    if (recipient.status !== "assigned" && recipient.status !== "excused") {
      throw new AdminClassroomManagementApiError(
        "Cannot remove: recipient status is not removable.",
        409,
      );
    }

    const assignment = assignmentById.get(recipient.assignment_id);
    if (!assignment) {
      throw new AdminClassroomManagementApiError(
        "Cannot remove: assignment could not be verified.",
        400,
      );
    }

    const progressCount = await countStudentProgress(
      adminClient,
      userId,
      assignment.section_id,
    );

    if (progressCount > 0) {
      throw new AdminClassroomManagementApiError(
        "Cannot remove: student has recorded progress.",
        409,
      );
    }

    const attemptCount = await countStudentAttempts(
      adminClient,
      userId,
      assignment.section_id,
    );

    if (attemptCount > 0) {
      throw new AdminClassroomManagementApiError(
        "Cannot remove: student has attempts for this section.",
        409,
      );
    }
  }
}

export function isUniqueRecipientError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("assignment_recipients_assignment_user_key") ||
    error.message?.toLowerCase().includes("duplicate key")
  );
}

export function buildRecipientInsertRows(
  assignments: AssignmentForRecipientMutation[],
  student: Pick<ProfileRow, "id">,
  assignedBy: string,
) {
  return assignments.map((assignment) => ({
    assignment_id: assignment.id,
    classroom_id: assignment.classroom_id,
    user_id: student.id,
    assigned_by: assignedBy,
    status: "assigned",
  }));
}
