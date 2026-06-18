import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_RECIPIENT_SELECT,
  assertStudentInClassroomRoster,
  buildRecipientInsertRows,
  getRecipientRows,
  getValidatedActiveStudentForAdd,
  getVerifiedAssignment,
  isUniqueRecipientError,
} from "../../_recipientUtils";
import {
  AdminClassroomManagementApiError,
  getRouteContext,
  jsonError,
} from "../../../classroom-management/_utils";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { assignmentId } = await context.params;
    const ctx = await getRouteContext(req);
    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      throw new AdminClassroomManagementApiError("userId is required.", 400);
    }

    const assignment = await getVerifiedAssignment(ctx, assignmentId);
    const student = await getValidatedActiveStudentForAdd(ctx, userId);
    await assertStudentInClassroomRoster(ctx.adminClient, assignment.classroom_id, userId);

    const existingRecipients = await getRecipientRows(
      ctx.adminClient,
      assignment.classroom_id,
      userId,
      [assignmentId],
    );

    if (existingRecipients.length > 0) {
      throw new AdminClassroomManagementApiError(
        "Student is already a recipient for this assignment.",
        409,
      );
    }

    const { data: insertedRecipient, error: insertError } = await ctx.adminClient
      .from("assignment_recipients")
      .insert(buildRecipientInsertRows([assignment], student, ctx.userId))
      .select(ADMIN_RECIPIENT_SELECT)
      .single();

    if (insertError || !insertedRecipient) {
      if (insertError && isUniqueRecipientError(insertError)) {
        throw new AdminClassroomManagementApiError(
          "Student is already a recipient for this assignment.",
          409,
        );
      }

      throw new AdminClassroomManagementApiError(
        insertError?.message || "Failed to add assignment recipient.",
        500,
      );
    }

    return NextResponse.json({ recipient: insertedRecipient }, { status: 201 });
  } catch (error) {
    console.error("admin add assignment recipient route error", error);
    return jsonError(error);
  }
}
