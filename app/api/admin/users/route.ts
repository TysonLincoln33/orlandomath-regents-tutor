import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  canAccessAdminRoute,
  getEmailDomain,
  isMasterRole,
} from "@/lib/auth/roles";
import type { AdminUserDirectory } from "@/lib/admin/userDirectory";

type ProfileRow = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
  is_active: boolean | null;
  deactivated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  can_manage_activation?: boolean;
};

class AdminUsersApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?:
      | "unauthorized"
      | "admin_denied"
      | "admin_pending"
      | "admin_missing_domain",
  ) {
    super(message);
  }
}

function jsonError(error: unknown) {
  if (error instanceof AdminUsersApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to load user directory.",
    },
    { status: 500 },
  );
}

async function getRouteContext(req: NextRequest): Promise<{
  adminClient: SupabaseClient;
  isMaster: boolean;
  domain: string | null;
  requesterId: string;
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new AdminUsersApiError(
      "Missing Supabase environment variables.",
      500,
    );
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    throw new AdminUsersApiError(
      "Missing authorization token.",
      401,
      "unauthorized",
    );
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
    throw new AdminUsersApiError(
      userError?.message || "Unauthorized.",
      401,
      "unauthorized",
    );
  }

  const { data: profileData, error: profileError } = await adminClient
    .from("profiles")
    .select(
      "id,email,role,requested_role,approval_status,email_domain,is_active",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new AdminUsersApiError(
      profileError.message || "Failed to verify administrator access.",
      500,
    );
  }

  const profile = profileData as Pick<
    ProfileRow,
    | "email"
    | "role"
    | "requested_role"
    | "approval_status"
    | "email_domain"
    | "is_active"
  > | null;

  if (!profile) {
    throw new AdminUsersApiError("Profile not found.", 403, "admin_denied");
  }

  if (profile.is_active === false) {
    throw new AdminUsersApiError(
      "Administrator account is inactive.",
      403,
      "admin_denied",
    );
  }

  if (!canAccessAdminRoute(profile.role, profile.approval_status)) {
    const isPendingAdmin =
      profile.requested_role === "admin" &&
      profile.approval_status === "pending" &&
      profile.role !== "admin";

    throw new AdminUsersApiError(
      isPendingAdmin
        ? "Administrator approval pending."
        : "Administrator access requires an approved administrator account.",
      403,
      isPendingAdmin ? "admin_pending" : "admin_denied",
    );
  }

  const isMaster = isMasterRole(profile.role);
  const domain = effectiveDomain(profile);

  if (!isMaster && !domain) {
    throw new AdminUsersApiError(
      "Administrator account is missing an email domain.",
      403,
      "admin_missing_domain",
    );
  }

  return { adminClient, isMaster, domain, requesterId: user.id };
}

function effectiveDomain(profile: Pick<ProfileRow, "email" | "email_domain"> | null | undefined) {
  return profile?.email_domain ?? getEmailDomain(profile?.email);
}

function isInEffectiveDomain(
  profile: Pick<ProfileRow, "email" | "email_domain">,
  domain: string | null,
) {
  return Boolean(domain) && effectiveDomain(profile) === domain;
}

function canManageActivation(
  row: ProfileRow,
  requesterId: string,
  isMaster: boolean,
  domain: string | null,
) {
  if (row.id === requesterId || row.role === "master") {
    return false;
  }

  if (isMaster) {
    return (
      row.role === "student" || row.role === "teacher" || row.role === "admin"
    );
  }

  const targetDomain = effectiveDomain(row);
  return (
    targetDomain === domain &&
    (row.role === "student" || row.role === "teacher")
  );
}

function normalizeUser(row: ProfileRow): AdminUserDirectory["users"][number] {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    emailDomain: effectiveDomain(row),
    role: row.role ?? "student",
    requestedRole: row.requested_role,
    approvalStatus: row.approval_status,
    isActive: row.is_active ?? true,
    deactivatedAt: row.deactivated_at,
    canManageActivation: row.can_manage_activation ?? false,
    createdAt: row.created_at,
    lastActivityAt: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { adminClient, isMaster, domain, requesterId } =
      await getRouteContext(req);

    const usersQuery = adminClient
      .from("profiles")
      .select(
        "id,email,username,full_name,role,requested_role,approval_status,email_domain,is_active,deactivated_at,created_at,updated_at",
      )
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("email", { ascending: true });

    const { data, error } = await usersQuery;

    if (error) {
      throw new AdminUsersApiError(
        error.message || "Failed to load user directory.",
        500,
      );
    }

    return NextResponse.json({
      scope: {
        type: isMaster ? "master_global" : "domain",
        domain: isMaster ? null : domain,
        label: isMaster
          ? "Master Global User Directory"
          : `User Directory for ${domain}`,
      },
      users: ((data ?? []) as ProfileRow[])
        .filter((row) => isMaster || isInEffectiveDomain(row, domain))
        .map((row) =>
          normalizeUser({
            ...row,
            can_manage_activation: canManageActivation(
              row,
              requesterId,
              isMaster,
              domain,
            ),
          }),
        ),
    } satisfies AdminUserDirectory);
  } catch (error) {
    return jsonError(error);
  }
}
