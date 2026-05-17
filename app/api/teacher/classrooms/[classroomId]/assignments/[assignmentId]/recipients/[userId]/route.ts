import { NextRequest, NextResponse } from "next/server";
import {
  assertAssignmentInClassroom,
  getTeacherAssignmentRouteContext,
  jsonError,
  TeacherAssignmentApiError,
} from "../../../_utils";

const RECIPIENT_SELECT =
  "assignment_id, classroom_id, user_id, status, assigned_at, completed_at";

type RouteContext = {
  params: Promise<{
    classroomId: string;
    assignmentId: string;
    userId: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { classroomId, assignmentId, userId } = await context.params;
    const { adminClient } = await getTeacherAssignmentRouteContext(
      req,
      classroomId,
    );

    await assertAssignmentInClassroom(adminClient, assignmentId, classroomId);

    const body = await req.json().catch(() => null);
    const status = String(body?.status || "").trim();

    if (status !== "assigned" && status !== "excused") {
      throw new TeacherAssignmentApiError(
        "Recipient status must be assigned or excused.",
        400,
      );
    }

    const { data: recipient, error: recipientError } = await adminClient
      .from("assignment_recipients")
      .select(RECIPIENT_SELECT)
      .eq("assignment_id", assignmentId)
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (recipientError) {
      throw new TeacherAssignmentApiError(
        recipientError.message || "Failed to verify assignment recipient.",
        500,
      );
    }

    if (!recipient) {
      throw new TeacherAssignmentApiError(
        "Assignment recipient not found in this classroom.",
        404,
      );
    }

    const { data: rosterMember, error: rosterError } = await adminClient
      .from("classroom_members")
      .select("id")
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (rosterError) {
      throw new TeacherAssignmentApiError(
        rosterError.message || "Failed to verify classroom roster.",
        500,
      );
    }

    if (!rosterMember) {
      throw new TeacherAssignmentApiError(
        "Assignment recipient is not on this classroom roster.",
        400,
      );
    }

    const { data: updatedRecipient, error: updateError } = await adminClient
      .from("assignment_recipients")
      .update({
        status,
        completed_at: status === "excused" ? null : recipient.completed_at,
      })
      .eq("assignment_id", assignmentId)
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .select(RECIPIENT_SELECT)
      .single();

    if (updateError || !updatedRecipient) {
      throw new TeacherAssignmentApiError(
        updateError?.message || "Failed to update recipient status.",
        500,
      );
    }

    return NextResponse.json({ recipient: updatedRecipient });
  } catch (err) {
    console.error("update assignment recipient route error", err);
    return jsonError(err);
  }
}
