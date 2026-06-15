import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEmailDomain, isApprovedStatus, isMasterRole } from "@/lib/auth/roles";

export type ApprovalProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
  created_at?: string | null;
};

export class AdminApprovalApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function approvalApiError(error: unknown) {
  if (error instanceof AdminApprovalApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to process administrator approval request.",
    },
    { status: 500 },
  );
}

export async function getApprovedMasterApprovalContext(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    throw new AdminApprovalApiError("Missing authorization token.", 401);
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
    throw new AdminApprovalApiError(userError?.message || "Unauthorized.", 401);
  }

  const { data: profileData, error: profileError } = await adminClient
    .from("profiles")
    .select("id,email,full_name,role,requested_role,approval_status,email_domain")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Failed to verify administrator approval access.");
  }

  const profile = profileData as ApprovalProfileRow | null;

  if (!profile) {
    throw new AdminApprovalApiError("Profile not found.", 403);
  }

  if (!isMasterRole(profile.role) || !isApprovedStatus(profile.approval_status)) {
    throw new AdminApprovalApiError("Only approved Master users can manage administrator approvals.", 403);
  }

  return { adminClient, profile };
}

export function toApprovalRequest(row: ApprovalProfileRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    emailDomain: row.email_domain ?? getEmailDomain(row.email),
    requestedRole: "admin" as const,
    approvalStatus: "pending" as const,
    createdAt: row.created_at ?? null,
  };
}
