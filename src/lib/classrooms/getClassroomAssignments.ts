import { courseFetch } from "@/lib/course/selection";
// src/lib/classrooms/getClassroomAssignments.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClassroomAssignment } from "@/lib/classrooms/createClassroomAssignment";

export async function getClassroomAssignments(
  classroomId: string,
): Promise<ClassroomAssignment[]> {
  const supabase = getSupabaseBrowserClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    return [];
  }

  const response = await courseFetch(
    `/api/teacher/classrooms/${classroomId}/assignments`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load assignments.");
  }

  return (payload?.assignments ?? []) as ClassroomAssignment[];
}
