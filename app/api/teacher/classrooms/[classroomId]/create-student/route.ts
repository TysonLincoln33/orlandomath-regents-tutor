// app/api/teacher/classrooms/[classroomId]/create-student/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isTeacherLikeRole } from "@/lib/auth/roles";

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
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    const fullName = String(body?.full_name || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();

    if (!fullName) {
      return NextResponse.json(
        { error: "Student full name is required." },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid student email is required." },
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
        {
          error:
            classroomError.message || "Failed to verify classroom ownership.",
        },
        { status: 500 }
      );
    }

    if (!classroom) {
      return NextResponse.json(
        { error: "Classroom not found or access denied." },
        { status: 404 }
      );
    }

    const { data: existingProfile, error: existingProfileError } =
      await adminClient
        .from("profiles")
        .select("id, full_name, email, role")
        .ilike("email", email)
        .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json(
        { error: existingProfileError.message || "Failed to check existing user." },
        { status: 500 }
      );
    }

    if (existingProfile) {
      if (existingProfile.role && existingProfile.role !== "student") {
        return NextResponse.json(
          { error: "That email belongs to a non-student account." },
          { status: 400 }
        );
      }

      const { data: existingMembership, error: existingMembershipError } =
        await adminClient
          .from("classroom_members")
          .select("id")
          .eq("classroom_id", classroomId)
          .eq("user_id", existingProfile.id)
          .maybeSingle();

      if (existingMembershipError) {
        return NextResponse.json(
          {
            error:
              existingMembershipError.message ||
              "Failed to check classroom membership.",
          },
          { status: 500 }
        );
      }

      if (existingMembership) {
        return NextResponse.json({
          user_id: existingProfile.id,
          full_name: existingProfile.full_name ?? fullName,
          email,
          status: "already_enrolled",
        });
      }

      const { error: insertExistingError } = await adminClient
        .from("classroom_members")
        .insert({
          classroom_id: classroomId,
          user_id: existingProfile.id,
          joined_via: "teacher_created",
        });

      if (insertExistingError) {
        return NextResponse.json(
          { error: insertExistingError.message || "Failed to add existing user." },
          { status: 500 }
        );
      }

      await adminClient.from("profiles").upsert(
        {
          id: existingProfile.id,
          full_name: existingProfile.full_name || fullName,
          email,
          role: "student",
          requested_role: "student",
          approval_status: "approved",
        },
        { onConflict: "id" }
      );

      return NextResponse.json({
        user_id: existingProfile.id,
        full_name: existingProfile.full_name ?? fullName,
        email,
        status: "existing_user_added",
      });
    }

    const { data: invitedUserData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role: "student",
          requested_role: "student",
          approval_status: "approved",
        },
        redirectTo: `${req.nextUrl.origin}/login`,
      });

    if (inviteError || !invitedUserData?.user?.id) {
      return NextResponse.json(
        { error: inviteError?.message || "Failed to invite student." },
        { status: 500 }
      );
    }

    const newUserId = invitedUserData.user.id;

    const { error: profileUpsertError } = await adminClient.from("profiles").upsert(
      {
        id: newUserId,
        full_name: fullName,
        email,
        role: "student",
        requested_role: "student",
        approval_status: "approved",
      },
      { onConflict: "id" }
    );

    if (profileUpsertError) {
      return NextResponse.json(
        { error: profileUpsertError.message || "Failed to create profile." },
        { status: 500 }
      );
    }

    const { error: membershipInsertError } = await adminClient
      .from("classroom_members")
      .insert({
        classroom_id: classroomId,
        user_id: newUserId,
        joined_via: "teacher_created",
      });

    if (membershipInsertError) {
      return NextResponse.json(
        { error: membershipInsertError.message || "Failed to add student to class." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user_id: newUserId,
      full_name: fullName,
      email,
      status: "created_and_added",
    });
  } catch (err: any) {
    console.error("create-student route error", err);

    return NextResponse.json(
      { error: err?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}