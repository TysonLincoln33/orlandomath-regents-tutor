// src/lib/classrooms/getTeacherClassroomById.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Classroom } from "@/types/classroom";

export async function getTeacherClassroomById(
  classroomId: string
): Promise<Classroom | null> {
  const supabase: any = getSupabaseBrowserClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || "Failed to get user.");
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("classrooms")
    .select("*")
    .eq("id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load classroom.");
  }

  return (data as Classroom | null) ?? null;
}