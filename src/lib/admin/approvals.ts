import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminApprovalRequest = {
  id: string;
  fullName: string | null;
  email: string | null;
  emailDomain: string | null;
  requestedRole: "admin";
  approvalStatus: "pending";
  createdAt: string | null;
};

export type AdminApprovalsPayload = {
  requests: AdminApprovalRequest[];
};

export type AdminApprovalActionPayload = {
  message: string;
  profile: {
    id: string;
    role: "admin" | "student";
    requestedRole: "admin";
    approvalStatus: "approved" | "denied";
  };
};

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  if (!session?.access_token) {
    const error = new Error("Please sign in again.") as Error & { status?: number };
    error.status = 401;
    throw error;
  }

  return session.access_token;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    const error = new Error(payload?.error || fallbackMessage) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload as T;
}

export async function getPendingAdminApprovals(): Promise<AdminApprovalsPayload> {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/admin/approvals", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return parseJsonResponse<AdminApprovalsPayload>(
    response,
    "Failed to load administrator approval requests.",
  );
}

export async function approveAdminRequest(profileId: string): Promise<AdminApprovalActionPayload> {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/admin/approvals/${profileId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return parseJsonResponse<AdminApprovalActionPayload>(
    response,
    "Failed to approve administrator request.",
  );
}

export async function denyAdminRequest(profileId: string): Promise<AdminApprovalActionPayload> {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/admin/approvals/${profileId}/deny`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return parseJsonResponse<AdminApprovalActionPayload>(
    response,
    "Failed to deny administrator request.",
  );
}
