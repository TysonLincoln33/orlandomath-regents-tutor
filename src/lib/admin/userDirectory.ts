import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminUserDirectoryScope = {
  type: "domain" | "master_global";
  domain: string | null;
  label: string;
};

export type AdminDirectoryUser = {
  id: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  emailDomain: string | null;
  role: string;
  requestedRole: string | null;
  approvalStatus: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  canManageActivation: boolean;
  createdAt: string | null;
  lastActivityAt: string | null;
};

export type AdminUserDirectory = {
  scope: AdminUserDirectoryScope;
  users: AdminDirectoryUser[];
};

export type AdminUserDirectoryAccessError = {
  error: string;
  code?:
    | "unauthorized"
    | "admin_denied"
    | "admin_pending"
    | "admin_missing_domain";
};

export async function getAdminUserDirectory(): Promise<AdminUserDirectory> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  if (!session?.access_token) {
    const error = new Error("Please sign in again.") as Error & {
      status?: number;
      code?: string;
    };
    error.status = 401;
    error.code = "unauthorized";
    throw error;
  }

  const response = await fetch("/api/admin/users", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const payload = (await response.json().catch(() => null)) as
    | AdminUserDirectory
    | AdminUserDirectoryAccessError
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload
        ? payload.error
        : "Failed to load user directory.";
    const error = new Error(message) as Error & {
      status?: number;
      code?: AdminUserDirectoryAccessError["code"];
    };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    throw error;
  }

  return payload as AdminUserDirectory;
}

export type AdminUserActivationAction = "deactivate" | "reactivate";

export async function updateAdminUserActivation(
  profileId: string,
  action: AdminUserActivationAction,
): Promise<{
  user: { id: string; isActive: boolean; deactivatedAt: string | null };
}> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to verify session.");
  }

  if (!session?.access_token) {
    const error = new Error("Please sign in again.") as Error & {
      status?: number;
      code?: string;
    };
    error.status = 401;
    error.code = "unauthorized";
    throw error;
  }

  const response = await fetch(`/api/admin/users/${profileId}/activation`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { user: { id: string; isActive: boolean; deactivatedAt: string | null } }
    | AdminUserDirectoryAccessError
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload
        ? payload.error
        : "Failed to update activation status.";
    const error = new Error(message) as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    throw error;
  }

  return payload as {
    user: { id: string; isActive: boolean; deactivatedAt: string | null };
  };
}
