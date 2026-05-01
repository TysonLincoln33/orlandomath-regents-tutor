// src/lib/classrooms/removeStudentFromClassroom.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isTeacherLikeRole } from "@/lib/auth/roles";

export async function removeStudentFromClassroom(
  classroomId: string,
  studentUserId: string
): Promise<void> {
  const supabase: any = getSupabaseBrowserClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || "Failed to verify user.");
  }

  if (!user) {
    throw new Error("Please log in to manage this classroom.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Failed to verify teacher access.");
  }

  if (!profile || !isTeacherLikeRole(profile.role)) {
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
    throw new Error("Classroom not found or you do not have access to it.");
  }

  const { error: deleteError } = await supabase
    .from("classroom_members")
    .delete()
    .eq("classroom_id", classroomId)
    .eq("user_id", studentUserId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to remove student.");
  }
}