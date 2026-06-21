import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  AdminClassroomManagementApiError,
  getRouteContext,
  jsonError,
  type ClassroomRow,
} from "../classroom-management/_utils";

type AdminOwnClassroom = ClassroomRow & {
  created_at?: string | null;
  classroom_kind?: string | null;
};

function getAccessToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function assertAdminOnly(isMaster: boolean) {
  if (isMaster) {
    throw new AdminClassroomManagementApiError(
      "Master classroom setup is not supported for this admin-only workflow.",
      403,
      "admin_denied",
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getRouteContext(req);
    assertAdminOnly(ctx.isMaster);

    const { data, error } = await ctx.adminClient
      .from("classrooms")
      .select("id,teacher_id,name,subject,term,class_code,created_at,classroom_kind")
      .eq("teacher_id", ctx.userId)
      .eq("classroom_kind", "admin_assignment")
      .order("created_at", { ascending: true });

    if (error) {
      throw new AdminClassroomManagementApiError(
        error.message || "Failed to resolve admin classroom.",
        500,
      );
    }

    const classrooms = (data ?? []) as AdminOwnClassroom[];

    if (classrooms.length === 0) {
      return NextResponse.json({
        status: "missing",
        classroom: null,
        message: "Admin classroom setup is required.",
      });
    }

    if (classrooms.length > 1) {
      console.error("admin own-classroom duplicate configuration", {
        userId: ctx.userId,
        classroomIds: classrooms.map((classroom) => classroom.id),
      });
      return NextResponse.json({
        status: "duplicate",
        classroom: null,
        message: "Multiple admin classrooms are configured for this administrator.",
        userMessage:
          "Administrator classroom configuration issue. Please contact support.",
      });
    }

    return NextResponse.json({
      status: "ready",
      classroom: classrooms[0],
    });
  } catch (error) {
    console.error("admin own-classroom resolve route error", error);
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getRouteContext(req);
    assertAdminOnly(ctx.isMaster);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const accessToken = getAccessToken(req);

    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      throw new AdminClassroomManagementApiError(
        "Missing Supabase environment variables or authorization token.",
        500,
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await userClient.rpc("create_admin_own_classroom");

    if (error) {
      console.error("admin own-classroom setup rpc error", {
        userId: ctx.userId,
        message: error.message,
      });

      if (error.message?.toLowerCase().includes("multiple admin classrooms")) {
        return NextResponse.json(
          {
            error:
              "Administrator classroom configuration issue. Please contact support.",
            detail: error.message,
          },
          { status: 409 },
        );
      }

      throw new AdminClassroomManagementApiError(
        error.message || "Failed to create admin classroom.",
        400,
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("admin own-classroom setup route error", error);
    return jsonError(error);
  }
}
