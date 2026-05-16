// app/api/teacher/classrooms/[classroomId]/assignments/[assignmentId]/recipients/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  assertAssignmentInClassroom,
  getTeacherAssignmentRouteContext,
  jsonError,
} from "../../../_utils";

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
    const action = body?.action === "unexcuse" ? "unexcuse" : "excuse";

    const { data: recipient, error: recipientError } = await adminClient
      .from("assignment_recipients")
      .select("id, assignment_id, classroom_id, user_id")
      .eq("assignment_id", assignmentId)
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (recipientError) {
      return NextResponse.json(
        { error: recipientError.message || "Failed to verify recipient." },
        { status: 500 },
      );
    }

    if (!recipient) {
      return NextResponse.json(
        { error: "Assignment recipient not found in this classroom." },
        { status: 404 },
      );
    }

    const { data: rosterMember, error: rosterError } = await adminClient
      .from("classroom_members")
      .select("id")
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (rosterError) {
      return NextResponse.json(
        { error: rosterError.message || "Failed to verify roster membership." },
        { status: 500 },
      );
    }

    if (!rosterMember) {
      return NextResponse.json(
        { error: "Assignment recipient must belong to this classroom roster." },
        { status: 400 },
      );
    }

    const nextStatus = action === "unexcuse" ? "assigned" : "excused";
    const { error: updateError } = await adminClient
      .from("assignment_recipients")
      .update({
        status: nextStatus,
        completed_at: null,
      })
      .eq("assignment_id", assignmentId)
      .eq("classroom_id", classroomId)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update recipient status." },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: nextStatus });
  } catch (err) {
    console.error("update assignment recipient route error", err);
    return jsonError(err);
  }
}
