import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_RECIPIENT_SELECT,
  assertRecipientsCanBeRemoved,
  assertStudentInClassroomRoster,
  buildRecipientInsertRows,
  getRecipientRows,
  getValidatedActiveStudentForAdd,
  getVerifiedAssignmentsInOneClassroom,
  isUniqueRecipientError,
} from "../../_recipientUtils";
import {
  AdminClassroomManagementApiError,
  getManageableClassroom,
  getRouteContext,
  getValidatedStudent,
  jsonError,
} from "../../../classroom-management/_utils";

const RECIPIENT_SELECT =
  "assignment_id,classroom_id,user_id,status,assigned_at,completed_at";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type AssignmentRow = {
  id: string;
  classroom_id: string;
};

type RecipientRow = {
  assignment_id: string;
  classroom_id: string;
  user_id: string;
  status: string;
  assigned_at: string | null;
  completed_at: string | null;
};

function parseAssignmentIds(value: unknown) {
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

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const ctx = await getRouteContext(req);

    const body = await req.json().catch(() => null);
    const action = String(body?.action || "").trim();

    if (action !== "excuse" && action !== "unexcuse") {
      throw new AdminClassroomManagementApiError(
        "Recipient action must be excuse or unexcuse.",
        400,
      );
    }

    const assignmentIds = parseAssignmentIds(body?.assignmentIds);

    const { data: assignmentData, error: assignmentError } = await ctx.adminClient
      .from("assignments")
      .select("id,classroom_id")
      .in("id", assignmentIds);

    if (assignmentError) {
      throw new AdminClassroomManagementApiError(
        assignmentError.message || "Failed to verify assignments.",
        500,
      );
    }

    const assignments = (assignmentData ?? []) as AssignmentRow[];
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

    await getValidatedStudent(ctx, userId);

    const { data: recipientData, error: recipientError } = await ctx.adminClient
      .from("assignment_recipients")
      .select(RECIPIENT_SELECT)
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .in("assignment_id", assignmentIds);

    if (recipientError) {
      throw new AdminClassroomManagementApiError(
        recipientError.message || "Failed to verify assignment recipients.",
        500,
      );
    }

    const recipients = (recipientData ?? []) as RecipientRow[];
    const recipientAssignmentIds = new Set(
      recipients.map((recipient) => recipient.assignment_id),
    );

    if (recipients.length !== assignmentIds.length) {
      const missingRecipientAssignmentId = assignmentIds.find(
        (id) => !recipientAssignmentIds.has(id),
      );
      throw new AdminClassroomManagementApiError(
        missingRecipientAssignmentId
          ? `Assignment recipient not found for assignment: ${missingRecipientAssignmentId}`
          : "One or more assignment recipients were not found.",
        404,
      );
    }

    if (recipients.some((recipient) => recipient.status === "completed")) {
      throw new AdminClassroomManagementApiError(
        "Completed recipients cannot be changed in this phase.",
        409,
      );
    }

    if (recipients.some((recipient) => recipient.status === "archived")) {
      throw new AdminClassroomManagementApiError(
        "Archived recipients cannot be changed in this phase.",
        409,
      );
    }

    if (
      recipients.some(
        (recipient) => recipient.status !== "assigned" && recipient.status !== "excused",
      )
    ) {
      throw new AdminClassroomManagementApiError(
        "Recipient statuses cannot be changed in this phase.",
        409,
      );
    }

    if (action === "excuse" && recipients.some((recipient) => recipient.status !== "assigned")) {
      throw new AdminClassroomManagementApiError(
        "Overall excuse requires all selected recipients to be assigned.",
        409,
      );
    }

    if (action === "unexcuse" && recipients.some((recipient) => recipient.status !== "excused")) {
      throw new AdminClassroomManagementApiError(
        "Overall unexcuse requires all selected recipients to be excused.",
        409,
      );
    }

    const nextStatus = action === "excuse" ? "excused" : "assigned";
    const update =
      nextStatus === "excused"
        ? { status: nextStatus, completed_at: null }
        : { status: nextStatus };

    const { data: updatedRecipients, error: updateError } = await ctx.adminClient
      .from("assignment_recipients")
      .update(update)
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .in("assignment_id", assignmentIds)
      .select(RECIPIENT_SELECT);

    if (updateError || !updatedRecipients) {
      throw new AdminClassroomManagementApiError(
        updateError?.message || "Failed to update assignment recipients.",
        500,
      );
    }

    if (updatedRecipients.length !== assignmentIds.length) {
      throw new AdminClassroomManagementApiError(
        "Failed to update all assignment recipients.",
        500,
      );
    }

    return NextResponse.json({
      recipients: updatedRecipients,
      updated_count: updatedRecipients.length,
    });
  } catch (error) {
    console.error("admin bulk assignment recipient route error", error);
    return jsonError(error);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const ctx = await getRouteContext(req);
    const body = await req.json().catch(() => null);
    const assignmentIds = parseAssignmentIds(body?.assignmentIds);
    const { assignments, classroomId } = await getVerifiedAssignmentsInOneClassroom(
      ctx,
      assignmentIds,
    );

    const student = await getValidatedActiveStudentForAdd(ctx, userId);
    await assertStudentInClassroomRoster(ctx.adminClient, classroomId, userId);

    const existingRecipients = await getRecipientRows(
      ctx.adminClient,
      classroomId,
      userId,
      assignmentIds,
    );

    if (existingRecipients.length > 0) {
      throw new AdminClassroomManagementApiError(
        "Student is already a recipient for one or more selected assignments.",
        409,
      );
    }

    const { data: insertedRecipients, error: insertError } = await ctx.adminClient
      .from("assignment_recipients")
      .insert(buildRecipientInsertRows(assignments, student, ctx.userId))
      .select(ADMIN_RECIPIENT_SELECT);

    if (insertError || !insertedRecipients) {
      if (insertError && isUniqueRecipientError(insertError)) {
        throw new AdminClassroomManagementApiError(
          "Student is already a recipient for one or more selected assignments.",
          409,
        );
      }

      throw new AdminClassroomManagementApiError(
        insertError?.message || "Failed to add assignment recipients.",
        500,
      );
    }

    if (insertedRecipients.length !== assignmentIds.length) {
      throw new AdminClassroomManagementApiError(
        "Failed to add all assignment recipients.",
        500,
      );
    }

    return NextResponse.json(
      {
        recipients: insertedRecipients,
        created_count: insertedRecipients.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("admin bulk add assignment recipient route error", error);
    return jsonError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const ctx = await getRouteContext(req);
    const body = await req.json().catch(() => null);
    const assignmentIds = parseAssignmentIds(body?.assignmentIds);
    const { assignments, classroomId } = await getVerifiedAssignmentsInOneClassroom(
      ctx,
      assignmentIds,
    );

    await getValidatedStudent(ctx, userId);

    const recipients = await getRecipientRows(
      ctx.adminClient,
      classroomId,
      userId,
      assignmentIds,
    );
    const recipientAssignmentIds = new Set(
      recipients.map((recipient) => recipient.assignment_id),
    );

    if (recipients.length !== assignmentIds.length) {
      const missingRecipientAssignmentId = assignmentIds.find(
        (id) => !recipientAssignmentIds.has(id),
      );
      throw new AdminClassroomManagementApiError(
        missingRecipientAssignmentId
          ? `Assignment recipient not found for assignment: ${missingRecipientAssignmentId}`
          : "One or more assignment recipients were not found.",
        404,
      );
    }

    await assertRecipientsCanBeRemoved(
      ctx.adminClient,
      assignments,
      recipients,
      userId,
    );

    const { data: deletedRecipients, error: deleteError } = await ctx.adminClient
      .from("assignment_recipients")
      .delete()
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .in("assignment_id", assignmentIds)
      .select(RECIPIENT_SELECT);

    if (deleteError || !deletedRecipients) {
      throw new AdminClassroomManagementApiError(
        deleteError?.message || "Failed to remove assignment recipients.",
        500,
      );
    }

    if (deletedRecipients.length !== assignmentIds.length) {
      throw new AdminClassroomManagementApiError(
        "Failed to remove all assignment recipients.",
        500,
      );
    }

    return NextResponse.json({
      removed: true,
      removed_count: deletedRecipients.length,
      recipients: deletedRecipients,
    });
  } catch (error) {
    console.error("admin bulk delete assignment recipient route error", error);
    return jsonError(error);
  }
}
