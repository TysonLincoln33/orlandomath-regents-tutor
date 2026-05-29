// src/lib/classrooms/createClassroomAssignment.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ClassroomAssignment = {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  section_id: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  archived_at?: string | null;
  recipient_count?: number;
  completed_count?: number;
  incomplete_count?: number;
  excused_count?: number;
};

export type AssignmentTarget = "class" | "students";

export type CreateAssignmentInput = {
  classroomId: string;
  title: string;
  description?: string;
  dueDate?: string;
  sectionIds?: string[];
  chapterIds?: string[];
  target: AssignmentTarget;
  recipientUserIds?: string[];
};

export type CreateClassroomAssignmentResult = {
  assignments: ClassroomAssignment[];
  created_count: number;
  recipient_count: number;
};

export async function createClassroomAssignment(
  input: CreateAssignmentInput,
): Promise<CreateClassroomAssignmentResult> {
  const supabase = getSupabaseBrowserClient();

  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const dueDate = input.dueDate?.trim() || null;
  const sectionIds = [
    ...new Set((input.sectionIds ?? []).map((item) => item.trim()).filter(Boolean)),
  ];
  const chapterIds = [
    ...new Set((input.chapterIds ?? []).map((item) => item.trim()).filter(Boolean)),
  ];
  const recipientUserIds = [
    ...new Set(input.recipientUserIds?.filter(Boolean) ?? []),
  ];

  if (!title) {
    throw new Error("Assignment title is required.");
  }

  if (sectionIds.length === 0 && chapterIds.length === 0) {
    throw new Error("Please select at least one section or chapter.");
  }

  if (input.target === "students" && recipientUserIds.length === 0) {
    throw new Error("Please select at least one student.");
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
    throw new Error("Please log in to create assignments.");
  }

  const response = await fetch(
    `/api/teacher/classrooms/${input.classroomId}/assignments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title,
        description,
        due_date: dueDate,
        section_ids: sectionIds,
        chapter_ids: chapterIds,
        target: input.target,
        recipient_user_ids: recipientUserIds,
      }),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to create assignment.");
  }

  return payload as CreateClassroomAssignmentResult;
}
