import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  canAccessAdminRoute,
  getEmailDomain,
  isMasterRole,
} from "@/lib/auth/roles";
import type { AdminClassroomManagement } from "@/lib/admin/classroomManagement";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
  is_active: boolean | null;
};

type ClassroomRow = {
  id: string;
  teacher_id: string;
  name: string;
  subject: string | null;
  term: string | null;
  class_code: string;
};

type ClassroomMemberRow = {
  id: string;
  classroom_id: string;
  user_id: string;
  joined_at: string;
  joined_via: string | null;
};

class AdminClassroomManagementApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?:
      | "unauthorized"
      | "admin_denied"
      | "admin_pending"
      | "admin_missing_domain",
  ) {
    super(message);
  }
}

function jsonError(error: unknown) {
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
          : "Failed to load classroom management data.",
    },
    { status: 500 },
  );
}

async function getRouteContext(req: NextRequest): Promise<{
  adminClient: SupabaseClient;
  isMaster: boolean;
  domain: string | null;
}> {
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

  return { adminClient, isMaster, domain };
}

function mapProfileById(profiles: ProfileRow[]) {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

export async function GET(req: NextRequest) {
  try {
    const { adminClient, isMaster, domain } = await getRouteContext(req);
    const selectedClassroomId = req.nextUrl.searchParams.get("classroomId") ?? "";
    const search = (req.nextUrl.searchParams.get("q") ?? "").trim();

    const { data: teacherRows, error: teachersError } = isMaster
      ? await adminClient
          .from("profiles")
          .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
          .eq("role", "teacher")
      : await adminClient
          .from("profiles")
          .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
          .eq("role", "teacher")
          .eq("email_domain", domain);

    if (teachersError) {
      throw new AdminClassroomManagementApiError(
        teachersError.message || "Failed to load classroom teachers.",
        500,
      );
    }

    const teachers = (teacherRows ?? []) as ProfileRow[];
    const teacherIds = teachers.map((teacher) => teacher.id);

    const { data: classroomRows, error: classroomsError } = isMaster
      ? await adminClient
          .from("classrooms")
          .select("id,teacher_id,name,subject,term,class_code")
          .order("name", { ascending: true })
      : teacherIds.length > 0
        ? await adminClient
            .from("classrooms")
            .select("id,teacher_id,name,subject,term,class_code")
            .in("teacher_id", teacherIds)
            .order("name", { ascending: true })
        : { data: [], error: null };

    if (classroomsError) {
      throw new AdminClassroomManagementApiError(
        classroomsError.message || "Failed to load classrooms.",
        500,
      );
    }

    const classrooms = (classroomRows ?? []) as ClassroomRow[];
    const classroomIds = classrooms.map((classroom) => classroom.id);
    const missingTeacherIds = [
      ...new Set(
        classrooms
          .map((classroom) => classroom.teacher_id)
          .filter((teacherId) => !teacherIds.includes(teacherId)),
      ),
    ];

    let allTeachers = teachers;
    if (missingTeacherIds.length > 0) {
      const { data, error } = await adminClient
        .from("profiles")
        .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
        .in("id", missingTeacherIds);

      if (error) {
        throw new AdminClassroomManagementApiError(
          error.message || "Failed to load classroom teacher profiles.",
          500,
        );
      }
      allTeachers = [...teachers, ...((data ?? []) as ProfileRow[])];
    }

    const { data: memberRows, error: membersError } = classroomIds.length > 0
      ? await adminClient
          .from("classroom_members")
          .select("id,classroom_id,user_id,joined_at,joined_via")
          .in("classroom_id", classroomIds)
          .order("joined_at", { ascending: true })
      : { data: [], error: null };

    if (membersError) {
      throw new AdminClassroomManagementApiError(
        membersError.message || "Failed to load classroom rosters.",
        500,
      );
    }

    const members = (memberRows ?? []) as ClassroomMemberRow[];
    const memberUserIds = [...new Set(members.map((member) => member.user_id))];
    const { data: memberProfilesRows, error: memberProfilesError } =
      memberUserIds.length > 0
        ? await adminClient
            .from("profiles")
            .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
            .in("id", memberUserIds)
        : { data: [], error: null };

    if (memberProfilesError) {
      throw new AdminClassroomManagementApiError(
        memberProfilesError.message || "Failed to load roster profiles.",
        500,
      );
    }

    const teacherMap = mapProfileById(allTeachers);
    const memberProfileMap = mapProfileById((memberProfilesRows ?? []) as ProfileRow[]);
    const membersByClassroom = new Map<string, ClassroomMemberRow[]>();
    members.forEach((member) => {
      membersByClassroom.set(member.classroom_id, [
        ...(membersByClassroom.get(member.classroom_id) ?? []),
        member,
      ]);
    });

    const visibleClassroomIds = new Set(classroomIds);
    const selectedClassroomVisible = selectedClassroomId
      ? visibleClassroomIds.has(selectedClassroomId)
      : false;

    let eligibleStudents: AdminClassroomManagement["eligibleStudents"] = [];
    if (selectedClassroomVisible && search.length >= 2) {
      const like = `%${search}%`;
      const { data: studentsRows, error: studentsError } = isMaster
        ? await adminClient
            .from("profiles")
            .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
            .eq("role", "student")
            .eq("is_active", true)
            .or(`full_name.ilike.${like},email.ilike.${like}`)
            .order("full_name", { ascending: true, nullsFirst: false })
            .limit(25)
        : await adminClient
            .from("profiles")
            .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
            .eq("role", "student")
            .eq("is_active", true)
            .eq("email_domain", domain)
            .or(`full_name.ilike.${like},email.ilike.${like}`)
            .order("full_name", { ascending: true, nullsFirst: false })
            .limit(25);

      if (studentsError) {
        throw new AdminClassroomManagementApiError(
          studentsError.message || "Failed to search eligible students.",
          500,
        );
      }

      const selectedMemberIds = new Set(
        (membersByClassroom.get(selectedClassroomId) ?? []).map(
          (member) => member.user_id,
        ),
      );

      eligibleStudents = ((studentsRows ?? []) as ProfileRow[]).map((student) => ({
        id: student.id,
        fullName: student.full_name,
        email: student.email,
        emailDomain: student.email_domain ?? getEmailDomain(student.email),
        alreadyInClassroom: selectedMemberIds.has(student.id),
      }));
    }

    return NextResponse.json({
      scope: {
        type: isMaster ? "master_global" : "domain",
        domain: isMaster ? null : domain,
        label: isMaster
          ? "Master Global Classroom Management"
          : `Classroom Management for ${domain}`,
      },
      classrooms: classrooms.map((classroom) => {
        const teacher = teacherMap.get(classroom.teacher_id);
        const roster = (membersByClassroom.get(classroom.id) ?? []).map((member) => {
          const profile = memberProfileMap.get(member.user_id);
          return {
            membershipId: member.id,
            userId: member.user_id,
            fullName: profile?.full_name ?? null,
            email: profile?.email ?? null,
            emailDomain: profile?.email_domain ?? getEmailDomain(profile?.email),
            joinedAt: member.joined_at,
            joinedVia: member.joined_via,
            isActive: profile?.is_active ?? true,
          };
        });

        return {
          id: classroom.id,
          name: classroom.name,
          subject: classroom.subject,
          term: classroom.term,
          classCode: classroom.class_code,
          teacherId: classroom.teacher_id,
          teacherName: teacher?.full_name ?? null,
          teacherEmail: teacher?.email ?? null,
          teacherEmailDomain: teacher?.email_domain ?? getEmailDomain(teacher?.email),
          rosterCount: roster.length,
          roster,
        };
      }),
      eligibleStudents,
    } satisfies AdminClassroomManagement);
  } catch (error) {
    return jsonError(error);
  }
}
