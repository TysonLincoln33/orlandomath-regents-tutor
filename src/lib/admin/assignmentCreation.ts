import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminCreateAssignmentRequest = {
  classroom_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  section_ids: string[];
  target: "class" | "students";
  recipient_user_ids?: string[];
  add_student_user_ids?: string[];
};

export type AdminCreatedAssignment = {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  section_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
  recipient_count: number;
  classroom_membership_created_count: number;
};

export type AdminCreateAssignmentResult = {
  assignments: AdminCreatedAssignment[];
  created_count: number;
  recipient_count: number;
  classroom_membership_created_count: number;
};

export async function createAdminAssignment(
  body: AdminCreateAssignmentRequest,
): Promise<AdminCreateAssignmentResult> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  if (!session?.access_token) {
    const error = new Error("Please sign in again.") as Error & {
      status?: number;
      code?: string;
    };
    error.status = 401;
    error.code = "unauthorized";
    throw error;
  }

  const response = await fetch("/api/admin/assignments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | AdminCreateAssignmentResult
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : "Failed to create assignment.";
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    throw error;
  }

  return payload as AdminCreateAssignmentResult;
}
