// src/lib/classrooms/addStudentsToClassroom.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isTeacherLikeRole } from "@/lib/auth/roles";

export type AddStudentsResult = {
  added_count: number;
  already_enrolled_count: number;
};

type ClassroomMemberRow = {
  user_id: string;
};

export async function addStudentsToClassroom(
  classroomId: string,
  studentUserIds: string[]
): Promise<AddStudentsResult> {
  const supabase: any = getSupabaseBrowserClient();

  const uniqueUserIds = [...new Set(studentUserIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    throw new Error("Please select at least one student.");
  }

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
    throw new Error("Classroom not found or you do not have access to it.");
  }

  const { data: existingMemberships, error: existingMembershipsError } =
    await supabase
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId)
      .in("user_id", uniqueUserIds);

  if (existingMembershipsError) {
    throw new Error(
      existingMembershipsError.message || "Failed to check classroom membership."
    );
  }

  const existingUserIds = new Set(
    ((existingMemberships ?? []) as ClassroomMemberRow[]).map(
      (row) => row.user_id
    )
  );

  const userIdsToAdd = uniqueUserIds.filter((id) => !existingUserIds.has(id));

  if (userIdsToAdd.length === 0) {
    return {
      added_count: 0,
      already_enrolled_count: uniqueUserIds.length,
    };
  }

  const rowsToInsert = userIdsToAdd.map((userId) => ({
    classroom_id: classroomId,
    user_id: userId,
    joined_via: "teacher_added",
  }));

  const { error: insertError } = await supabase
    .from("classroom_members")
    .insert(rowsToInsert);

  if (insertError) {
    throw new Error(insertError.message || "Failed to add students.");
  }

  return {
    added_count: userIdsToAdd.length,
    already_enrolled_count: uniqueUserIds.length - userIdsToAdd.length,
  };
}