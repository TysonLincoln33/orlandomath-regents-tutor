import { NextRequest, NextResponse } from "next/server";

import {
  AdminClassroomManagementApiError,
  getManageableClassroom,
  getRouteContext,
  getValidatedStudent,
  jsonError,
  parseUniqueMembershipError,
} from "../../_utils";

type RouteContext = {
  params: Promise<{ classroomId: string }>;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await getRouteContext(req);
    const { classroomId } = await params;
    const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      throw new AdminClassroomManagementApiError(
        "Student user ID is required.",
        400,
        "student_not_found",
      );
    }

    await getManageableClassroom(ctx, classroomId);
    await getValidatedStudent(ctx, userId, { requireActive: true });

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

    if (existingMembership) {
      return NextResponse.json({ ok: true, status: "already_enrolled" });
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
        return NextResponse.json({ ok: true, status: "already_enrolled" });
      }

      throw new AdminClassroomManagementApiError(
        insertError.message || "Failed to add student to classroom.",
        500,
      );
    }

    return NextResponse.json({ ok: true, status: "added" });
  } catch (error) {
    return jsonError(error);
  }
}
