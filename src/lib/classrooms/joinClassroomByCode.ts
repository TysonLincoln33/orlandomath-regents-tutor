import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type JoinedClassroomResult = {
  id: string;
  name: string;
  subject: string | null;
  term: string | null;
  class_code: string;
};

export async function joinClassroomByCode(
  rawCode: string
): Promise<JoinedClassroomResult> {
  const supabase: any = getSupabaseBrowserClient();

  const classCode = rawCode.trim().toUpperCase();

  if (!classCode) {
    throw new Error("Please enter a class code.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || "Failed to verify user.");
  }

  if (!user) {
    throw new Error("Please log in before joining a classroom.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Failed to verify profile.");
  }

  if (!profile) {
    throw new Error("Profile not found.");
  }

  if (profile.role !== "student") {
    throw new Error("Only student accounts can join classrooms.");
  }

  const { data: classroom, error: classroomError } = await supabase
    .from("classrooms")
    .select("id, name, subject, term, class_code")
    .eq("class_code", classCode)
    .maybeSingle();

  if (classroomError) {
    throw new Error(classroomError.message || "Failed to find classroom.");
  }

  if (!classroom) {
    throw new Error("Classroom code not found.");
  }

  const { data: existingMembership, error: existingError } = await supabase
    .from("classroom_members")
    .select("id")
    .eq("classroom_id", classroom.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to check membership.");
  }

  if (existingMembership) {
    return classroom as JoinedClassroomResult;
  }

  const { error: insertError } = await supabase.from("classroom_members").insert({
    classroom_id: classroom.id,
    user_id: user.id,
    joined_via: "code",
  });

  if (insertError) {
    throw new Error(insertError.message || "Failed to join classroom.");
  }

  return classroom as JoinedClassroomResult;
}