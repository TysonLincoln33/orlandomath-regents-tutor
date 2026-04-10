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
};

type CreateAssignmentInput = {
  classroomId: string;
  title: string;
  description?: string;
  dueDate?: string;
  sectionId?: string;
};

export async function createClassroomAssignment(
  input: CreateAssignmentInput
): Promise<ClassroomAssignment> {
  const supabase: any = getSupabaseBrowserClient();

  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const dueDate = input.dueDate?.trim() || null;
  const sectionId = input.sectionId?.trim() || null;

  if (!title) {
    throw new Error("Assignment title is required.");
  }

  if (!sectionId) {
    throw new Error("Please select a section.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || "Failed to verify user.");
  }

  if (!user) {
    throw new Error("Please log in to create assignments.");
  }

  const { data: teacherProfile, error: teacherProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (teacherProfileError) {
    throw new Error(
      teacherProfileError.message || "Failed to verify teacher access."
    );
  }

  if (!teacherProfile || teacherProfile.role !== "teacher") {
    throw new Error("Teacher access required.");
  }

  const { data: classroom, error: classroomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("id", input.classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classroomError) {
    throw new Error(
      classroomError.message || "Failed to verify classroom ownership."
    );
  }

  if (!classroom) {
    throw new Error("Classroom not found or you do not have access to it.");
  }

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      classroom_id: input.classroomId,
      title,
      description,
      due_date: dueDate || null,
      section_id: sectionId,
      created_by: user.id,
    })
    .select(
      "id, classroom_id, title, description, due_date, section_id, created_by, created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create assignment.");
  }

  return data as ClassroomAssignment;
}