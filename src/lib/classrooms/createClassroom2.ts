import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type CreateClassroomInput = {
  name: string;
  subject?: string;
  term?: string;
};

function generateClassCode(length: number = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

export async function createClassroom(input: CreateClassroomInput) {
  const supabase = getSupabaseBrowserClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const class_code = generateClassCode();

  const payload = {
    teacher_id: user.id,
    name: input.name,
    subject: input.subject || null,
    term: input.term || null,
    class_code,
  };

  const { data, error } = await (supabase as any)
    .from("classrooms")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Create classroom error:", error);
    throw new Error(error.message || "Failed to create classroom");
  }

  return data;
}