import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { isMasterRole, isTeacherLikeRole } from "@/lib/auth/roles";

export type TeacherAssignmentRouteContext = {
  adminClient: SupabaseClient;
  user: User;
  role: string | null;
  isMaster: boolean;
};

export class TeacherAssignmentApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function jsonError(
  error: unknown,
  fallback = "Unexpected server error.",
) {
  if (error instanceof TeacherAssignmentApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}

export function normalizeDate(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new TeacherAssignmentApiError(
      "Due date must use YYYY-MM-DD format.",
      400,
    );
  }

  return raw;
}

export async function getTeacherAssignmentRouteContext(
  req: NextRequest,
  classroomId: string,
): Promise<TeacherAssignmentRouteContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new TeacherAssignmentApiError(
      "Missing Supabase environment variables.",
      500,
    );
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    throw new TeacherAssignmentApiError("Missing authorization token.", 401);
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
    throw new TeacherAssignmentApiError(
      userError?.message || "Unauthorized.",
      401,
    );
  }

  const { data: teacherProfile, error: teacherProfileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (teacherProfileError) {
    throw new TeacherAssignmentApiError(
      teacherProfileError.message || "Failed to verify teacher.",
      500,
    );
  }

  const role = (teacherProfile as { role: string | null } | null)?.role ?? null;

  if (!teacherProfile || !isTeacherLikeRole(role)) {
    throw new TeacherAssignmentApiError("Teacher access required.", 403);
  }

  const isMaster = isMasterRole(role);
  let classroomQuery = adminClient
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId);

  if (!isMaster) {
    classroomQuery = classroomQuery.eq("teacher_id", user.id);
  }

  const { data: classroom, error: classroomError } =
    await classroomQuery.maybeSingle();

  if (classroomError) {
    throw new TeacherAssignmentApiError(
      classroomError.message || "Failed to verify classroom ownership.",
      500,
    );
  }

  if (!classroom) {
    throw new TeacherAssignmentApiError(
      "Classroom not found or access denied.",
      404,
    );
  }

  return {
    adminClient,
    user,
    role,
    isMaster,
  };
}

export async function assertAssignmentInClassroom(
  adminClient: SupabaseClient,
  assignmentId: string,
  classroomId: string,
) {
  const { data: assignment, error: assignmentError } = await adminClient
    .from("assignments")
    .select("id, classroom_id")
    .eq("id", assignmentId)
    .eq("classroom_id", classroomId)
    .maybeSingle();

  if (assignmentError) {
    throw new TeacherAssignmentApiError(
      assignmentError.message || "Failed to verify assignment.",
      500,
    );
  }

  if (!assignment) {
    throw new TeacherAssignmentApiError(
      "Assignment not found in this classroom.",
      404,
    );
  }
}
