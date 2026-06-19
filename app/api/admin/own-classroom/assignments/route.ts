import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { CHAPTERS, SECTIONS } from "@/lib/course/algebra1";
import {
  AdminClassroomManagementApiError,
  getRouteContext,
  jsonError,
} from "../../classroom-management/_utils";

const VALID_CHAPTER_IDS = new Set(CHAPTERS.map((chapter) => chapter.id));

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((id: string) => id.trim()).filter(Boolean))];
}

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

function getAccessToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getRouteContext(req);
    if (ctx.isMaster) {
      throw new AdminClassroomManagementApiError(
        "Master assignment creation is not supported for this admin-only workflow.",
        403,
        "admin_denied",
      );
    }

    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";
    const dueDate = normalizeDate(body?.dueDate ?? body?.due_date);
    const chapterIds = normalizeStringArray(body?.chapterIds);
    const studentUserIds = normalizeStringArray(body?.studentUserIds);

    if (!title) {
      throw new AdminClassroomManagementApiError(
        "Assignment title is required.",
        400,
      );
    }

    if (chapterIds.length === 0) {
      throw new AdminClassroomManagementApiError(
        "Select at least one chapter.",
        400,
      );
    }

    const invalidChapterId = chapterIds.find((chapterId) => !VALID_CHAPTER_IDS.has(chapterId));
    if (invalidChapterId) {
      throw new AdminClassroomManagementApiError(
        `Invalid chapter selected: ${invalidChapterId}`,
        400,
      );
    }

    const sectionIds = SECTIONS.filter((section) => chapterIds.includes(section.chapterId))
      .map((section) => section.id);

    if (sectionIds.length === 0) {
      throw new AdminClassroomManagementApiError(
        "Selected chapters do not contain assignable sections.",
        400,
      );
    }

    if (studentUserIds.length === 0) {
      throw new AdminClassroomManagementApiError(
        "Select at least one student.",
        400,
      );
    }

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

    const { data, error } = await userClient.rpc(
      "create_admin_own_classroom_section_assignments",
      {
        p_title: title,
        p_description: description || null,
        p_due_date: dueDate,
        p_section_ids: sectionIds,
        p_student_user_ids: studentUserIds,
      },
    );

    if (error) {
      throw new AdminClassroomManagementApiError(
        error.message || "Failed to create admin assignment.",
        400,
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("admin own-classroom assignment creation route error", error);
    return jsonError(error);
  }
}
