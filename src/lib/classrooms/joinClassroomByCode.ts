import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export async function joinClassroomByCode(classCode: string): Promise<string> {
  const supabase: any = getSupabaseBrowserClient();

  const trimmedCode = classCode.trim();

  if (!trimmedCode) {
    throw new Error("Class code is required.");
  }

  const { data, error } = await supabase.rpc("join_classroom_by_code", {
    p_class_code: trimmedCode,
  });

  if (error) {
    throw new Error(error.message || "Failed to join classroom.");
  }

  return data as string;
}