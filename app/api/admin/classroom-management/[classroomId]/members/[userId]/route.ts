import { NextRequest, NextResponse } from "next/server";

import {
  AdminClassroomManagementApiError,
  getManageableClassroom,
  getRouteContext,
  getValidatedStudent,
  jsonError,
} from "../../../_utils";

type RouteContext = {
  params: Promise<{ classroomId: string; userId: string }>;
};

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await getRouteContext(req);
    const { classroomId, userId } = await params;

    await getManageableClassroom(ctx, classroomId);
    await getValidatedStudent(ctx, userId);

    const { data: existingMembership, error: existingError } = await ctx.adminClient
      .from("classroom_members")
      .select("id")
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      throw new AdminClassroomManagementApiError(
        existingError.message || "Failed to check classroom membership.",
        500,
      );
    }

    if (!existingMembership) {
      return NextResponse.json({ ok: true, status: "not_found" });
    }

    // A3.4b removal is intentionally a pure roster mutation: only the
    // classroom_members row is deleted. Assignments, recipients, progress,
    // attempts, and user records are not touched here.
    const { error: deleteError } = await ctx.adminClient
      .from("classroom_members")
      .delete()
      .eq("classroom_id", classroomId)
      .eq("user_id", userId);

    if (deleteError) {
      throw new AdminClassroomManagementApiError(
        deleteError.message || "Failed to remove student from classroom.",
        500,
      );
    }

    return NextResponse.json({ ok: true, status: "removed" });
  } catch (error) {
    return jsonError(error);
  }
}
