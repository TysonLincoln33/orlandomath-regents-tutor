// src/lib/classrooms/updateAssignmentRecipientStatus.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AssignmentRecipientStatusAction = "excuse" | "unexcuse";

export async function updateAssignmentRecipientStatus({
  classroomId,
  assignmentId,
  userId,
  action,
}: {
  classroomId: string;
  assignmentId: string;
  userId: string;
  action: AssignmentRecipientStatusAction;
}): Promise<void> {
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
    throw new Error("Please log in to update assignment recipients.");
  }

  const response = await fetch(
    `/api/teacher/classrooms/${classroomId}/assignments/${assignmentId}/recipients/${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to update assignment recipient.");
  }
}
