import { NextRequest, NextResponse } from "next/server";
import { SECTIONS } from "@/lib/course/algebra1";
import {
  AdminClassroomManagementApiError,
  getManageableClassroom,
  getRouteContext,
  jsonError,
} from "../classroom-management/_utils";

const VALID_SECTION_IDS = new Set(SECTIONS.map((section) => section.id));

type CreatedAssignmentRow = {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  section_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
  recipient_count: number;
  classroom_membership_created_count: number;
};

function normalizeDate(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AdminClassroomManagementApiError(
      "Due date must use YYYY-MM-DD format.",
      400,
    );
  }

  return raw;
}

function parseUniqueStringArray(value: unknown, fieldName: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new AdminClassroomManagementApiError(
      `${fieldName} must be an array.`,
      400,
    );
  }

  const values = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  const uniqueValues = [...new Set(values)];

  if (uniqueValues.length !== values.length) {
    throw new AdminClassroomManagementApiError(
      `${fieldName} must not contain duplicates.`,
      400,
    );
  }

  return values;
}

function assertDisjointArrays(left: string[], right: string[]) {
  const rightSet = new Set(right);
  const overlap = left.find((value) => rightSet.has(value));

  if (overlap) {
    throw new AdminClassroomManagementApiError(
      "A student cannot be both a selected classroom recipient and an add-to-class recipient.",
      400,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getRouteContext(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

    const classroomId = String(body?.classroom_id || "").trim();
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim() || null;
    const dueDate = normalizeDate(body?.due_date);
    const sectionIds = parseUniqueStringArray(body?.section_ids, "section_ids");
    const target = body?.target === "students" ? "students" : "class";
    const recipientUserIds = parseUniqueStringArray(
      body?.recipient_user_ids,
      "recipient_user_ids",
    );
    const addStudentUserIds = parseUniqueStringArray(
      body?.add_student_user_ids,
      "add_student_user_ids",
    );

    if (!classroomId) {
      return NextResponse.json(
        { error: "Please select a classroom." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Assignment title is required." },
        { status: 400 },
      );
    }

    if (sectionIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one section." },
        { status: 400 },
      );
    }

    const invalidSectionId = sectionIds.find(
      (sectionId) => !VALID_SECTION_IDS.has(sectionId),
    );

    if (invalidSectionId) {
      return NextResponse.json(
        { error: `Invalid Algebra 1 section selected: ${invalidSectionId}` },
        { status: 400 },
      );
    }

    if (
      target === "students" &&
      recipientUserIds.length === 0 &&
      addStudentUserIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Please select at least one student." },
        { status: 400 },
      );
    }

    assertDisjointArrays(recipientUserIds, addStudentUserIds);

    await getManageableClassroom(ctx, classroomId);

    const { data, error } = await ctx.adminClient.rpc("create_admin_assignments", {
      p_actor_id: ctx.userId,
      p_classroom_id: classroomId,
      p_title: title,
      p_description: description,
      p_due_date: dueDate,
      p_section_ids: sectionIds,
      p_target: target,
      p_recipient_user_ids: recipientUserIds,
      p_add_student_user_ids: addStudentUserIds,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create assignments." },
        { status: 400 },
      );
    }

    const assignments = (data ?? []) as CreatedAssignmentRow[];

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: "No assignments were created." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        assignments,
        created_count: assignments.length,
        recipient_count: assignments[0]?.recipient_count ?? 0,
        classroom_membership_created_count:
          assignments[0]?.classroom_membership_created_count ?? 0,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
