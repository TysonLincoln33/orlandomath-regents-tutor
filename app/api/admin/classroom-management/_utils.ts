import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  canAccessAdminRoute,
  getEmailDomain,
  isMasterRole,
} from "@/lib/auth/roles";

export type AdminClassroomManagementErrorCode =
  | "unauthorized"
  | "admin_denied"
  | "admin_pending"
  | "admin_missing_domain"
  | "classroom_not_found"
  | "student_not_found"
  | "invalid_student"
  | "inactive_student";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
  is_active: boolean | null;
};

export type ClassroomRow = {
  id: string;
  teacher_id: string;
  name: string;
  subject: string | null;
  term: string | null;
  class_code: string;
};

export class AdminClassroomManagementApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: AdminClassroomManagementErrorCode,
  ) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AdminClassroomManagementApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to process classroom management request.",
    },
    { status: 500 },
  );
}

export type AdminClassroomManagementRouteContext = {
  adminClient: SupabaseClient;
  userId: string;
  isMaster: boolean;
  domain: string | null;
};

export async function getRouteContext(
  req: NextRequest,
): Promise<AdminClassroomManagementRouteContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new AdminClassroomManagementApiError(
      "Missing Supabase environment variables.",
      500,
    );
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    throw new AdminClassroomManagementApiError(
      "Missing authorization token.",
      401,
      "unauthorized",
    );
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new AdminClassroomManagementApiError(
      userError?.message || "Unauthorized.",
      401,
      "unauthorized",
    );
  }

  const { data: profileData, error: profileError } = await adminClient
    .from("profiles")
    .select("email,role,requested_role,approval_status,email_domain,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new AdminClassroomManagementApiError(
      profileError.message || "Failed to verify administrator access.",
      500,
    );
  }

  const profile = profileData as Pick<
    ProfileRow,
    | "email"
    | "role"
    | "requested_role"
    | "approval_status"
    | "email_domain"
    | "is_active"
  > | null;

  if (!profile) {
    throw new AdminClassroomManagementApiError(
      "Profile not found.",
      403,
      "admin_denied",
    );
  }

  if (profile.is_active === false) {
    throw new AdminClassroomManagementApiError(
      "Administrator account is inactive.",
      403,
      "admin_denied",
    );
  }

  if (!canAccessAdminRoute(profile.role, profile.approval_status)) {
    const isPendingAdmin =
      profile.requested_role === "admin" &&
      profile.approval_status === "pending" &&
      profile.role !== "admin";

    throw new AdminClassroomManagementApiError(
      isPendingAdmin
        ? "Administrator approval pending."
        : "Administrator access requires an approved administrator account.",
      403,
      isPendingAdmin ? "admin_pending" : "admin_denied",
    );
  }

  const isMaster = isMasterRole(profile.role);
  const domain = profile.email_domain ?? getEmailDomain(profile.email);

  if (!isMaster && !domain) {
    throw new AdminClassroomManagementApiError(
      "Administrator account is missing an email domain.",
      403,
      "admin_missing_domain",
    );
  }

  return { adminClient, userId: user.id, isMaster, domain };
}

export async function getManageableClassroom(
  ctx: AdminClassroomManagementRouteContext,
  classroomId: string,
) {
  const { data: classroomData, error: classroomError } = await ctx.adminClient
    .from("classrooms")
    .select("id,teacher_id,name,subject,term,class_code")
    .eq("id", classroomId)
    .maybeSingle();

  if (classroomError) {
    throw new AdminClassroomManagementApiError(
      classroomError.message || "Failed to verify classroom.",
      500,
    );
  }

  const classroom = classroomData as ClassroomRow | null;

  if (!classroom) {
    throw new AdminClassroomManagementApiError(
      "Classroom not found.",
      404,
      "classroom_not_found",
    );
  }

  if (ctx.isMaster) return classroom;

  if (classroom.teacher_id === ctx.userId) return classroom;

  const { data: teacherData, error: teacherError } = await ctx.adminClient
    .from("profiles")
    .select("id,email,email_domain,role")
    .eq("id", classroom.teacher_id)
    .maybeSingle();

  if (teacherError) {
    throw new AdminClassroomManagementApiError(
      teacherError.message || "Failed to verify classroom teacher.",
      500,
    );
  }

  const teacher = teacherData as Pick<
    ProfileRow,
    "id" | "email" | "email_domain" | "role"
  > | null;
  const teacherDomain = teacher?.email_domain ?? getEmailDomain(teacher?.email);

  if (!teacher || teacher.role !== "teacher" || teacherDomain !== ctx.domain) {
    throw new AdminClassroomManagementApiError(
      "Classroom not found.",
      404,
      "classroom_not_found",
    );
  }

  return classroom;
}

export async function getValidatedStudent(
  ctx: AdminClassroomManagementRouteContext,
  userId: string,
  options?: { requireActive?: boolean },
) {
  const { data: studentData, error: studentError } = await ctx.adminClient
    .from("profiles")
    .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (studentError) {
    throw new AdminClassroomManagementApiError(
      studentError.message || "Failed to verify student.",
      500,
    );
  }

  const student = studentData as ProfileRow | null;

  if (!student) {
    throw new AdminClassroomManagementApiError(
      "Student not found.",
      404,
      "student_not_found",
    );
  }

  if (student.role !== "student") {
    throw new AdminClassroomManagementApiError(
      "Only student accounts can be managed as classroom roster members.",
      400,
      "invalid_student",
    );
  }

  if (options?.requireActive && student.is_active !== true) {
    throw new AdminClassroomManagementApiError(
      "Only active students can be added to classrooms.",
      400,
      "inactive_student",
    );
  }

  const studentDomain = student.email_domain ?? getEmailDomain(student.email);
  if (!ctx.isMaster && studentDomain !== ctx.domain) {
    throw new AdminClassroomManagementApiError(
      "Student is not eligible for this administrator scope.",
      403,
      "admin_denied",
    );
  }

  return student;
}

export function parseUniqueMembershipError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("classroom_members_unique") ||
    error.message?.toLowerCase().includes("duplicate key")
  );
}
