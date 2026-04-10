// src/lib/classrooms/createStudentAndAddToClassroom.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type CreateStudentAndAddResult = {
  user_id: string;
  full_name: string | null;
  email: string;
  status: "created_and_added" | "existing_user_added" | "already_enrolled";
};

export async function createStudentAndAddToClassroom(
  classroomId: string,
  fullName: string,
  email: string
): Promise<CreateStudentAndAddResult> {
  const supabase: any = getSupabaseBrowserClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Please log in to manage this classroom.");
  }

  const response = await fetch(
    `/api/teacher/classrooms/${classroomId}/create-student`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        full_name: fullName,
        email,
      }),
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to create student.");
  }

  return payload as CreateStudentAndAddResult;
}