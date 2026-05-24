import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MasterClassroomRow = {
  id: string;
  name: string;
  term: string | null;
  subject: string | null;
  class_code: string;
  teacher_id: string;
  created_at: string;
  teacher_name: string | null;
  teacher_email: string | null;
  roster_count: number;
  assignment_count: number;
};

export type MasterClassroomMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  joined_at: string;
  joined_via: string | null;
};

export async function getMasterClassrooms(): Promise<MasterClassroomRow[]> {
  const supabase = getSupabaseBrowserClient() as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
  const { data, error } = await supabase.rpc("get_master_classrooms_with_counts");
  if (error) throw new Error(error.message || "Failed to load classrooms.");
  return (data ?? []) as MasterClassroomRow[];
}

export async function getMasterClassroomMembers(classroomId: string): Promise<MasterClassroomMember[]> {
  const supabase = getSupabaseBrowserClient() as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
  const { data, error } = await supabase.rpc("get_master_classroom_members", { p_classroom_id: classroomId });
  if (error) throw new Error(error.message || "Failed to load classroom roster.");
  return (data ?? []) as MasterClassroomMember[];
}

export async function createMasterClassroom(input: { name: string; teacherId: string; term?: string; subject?: string }) {
  const supabase = getSupabaseBrowserClient() as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
  const { data, error } = await supabase.rpc("create_master_classroom", {
    p_name: input.name,
    p_teacher_id: input.teacherId,
    p_term: input.term ?? null,
    p_subject: input.subject ?? null,
  });
  if (error) throw new Error(error.message || "Failed to create classroom.");
  return data;
}

export async function searchStudentsGlobal(searchTerm: string, classroomId: string) {
  const supabase = getSupabaseBrowserClient() as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
  const { data, error } = await supabase.rpc("search_master_students_for_classroom", { p_search: searchTerm, p_classroom_id: classroomId });
  if (error) throw new Error(error.message || "Failed to search students.");
  return data ?? [];
}

export async function addMasterStudentsToClassroom(classroomId: string, studentUserIds: string[]) {
  const res = await fetch(`/api/master/classrooms/${classroomId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_user_ids: studentUserIds }) });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || "Failed to add students.");
}

export async function createMasterStudent(classroomId: string, fullName: string, email: string) {
  const res = await fetch(`/api/master/classrooms/${classroomId}/create-student`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: fullName, email }) });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || "Failed to create student.");
  return payload;
}

export async function removeMasterClassroomStudent(classroomId: string, userId: string) {
  const res = await fetch(`/api/master/classrooms/${classroomId}/members/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || "Failed to remove student.");
  }
}

export async function moveMasterClassroomStudent(fromClassroomId: string, toClassroomId: string, userId: string) {
  const res = await fetch(`/api/master/classrooms/${fromClassroomId}/members/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_classroom_id: toClassroomId }) });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || "Failed to move student.");
  }
}
