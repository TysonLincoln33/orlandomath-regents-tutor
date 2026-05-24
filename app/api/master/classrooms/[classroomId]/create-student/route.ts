import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isValidEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export async function POST(req: NextRequest, context: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await context.params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return NextResponse.json({ error: "Missing Supabase environment variables." }, { status: 500 });
  const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const fullName = String(body?.full_name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!fullName) return NextResponse.json({ error: "Student full name is required." }, { status: 400 });
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: "A valid student email is required." }, { status: 400 });
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data: profile } = await adminClient.from("profiles").select("role,approval_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "master" || profile.approval_status !== "approved") return NextResponse.json({ error: "Master access required." }, { status: 403 });

  const { data: existingProfile } = await adminClient.from("profiles").select("id, full_name, email, role").ilike("email", email).maybeSingle();
  if (existingProfile) {
    const { data: existingMembership } = await adminClient.from("classroom_members").select("id").eq("classroom_id", classroomId).eq("user_id", existingProfile.id).maybeSingle();
    if (!existingMembership) await adminClient.from("classroom_members").insert({ classroom_id: classroomId, user_id: existingProfile.id, joined_via: "master_created" });
    return NextResponse.json({ user_id: existingProfile.id, full_name: existingProfile.full_name ?? fullName, email, status: existingMembership ? "already_enrolled" : "existing_user_added" });
  }
  const { data: invitedUserData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName, role: "student", requested_role: "student", approval_status: "approved" }, redirectTo: `${req.nextUrl.origin}/login` });
  if (inviteError || !invitedUserData?.user?.id) return NextResponse.json({ error: inviteError?.message || "Failed to invite student." }, { status: 500 });
  const newUserId = invitedUserData.user.id;
  await adminClient.from("profiles").upsert({ id: newUserId, full_name: fullName, email, role: "student", requested_role: "student", approval_status: "approved" }, { onConflict: "id" });
  await adminClient.from("classroom_members").insert({ classroom_id: classroomId, user_id: newUserId, joined_via: "master_created" });
  return NextResponse.json({ user_id: newUserId, full_name: fullName, email, status: "created_and_added" });
}
