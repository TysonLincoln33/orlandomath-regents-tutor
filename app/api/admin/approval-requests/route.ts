import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isMasterRole } from "@/lib/auth/roles";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ApprovalAction = "approve" | "deny";

class ApprovalRequestsApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function jsonError(error: unknown) {
  if (error instanceof ApprovalRequestsApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Failed to manage approval requests." },
    { status: 500 },
  );
}

async function getMasterApprovalContext(req: NextRequest): Promise<{ adminClient: SupabaseClient }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new ApprovalRequestsApiError("Missing Supabase environment variables.", 500);
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!accessToken) {
    throw new ApprovalRequestsApiError("Missing authorization token.", 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new ApprovalRequestsApiError(userError?.message || "Unauthorized.", 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role,approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new ApprovalRequestsApiError(profileError.message || "Failed to verify profile.", 500);
  }

  if (!profile || !isMasterRole(profile.role) || profile.approval_status !== "approved") {
    throw new ApprovalRequestsApiError("Master access required.", 403);
  }

  return { adminClient };
}

function normalizeAction(value: unknown): ApprovalAction | null {
  if (value === "approve" || value === "deny") return value;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { adminClient } = await getMasterApprovalContext(req);
    const { data, error } = await adminClient
      .from("profiles")
      .select("id,email,full_name,role,requested_role,approval_status,email_domain,created_at,updated_at")
      .eq("role", "student")
      .eq("requested_role", "admin")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApprovalRequestsApiError(error.message || "Failed to load approval requests.", 500);
    }

    return NextResponse.json({ requests: (data ?? []) as ProfileRow[] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { adminClient } = await getMasterApprovalContext(req);
    const body = await req.json().catch(() => null);
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    const action = normalizeAction(body?.action);

    if (!requestId) {
      throw new ApprovalRequestsApiError("Approval request id is required.", 400);
    }

    if (!action) {
      throw new ApprovalRequestsApiError("Action must be approve or deny.", 400);
    }

    const updates =
      action === "approve"
        ? { role: "admin", requested_role: "admin", approval_status: "approved" }
        : { role: "student", requested_role: "admin", approval_status: "denied" };

    const { data, error } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", requestId)
      .eq("role", "student")
      .eq("requested_role", "admin")
      .eq("approval_status", "pending")
      .select("id,email,full_name,role,requested_role,approval_status,email_domain,created_at,updated_at")
      .maybeSingle();

    if (error) {
      throw new ApprovalRequestsApiError(error.message || "Failed to update approval request.", 500);
    }

    if (!data) {
      throw new ApprovalRequestsApiError("Pending administrator request not found.", 404);
    }

    return NextResponse.json({ request: data as ProfileRow });
  } catch (error) {
    return jsonError(error);
  }
}
