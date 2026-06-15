import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminApprovalRequest = {
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

export type AdminApprovalAction = "approve" | "deny";

export type AdminApprovalRequestsResponse = {
  requests: AdminApprovalRequest[];
};

export type AdminApprovalActionResponse = {
  request: AdminApprovalRequest;
};

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || "Failed to verify session.");
  }

  if (!session?.access_token) {
    const sessionError = new Error("Please sign in again.") as Error & { status?: number };
    sessionError.status = 401;
    throw sessionError;
  }

  return session.access_token;
}

async function parseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  const message = payload?.error || fallback;
  const error = new Error(message) as Error & { status?: number };
  error.status = response.status;
  throw error;
}

export async function getAdminApprovalRequests(): Promise<AdminApprovalRequestsResponse> {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/admin/approval-requests", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    await parseError(response, "Failed to load approval requests.");
  }

  return (await response.json()) as AdminApprovalRequestsResponse;
}

export async function updateAdminApprovalRequest(
  requestId: string,
  action: AdminApprovalAction,
): Promise<AdminApprovalActionResponse> {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/admin/approval-requests", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId, action }),
  });

  if (!response.ok) {
    await parseError(response, "Failed to update approval request.");
  }

  return (await response.json()) as AdminApprovalActionResponse;
}
