import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Classroom } from "@/types/classroom";

export async function getTeacherClassrooms(): Promise<Classroom[]> {
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

  const { data, error } = await supabase
    .from("classrooms")
    .select("*")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load classrooms.");
  }

  return (data ?? []) as Classroom[];
}