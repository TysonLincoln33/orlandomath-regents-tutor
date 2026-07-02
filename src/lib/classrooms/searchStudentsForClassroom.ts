// src/lib/classrooms/searchStudentsForClassroom.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type SearchStudentResult = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  already_in_classroom: boolean;
};

type SearchStudentsResponse = {
  students?: SearchStudentResult[];
  error?: string;
};

export async function searchStudentsForClassroom(
  classroomId: string,
  rawSearchTerm: string,
): Promise<SearchStudentResult[]> {
  const searchTerm = rawSearchTerm.trim();

  if (searchTerm.length < 2) {
    return [];
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  if (!session?.access_token) {
    throw new Error("Please log in to manage this classroom.");
  }

  const response = await fetch(
    `/api/teacher/classrooms/${encodeURIComponent(
      classroomId,
    )}/student-search?search=${encodeURIComponent(searchTerm)}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  const payload = (await response
    .json()
    .catch(() => ({}))) as SearchStudentsResponse;

  if (!response.ok) {
    throw new Error(payload.error || "Failed to search students.");
  }

  return payload.students ?? [];
}
