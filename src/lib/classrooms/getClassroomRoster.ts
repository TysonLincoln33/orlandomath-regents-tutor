// src/lib/classrooms/getClassroomRoster.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ClassroomRosterMember = {
  id: string;
  classroom_id: string;
  user_id: string;
  joined_via: string | null;
  joined_at: string;
  email: string | null;
  full_name: string | null;
};

type ClassroomMemberRow = {
  id: string;
  classroom_id: string;
  user_id: string;
  joined_via: string | null;
  joined_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export async function getClassroomRoster(
  classroomId: string
): Promise<ClassroomRosterMember[]> {
  const supabase: any = getSupabaseBrowserClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message || "Failed to get user.");
  }

  if (!user) {
    return [];
  }

  const { data: classroom, error: classroomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classroomError) {
    throw new Error(
      classroomError.message || "Failed to verify classroom access."
    );
  }

  if (!classroom) {
    return [];
  }

  const { data: members, error: membersError } = await supabase
    .from("classroom_members")
    .select("id, classroom_id, user_id, joined_via, joined_at")
    .eq("classroom_id", classroomId)
    .order("joined_at", { ascending: true });

  if (membersError) {
    throw new Error(membersError.message || "Failed to load roster.");
  }

  const memberRows = ((members ?? []) as ClassroomMemberRow[]).filter(
    (member) => !!member.user_id
  );

  if (memberRows.length === 0) {
    return [];
  }

  const userIds = [...new Set(memberRows.map((member) => member.user_id))];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(
      profilesError.message || "Failed to load roster profiles."
    );
  }

  const profileMap = new Map<string, ProfileRow>();

  for (const profile of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  return memberRows.map((member) => {
    const profile = profileMap.get(member.user_id);

    return {
      id: member.id,
      classroom_id: member.classroom_id,
      user_id: member.user_id,
      joined_via: member.joined_via ?? null,
      joined_at: member.joined_at,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
    };
  });
}