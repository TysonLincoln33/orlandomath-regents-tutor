// src/lib/classrooms/getClassroomAssignments.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isTeacherLikeRole } from "@/lib/auth/roles";
import type { ClassroomAssignment } from "@/lib/classrooms/createClassroomAssignment";

export async function getClassroomAssignments(
  classroomId: string
): Promise<ClassroomAssignment[]> {
  const supabase: any = getSupabaseBrowserClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || "Failed to verify user.");
  }

  if (!user) {
    return [];
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

  if (!teacherProfile || !isTeacherLikeRole(teacherProfile.role)) {
    throw new Error("Teacher access required.");
  }

  const { data: classroom, error: classroomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classroomError) {
    throw new Error(
      classroomError.message || "Failed to verify classroom ownership."
    );
  }

  if (!classroom) {
    return [];
  }

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, classroom_id, title, description, due_date, section_id, created_by, created_at"
    )
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load assignments.");
  }

  return (data ?? []) as ClassroomAssignment[];
}