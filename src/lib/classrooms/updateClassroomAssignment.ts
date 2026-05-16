// src/lib/classrooms/updateClassroomAssignment.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClassroomAssignment } from "@/lib/classrooms/createClassroomAssignment";

export type UpdateClassroomAssignmentInput = {
  classroomId: string;
  assignmentId: string;
  title: string;
  description?: string;
  dueDate?: string;
};

export async function updateClassroomAssignment(
  input: UpdateClassroomAssignmentInput,
): Promise<ClassroomAssignment> {
  const supabase = getSupabaseBrowserClient();
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const dueDate = input.dueDate?.trim() || null;

  if (!title) {
    throw new Error("Assignment title is required.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Please log in to update assignments.");
  }

  const response = await fetch(
    `/api/teacher/classrooms/${input.classroomId}/assignments/${input.assignmentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title,
        description,
        due_date: dueDate,
      }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to update assignment.");
  }

  return payload.assignment as ClassroomAssignment;
}
