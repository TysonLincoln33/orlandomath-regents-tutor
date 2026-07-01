// src/lib/classrooms/searchStudentsForClassroom.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getEmailDomain,
  isMasterRole,
  isTeacherLikeRole,
} from "@/lib/auth/roles";

export type SearchStudentResult = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  already_in_classroom: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  email_domain?: string | null;
  is_active?: boolean | null;
};

type ClassroomMemberRow = {
  user_id: string;
};

export async function searchStudentsForClassroom(
  classroomId: string,
  rawSearchTerm: string
): Promise<SearchStudentResult[]> {
  const supabase: any = getSupabaseBrowserClient();

  const searchTerm = rawSearchTerm.trim();

  if (searchTerm.length < 2) {
    return [];
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
    .select("role, email, email_domain")
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

  const likeTerm = `%${searchTerm}%`;
  const teacherDomain =
    teacherProfile.email_domain ?? getEmailDomain(teacherProfile.email);
  const isMaster = isMasterRole(teacherProfile.role);

  const profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, email, role, email_domain, is_active")
    .eq("role", "student")
    .eq("is_active", true)
    .or(`full_name.ilike.${likeTerm},email.ilike.${likeTerm}`)
    .order("full_name", { ascending: true })
    .limit(isMaster ? 25 : 100);

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError) {
    throw new Error(profilesError.message || "Failed to search students.");
  }

  const students = ((profiles ?? []) as ProfileRow[])
    .filter((student) => {
      if (isMaster) return true;
      return (
        (student.email_domain ?? getEmailDomain(student.email)) === teacherDomain
      );
    })
    .slice(0, 25);

  if (students.length === 0) {
    return [];
  }

  const studentIds = students.map((student) => student.id);

  const { data: memberships, error: membershipsError } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .in("user_id", studentIds);

  if (membershipsError) {
    throw new Error(
      membershipsError.message || "Failed to check classroom membership."
    );
  }

  const memberUserIds = new Set(
    ((memberships ?? []) as ClassroomMemberRow[]).map((row) => row.user_id)
  );

  return students.map((student) => ({
    id: student.id,
    full_name: student.full_name ?? null,
    email: student.email ?? null,
    role: student.role ?? null,
    already_in_classroom: memberUserIds.has(student.id),
  }));
}