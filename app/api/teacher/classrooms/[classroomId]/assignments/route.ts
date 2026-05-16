// app/api/teacher/classrooms/[classroomId]/assignments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isTeacherLikeRole } from "@/lib/auth/roles";
import { SECTIONS } from "@/lib/course/algebra1";

const VALID_SECTION_IDS = new Set(SECTIONS.map((section) => section.id));

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
};

function normalizeDate(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Due date must use YYYY-MM-DD format.");
  }

  return raw;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { classroomId } = await context.params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim() || null;
    let dueDate: string | null;

    try {
      dueDate = normalizeDate(body?.due_date);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid due date." },
        { status: 400 }
      );
    }
    const sectionId = String(body?.section_id || "").trim();
    const target = body?.target === "students" ? "students" : "class";
    const recipientUserIds: string[] = Array.isArray(body?.recipient_user_ids)
      ? [...new Set<string>(body.recipient_user_ids.map(String).filter(Boolean))]
      : [];

    if (!title) {
      return NextResponse.json(
        { error: "Assignment title is required." },
        { status: 400 }
      );
    }

    if (!sectionId || !VALID_SECTION_IDS.has(sectionId)) {
      return NextResponse.json(
        { error: "Please select a valid Algebra 1 section." },
        { status: 400 }
      );
    }

    if (target === "students" && recipientUserIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one student." },
        { status: 400 }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: userError?.message || "Unauthorized." },
        { status: 401 }
      );
    }

    const { data: teacherProfile, error: teacherProfileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (teacherProfileError) {
      return NextResponse.json(
        { error: teacherProfileError.message || "Failed to verify teacher." },
        { status: 500 }
      );
    }

    if (!teacherProfile || !isTeacherLikeRole(teacherProfile.role)) {
      return NextResponse.json(
        { error: "Teacher access required." },
        { status: 403 }
      );
    }

    const { data: classroom, error: classroomError } = await adminClient
      .from("classrooms")
      .select("id")
      .eq("id", classroomId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (classroomError) {
      return NextResponse.json(
        { error: classroomError.message || "Failed to verify classroom ownership." },
        { status: 500 }
      );
    }

    if (!classroom) {
      return NextResponse.json(
        { error: "Classroom not found or access denied." },
        { status: 404 }
      );
    }

    const { data: rosterRows, error: rosterError } = await adminClient
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId);

    if (rosterError) {
      return NextResponse.json(
        { error: rosterError.message || "Failed to load classroom roster." },
        { status: 500 }
      );
    }

    const rosterUserIds = new Set<string>(
      ((rosterRows ?? []) as ClassroomMemberRow[]).map((row) => row.user_id)
    );

    const recipients =
      target === "class" ? [...rosterUserIds] : recipientUserIds;

    const invalidRecipients = recipients.filter((id) => !rosterUserIds.has(id));

    if (invalidRecipients.length > 0) {
      return NextResponse.json(
        { error: "Selected students must belong to this classroom." },
        { status: 400 }
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "This classroom has no students to assign." },
        { status: 400 }
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
      .select(
        "id, classroom_id, title, description, due_date, section_id, created_by, created_at"
      )
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: assignmentError?.message || "Failed to create assignment." },
        { status: 500 }
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
        { status: 500 }
      );
    }

    return NextResponse.json({
      assignment: assignmentRow,
      recipient_count: recipientRows.length,
    });
  } catch (err) {
    console.error("create assignment route error", err);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
