// src/lib/classrooms/archiveClassroomAssignment.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClassroomAssignment } from "@/lib/classrooms/createClassroomAssignment";

export async function archiveClassroomAssignment(
  classroomId: string,
  assignmentId: string,
): Promise<ClassroomAssignment> {
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
    throw new Error("Please log in to archive assignments.");
  }

  const response = await fetch(
    `/api/teacher/classrooms/${classroomId}/assignments/${assignmentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ archived: true }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to archive assignment.");
  }

  return payload.assignment as ClassroomAssignment;
}
