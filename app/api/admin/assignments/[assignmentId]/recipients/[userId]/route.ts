import { NextRequest, NextResponse } from "next/server";

import {
  assertRecipientsCanBeRemoved,
  getRecipientRows,
  getVerifiedAssignment,
} from "../../../_recipientUtils";
import {
  AdminClassroomManagementApiError,
  getManageableClassroom,
  getRouteContext,
  getValidatedStudent,
  jsonError,
} from "../../../../classroom-management/_utils";

const RECIPIENT_SELECT =
  "assignment_id,classroom_id,user_id,status,assigned_at,completed_at";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
    userId: string;
  }>;
};

type RecipientRow = {
  assignment_id: string;
  classroom_id: string;
  user_id: string;
  status: string;
  assigned_at: string | null;
  completed_at: string | null;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { assignmentId, userId } = await context.params;
    const ctx = await getRouteContext(req);

    const body = await req.json().catch(() => null);
    const action = String(body?.action || "").trim();

    if (action !== "excuse" && action !== "unexcuse") {
      throw new AdminClassroomManagementApiError(
        "Recipient action must be excuse or unexcuse.",
        400,
      );
    }

    const { data: assignmentData, error: assignmentError } = await ctx.adminClient
      .from("assignments")
      .select("id,classroom_id")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentError) {
      throw new AdminClassroomManagementApiError(
        assignmentError.message || "Failed to verify assignment.",
        500,
      );
    }

    const assignment = assignmentData as { id: string; classroom_id: string } | null;

    if (!assignment) {
      throw new AdminClassroomManagementApiError(
        "Assignment not found.",
        404,
      );
    }

    const classroom = await getManageableClassroom(ctx, assignment.classroom_id);

    if (assignment.classroom_id !== classroom.id) {
      throw new AdminClassroomManagementApiError(
        "Assignment classroom could not be verified.",
        400,
      );
    }

    await getValidatedStudent(ctx, userId);

    const { data: recipientData, error: recipientError } = await ctx.adminClient
      .from("assignment_recipients")
      .select(RECIPIENT_SELECT)
      .eq("assignment_id", assignmentId)
      .eq("classroom_id", assignment.classroom_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (recipientError) {
      throw new AdminClassroomManagementApiError(
        recipientError.message || "Failed to verify assignment recipient.",
        500,
      );
    }

    const recipient = recipientData as RecipientRow | null;

    if (!recipient) {
      throw new AdminClassroomManagementApiError(
        "Assignment recipient not found.",
        404,
      );
    }

    if (recipient.status === "completed") {
      throw new AdminClassroomManagementApiError(
        "Completed recipients cannot be changed in this phase.",
        409,
      );
    }

    if (recipient.status === "archived") {
      throw new AdminClassroomManagementApiError(
        "Archived recipients cannot be changed in this phase.",
        409,
      );
    }

    if (recipient.status !== "assigned" && recipient.status !== "excused") {
      throw new AdminClassroomManagementApiError(
        "Recipient status cannot be changed in this phase.",
        409,
      );
    }

    if (action === "excuse" && recipient.status !== "assigned") {
      throw new AdminClassroomManagementApiError(
        "Only assigned recipients can be excused in this phase.",
        409,
      );
    }

    if (action === "unexcuse" && recipient.status !== "excused") {
      throw new AdminClassroomManagementApiError(
        "Only excused recipients can be unexcused in this phase.",
        409,
      );
    }

    const nextStatus = action === "excuse" ? "excused" : "assigned";
    const update = {
      status: nextStatus,
      completed_at: nextStatus === "excused" ? null : recipient.completed_at,
    };

    const { data: updatedRecipient, error: updateError } = await ctx.adminClient
      .from("assignment_recipients")
      .update(update)
      .eq("assignment_id", assignmentId)
      .eq("classroom_id", assignment.classroom_id)
      .eq("user_id", userId)
      .select(RECIPIENT_SELECT)
      .single();

    if (updateError || !updatedRecipient) {
      throw new AdminClassroomManagementApiError(
        updateError?.message || "Failed to update assignment recipient.",
        500,
      );
    }

    return NextResponse.json({ recipient: updatedRecipient });
  } catch (error) {
    console.error("admin assignment recipient route error", error);
    return jsonError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { assignmentId, userId } = await context.params;
    const ctx = await getRouteContext(req);
    const assignment = await getVerifiedAssignment(ctx, assignmentId);

    await getValidatedStudent(ctx, userId);

    const recipients = await getRecipientRows(
      ctx.adminClient,
      assignment.classroom_id,
      userId,
      [assignmentId],
    );

    if (recipients.length === 0) {
      throw new AdminClassroomManagementApiError(
        "Assignment recipient not found.",
        404,
      );
    }

    await assertRecipientsCanBeRemoved(
      ctx.adminClient,
      [assignment],
      recipients,
      userId,
    );

    const { data: deletedRecipients, error: deleteError } = await ctx.adminClient
      .from("assignment_recipients")
      .delete()
      .eq("assignment_id", assignmentId)
      .eq("classroom_id", assignment.classroom_id)
      .eq("user_id", userId)
      .select(RECIPIENT_SELECT);

    if (deleteError || !deletedRecipients) {
      throw new AdminClassroomManagementApiError(
        deleteError?.message || "Failed to remove assignment recipient.",
        500,
      );
    }

    if (deletedRecipients.length !== 1) {
      throw new AdminClassroomManagementApiError(
        "Failed to remove assignment recipient.",
        500,
      );
    }

    return NextResponse.json({
      removed: true,
      removed_count: deletedRecipients.length,
      recipient: deletedRecipients[0],
    });
  } catch (error) {
    console.error("admin delete assignment recipient route error", error);
    return jsonError(error);
  }
}
