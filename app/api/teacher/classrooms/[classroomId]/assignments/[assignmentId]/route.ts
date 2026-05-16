// app/api/teacher/classrooms/[classroomId]/assignments/[assignmentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  assertAssignmentInClassroom,
  getTeacherAssignmentRouteContext,
  jsonError,
  normalizeDate,
} from "../_utils";

const ASSIGNMENT_SELECT =
  "id, classroom_id, title, description, due_date, section_id, created_by, created_at, updated_at, archived_at";

type RouteContext = {
  params: Promise<{
    classroomId: string;
    assignmentId: string;
  }>;
};

type AssignmentRecipientStatusRow = {
  status: string | null;
};

function applyCounts(
  assignment: Record<string, unknown>,
  recipientRows: AssignmentRecipientStatusRow[],
) {
  const counts = {
    recipient_count: 0,
    completed_count: 0,
    incomplete_count: 0,
    excused_count: 0,
  };

  recipientRows.forEach((row) => {
    counts.recipient_count += 1;

    if (row.status === "completed") {
      counts.completed_count += 1;
    } else if (row.status === "excused") {
      counts.excused_count += 1;
    } else {
      counts.incomplete_count += 1;
    }
  });

  return { ...assignment, ...counts };
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { classroomId, assignmentId } = await context.params;
    const { adminClient } = await getTeacherAssignmentRouteContext(
      req,
      classroomId,
    );

    await assertAssignmentInClassroom(adminClient, assignmentId, classroomId);

    const body = await req.json().catch(() => null);
    const shouldArchive = body?.archived === true;
    const updates: Record<string, string | null> = {};

    if (shouldArchive) {
      updates.archived_at = new Date().toISOString();
    } else {
      const title = String(body?.title || "").trim();
      const description = String(body?.description || "").trim() || null;
      const dueDate = normalizeDate(body?.due_date);

      if (!title) {
        return NextResponse.json(
          { error: "Assignment title is required." },
          { status: 400 },
        );
      }

      updates.title = title;
      updates.description = description;
      updates.due_date = dueDate;
    }

    updates.updated_at = new Date().toISOString();

    const { data: assignment, error: assignmentError } = await adminClient
      .from("assignments")
      .update(updates)
      .eq("id", assignmentId)
      .eq("classroom_id", classroomId)
      .select(ASSIGNMENT_SELECT)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: assignmentError?.message || "Failed to update assignment." },
        { status: 500 },
      );
    }

    const { data: recipientData, error: recipientError } = await adminClient
      .from("assignment_recipients")
      .select("status")
      .eq("classroom_id", classroomId)
      .eq("assignment_id", assignmentId);

    if (recipientError) {
      return NextResponse.json(
        {
          error: recipientError.message || "Failed to load assignment status.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      assignment: applyCounts(
        assignment as Record<string, unknown>,
        (recipientData ?? []) as AssignmentRecipientStatusRow[],
      ),
    });
  } catch (err) {
    console.error("update assignment route error", err);
    return jsonError(err);
  }
}
