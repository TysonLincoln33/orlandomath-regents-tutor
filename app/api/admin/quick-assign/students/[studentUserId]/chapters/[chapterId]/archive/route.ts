import { NextRequest, NextResponse } from "next/server";

import { CHAPTERS, SECTIONS } from "@/lib/course/algebra1";
import {
  AdminClassroomManagementApiError,
  getRouteContext,
  getValidatedStudent,
  jsonError,
} from "../../../../../../classroom-management/_utils";

const VALID_CHAPTER_IDS = new Set(CHAPTERS.map((chapter) => chapter.id));

type RouteContext = {
  params: Promise<{ studentUserId: string; chapterId: string }>;
};

async function getQuickClass(ctx: Awaited<ReturnType<typeof getRouteContext>>) {
  const { data, error } = await ctx.adminClient
    .from("classrooms")
    .select("id,teacher_id,name,subject,term,class_code,created_at,classroom_kind")
    .eq("teacher_id", ctx.userId)
    .eq("classroom_kind", "quick_assign")
    .order("created_at", { ascending: true });

  if (error) {
    throw new AdminClassroomManagementApiError(error.message || "Failed to load Quick Class.", 500);
  }

  if ((data ?? []).length > 1) {
    throw new AdminClassroomManagementApiError(
      "Multiple Quick Classes are configured for this administrator.",
      409,
    );
  }

  return data?.[0] ?? null;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await getRouteContext(req);
    if (ctx.isMaster) {
      throw new AdminClassroomManagementApiError(
        "Master Quick Assign is not supported for this MVP.",
        403,
        "admin_denied",
      );
    }

    const { studentUserId, chapterId } = await params;
    await getValidatedStudent(ctx, studentUserId, { requireActive: true });

    if (!VALID_CHAPTER_IDS.has(chapterId)) {
      throw new AdminClassroomManagementApiError(`Invalid chapter selected: ${chapterId}`, 400);
    }

    const sectionIds = SECTIONS.filter((section) => section.chapterId === chapterId).map(
      (section) => section.id,
    );

    if (sectionIds.length === 0) {
      throw new AdminClassroomManagementApiError(
        "Selected chapter does not contain assignable sections.",
        400,
      );
    }

    const quickClass = await getQuickClass(ctx);
    if (!quickClass) {
      return NextResponse.json({ studentUserId, chapterId, archivedRecipientCount: 0 });
    }

    const { data: assignmentData, error: assignmentError } = await ctx.adminClient
      .from("assignments")
      .select("id")
      .eq("classroom_id", quickClass.id)
      .eq("created_by", ctx.userId)
      .is("archived_at", null)
      .in("section_id", sectionIds);

    if (assignmentError) {
      throw new AdminClassroomManagementApiError(
        assignmentError.message || "Failed to load Quick Assign chapter assignments.",
        500,
      );
    }

    const assignmentIds = (assignmentData ?? [])
      .map((assignment) => assignment.id)
      .filter((id): id is string => Boolean(id));

    if (assignmentIds.length === 0) {
      return NextResponse.json({ studentUserId, chapterId, archivedRecipientCount: 0 });
    }

    const { data: archivedRecipients, error: archiveError } = await ctx.adminClient
      .from("assignment_recipients")
      .update({ status: "archived" })
      .eq("classroom_id", quickClass.id)
      .eq("user_id", studentUserId)
      .in("assignment_id", assignmentIds)
      .neq("status", "archived")
      .select("id");

    if (archiveError) {
      throw new AdminClassroomManagementApiError(
        archiveError.message || "Failed to archive Quick Assign chapter.",
        500,
      );
    }

    return NextResponse.json({
      studentUserId,
      chapterId,
      archivedRecipientCount: archivedRecipients?.length ?? 0,
    });
  } catch (error) {
    console.error("admin quick assign chapter archive route error", error);
    return jsonError(error);
  }
}
