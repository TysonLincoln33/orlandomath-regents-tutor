// app/api/teacher/classrooms/[classroomId]/assignments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SECTIONS } from "@/lib/course/algebra1";
import {
  getTeacherAssignmentRouteContext,
  jsonError,
  normalizeDate,
} from "./_utils";

const VALID_SECTION_IDS = new Set(SECTIONS.map((section) => section.id));

const ASSIGNMENT_SELECT =
  "id, classroom_id, title, description, due_date, section_id, created_by, created_at, updated_at, archived_at";

type RouteContext = {
  params: Promise<{
    classroomId: string;
  }>;
};

type ClassroomMemberRow = {
  user_id: string;
};

type AssignmentRow = {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  section_id: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  archived_at?: string | null;
};

type AssignmentRecipientStatusRow = {
  assignment_id: string;
  status: string | null;
};

function withAssignmentCounts(
  assignments: AssignmentRow[],
  recipientRows: AssignmentRecipientStatusRow[],
) {
  const countsByAssignment = new Map<
    string,
    {
      recipient_count: number;
      completed_count: number;
      incomplete_count: number;
      excused_count: number;
    }
  >();

  assignments.forEach((assignment) => {
    countsByAssignment.set(assignment.id, {
      recipient_count: 0,
      completed_count: 0,
      incomplete_count: 0,
      excused_count: 0,
    });
  });

  recipientRows.forEach((row) => {
    const counts = countsByAssignment.get(row.assignment_id);
    if (!counts) return;

    counts.recipient_count += 1;

    if (row.status === "completed") {
      counts.completed_count += 1;
    } else if (row.status === "excused") {
      counts.excused_count += 1;
    } else {
      counts.incomplete_count += 1;
    }
  });

  return assignments.map((assignment) => ({
    ...assignment,
    ...countsByAssignment.get(assignment.id),
  }));
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { classroomId } = await context.params;
    const { adminClient } = await getTeacherAssignmentRouteContext(
      req,
      classroomId,
    );

    const { data: assignmentData, error: assignmentError } = await adminClient
      .from("assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("classroom_id", classroomId)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      return NextResponse.json(
        { error: assignmentError.message || "Failed to load assignments." },
        { status: 500 },
      );
    }

    const assignments = (assignmentData ?? []) as AssignmentRow[];
    const assignmentIds = assignments.map((assignment) => assignment.id);

    if (assignmentIds.length === 0) {
      return NextResponse.json({ assignments: [] });
    }

    const { data: recipientData, error: recipientError } = await adminClient
      .from("assignment_recipients")
      .select("assignment_id, status")
      .eq("classroom_id", classroomId)
      .in("assignment_id", assignmentIds);

    if (recipientError) {
      return NextResponse.json(
        {
          error: recipientError.message || "Failed to load assignment status.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      assignments: withAssignmentCounts(
        assignments,
        (recipientData ?? []) as AssignmentRecipientStatusRow[],
      ),
    });
  } catch (err) {
    console.error("list assignments route error", err);
    return jsonError(err);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { classroomId } = await context.params;
    const { adminClient, user } = await getTeacherAssignmentRouteContext(
      req,
      classroomId,
    );

    const body = await req.json().catch(() => null);
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim() || null;
    const dueDate = normalizeDate(body?.due_date);
    const sectionId = String(body?.section_id || "").trim();
    const target = body?.target === "students" ? "students" : "class";
    const recipientUserIds: string[] = Array.isArray(body?.recipient_user_ids)
      ? [
          ...new Set<string>(
            body.recipient_user_ids.map(String).filter(Boolean),
          ),
        ]
      : [];

    if (!title) {
      return NextResponse.json(
        { error: "Assignment title is required." },
        { status: 400 },
      );
    }

    if (!sectionId || !VALID_SECTION_IDS.has(sectionId)) {
      return NextResponse.json(
        { error: "Please select a valid Algebra 1 section." },
        { status: 400 },
      );
    }

    if (target === "students" && recipientUserIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one student." },
        { status: 400 },
      );
    }

    const { data: rosterRows, error: rosterError } = await adminClient
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId);

    if (rosterError) {
      return NextResponse.json(
        { error: rosterError.message || "Failed to load classroom roster." },
        { status: 500 },
      );
    }

    const rosterUserIds = new Set<string>(
      ((rosterRows ?? []) as ClassroomMemberRow[]).map((row) => row.user_id),
    );

    const recipients =
      target === "class" ? [...rosterUserIds] : recipientUserIds;
    const invalidRecipients = recipients.filter((id) => !rosterUserIds.has(id));

    if (invalidRecipients.length > 0) {
      return NextResponse.json(
        { error: "Selected students must belong to this classroom." },
        { status: 400 },
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "This classroom has no students to assign." },
        { status: 400 },
      );
    }

    const { data: assignment, error: assignmentError } = await adminClient
      .from("assignments")
      .insert({
        classroom_id: classroomId,
        title,
        description,
        due_date: dueDate,
        section_id: sectionId,
        created_by: user.id,
      })
      .select(ASSIGNMENT_SELECT)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: assignmentError?.message || "Failed to create assignment." },
        { status: 500 },
      );
    }

    const assignmentRow = assignment as AssignmentRow;
    const recipientRows = recipients.map((recipientUserId) => ({
      assignment_id: assignmentRow.id,
      classroom_id: classroomId,
      user_id: recipientUserId,
      assigned_by: user.id,
      status: "assigned",
    }));

    const { error: recipientsError } = await adminClient
      .from("assignment_recipients")
      .insert(recipientRows);

    if (recipientsError) {
      await adminClient.from("assignments").delete().eq("id", assignmentRow.id);

      return NextResponse.json(
        {
          error:
            recipientsError.message ||
            "Assignment was not created because recipients could not be saved.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      assignment: {
        ...assignmentRow,
        recipient_count: recipientRows.length,
        completed_count: 0,
        incomplete_count: recipientRows.length,
        excused_count: 0,
      },
      recipient_count: recipientRows.length,
    });
  } catch (err) {
    console.error("create assignment route error", err);
    return jsonError(err);
  }
}
