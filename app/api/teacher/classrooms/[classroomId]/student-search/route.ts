import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEmailDomain, isTeacherLikeRole } from "@/lib/auth/roles";
import type { SearchStudentResult } from "@/lib/classrooms/searchStudentsForClassroom";

type RouteContext = {
  params: Promise<{
    classroomId: string;
  }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  email_domain: string | null;
};

type ClassroomMemberRow = {
  user_id: string;
};

function effectiveEmailDomain(
  profile: Pick<ProfileRow, "email" | "email_domain">,
) {
  return (
    profile.email_domain ?? getEmailDomain(profile.email)
  )?.toLowerCase() ?? null;
}

function matchesSearchTerm(profile: ProfileRow, normalizedSearch: string) {
  return [profile.full_name, profile.email]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(normalizedSearch));
}

function sortSearchResults(a: ProfileRow, b: ProfileRow) {
  if (a.role === "student" && b.role !== "student") return -1;
  if (a.role !== "student" && b.role === "student") return 1;

  const aName = a.full_name?.trim() || a.email || "";
  const bName = b.full_name?.trim() || b.email || "";
  return aName.localeCompare(bName);
}

function escapePostgrestPattern(value: string) {
  return value
    .replace(/[\\%_]/g, (match) => `\\${match}`)
    .replace(/,/g, "\\,");
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { classroomId } = await context.params;
    const searchTerm = (req.nextUrl.searchParams.get("search") ?? "").trim();

    if (searchTerm.length < 2) {
      return NextResponse.json({
        students: [] satisfies SearchStudentResult[],
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 },
      );
    }

    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 },
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: userError?.message || "Unauthorized." },
        { status: 401 },
      );
    }

    const { data: teacherProfile, error: teacherProfileError } = await adminClient
      .from("profiles")
      .select("id, role, email, email_domain")
      .eq("id", user.id)
      .maybeSingle();

    if (teacherProfileError) {
      return NextResponse.json(
        { error: teacherProfileError.message || "Failed to verify teacher." },
        { status: 500 },
      );
    }

    if (!teacherProfile || !isTeacherLikeRole(teacherProfile.role)) {
      return NextResponse.json(
        { error: "Teacher access required." },
        { status: 403 },
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
        {
          error:
            classroomError.message || "Failed to verify classroom ownership.",
        },
        { status: 500 },
      );
    }

    if (!classroom) {
      return NextResponse.json(
        { error: "Classroom not found or you do not have access to it." },
        { status: 404 },
      );
    }

    const teacherDomain = effectiveEmailDomain(teacherProfile as ProfileRow);

    if (!teacherDomain) {
      return NextResponse.json(
        { error: "Teacher account is missing an email domain." },
        { status: 400 },
      );
    }

    const searchPattern = `%${escapePostgrestPattern(searchTerm)}%`;
    const domainEmailPattern = `%@${escapePostgrestPattern(teacherDomain)}`;

    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role, email_domain")
      .eq("is_active", true)
      .or(
        `email_domain.eq.${teacherDomain},and(email_domain.is.null,email.ilike.${domainEmailPattern})`,
      )
      .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
      .limit(100);

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message || "Failed to search students." },
        { status: 500 },
      );
    }

    const normalizedSearch = searchTerm.toLowerCase();
    const matchingProfiles = ((profiles ?? []) as ProfileRow[])
      .filter((profile) => effectiveEmailDomain(profile) === teacherDomain)
      .filter((profile) => matchesSearchTerm(profile, normalizedSearch))
      .sort(sortSearchResults)
      .slice(0, 25);

    if (matchingProfiles.length === 0) {
      return NextResponse.json({
        students: [] satisfies SearchStudentResult[],
      });
    }

    const { data: memberships, error: membershipsError } = await adminClient
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId)
      .in(
        "user_id",
        matchingProfiles.map((profile) => profile.id),
      );

    if (membershipsError) {
      return NextResponse.json(
        {
          error:
            membershipsError.message || "Failed to check classroom membership.",
        },
        { status: 500 },
      );
    }

    const memberUserIds = new Set(
      ((memberships ?? []) as ClassroomMemberRow[]).map((row) => row.user_id),
    );

    const students: SearchStudentResult[] = matchingProfiles.map((profile) => ({
      id: profile.id,
      full_name: profile.full_name ?? null,
      email: profile.email ?? null,
      role: profile.role ?? null,
      already_in_classroom: memberUserIds.has(profile.id),
    }));

    return NextResponse.json({ students });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to search students.",
      },
      { status: 500 },
    );
  }
}
