import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

async function assertMaster(req: NextRequest): Promise<{ adminClient: AdminClient } | { error: string; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!url || !anon || !service) return { error: "Missing Supabase environment variables.", status: 500 };
  if (!token) return { error: "Missing authorization token.", status: 401 };
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: "Unauthorized.", status: 401 };
  const { data: profile } = await adminClient.from("profiles").select("role,approval_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "master" || profile.approval_status !== "approved") return { error: "Master access required.", status: 403 };
  return { adminClient };
}

export async function POST(req: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  const auth = await assertMaster(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { classroomId } = await context.params;
  const body = await req.json().catch(() => null);
  const rawIds = Array.isArray(body?.student_user_ids) ? (body.student_user_ids as unknown[]) : [];
  const ids = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (!ids.length) return NextResponse.json({ error: "Please select at least one student." }, { status: 400 });

  const { data: existing } = await auth.adminClient.from("classroom_members").select("user_id").eq("classroom_id", classroomId).in("user_id", ids);
  const existingIds = new Set((existing ?? []).map((r) => String((r as { user_id: string }).user_id)));
  const rows = ids.filter((id) => !existingIds.has(id)).map((id) => ({ classroom_id: classroomId, user_id: id, joined_via: "master_added" }));

  if (rows.length) {
    const { error } = await auth.adminClient.from("classroom_members").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added_count: rows.length, already_enrolled_count: ids.length - rows.length });
}
