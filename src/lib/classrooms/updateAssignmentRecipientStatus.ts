import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  TeacherAssignmentRecipientRow,
  TeacherAssignmentRecipientStatus,
} from "@/lib/classrooms/getTeacherAssignmentRecipients";

export type UpdateAssignmentRecipientStatusInput = {
  classroomId: string;
  assignmentId: string;
  userId: string;
  status: Extract<TeacherAssignmentRecipientStatus, "assigned" | "excused">;
};

export async function updateAssignmentRecipientStatus(
  input: UpdateAssignmentRecipientStatusInput,
): Promise<TeacherAssignmentRecipientRow> {
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
    `/api/teacher/classrooms/${input.classroomId}/assignments/${input.assignmentId}/recipients/${input.userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: input.status }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to update recipient status.");
  }

  return payload.recipient as TeacherAssignmentRecipientRow;
}
