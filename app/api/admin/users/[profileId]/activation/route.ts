import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import {
  canAccessAdminRoute,
  getEmailDomain,
  isMasterRole,
} from "@/lib/auth/roles";

type Ctx = { params: Promise<{ profileId: string }> };

type ActivationAction = "deactivate" | "reactivate";

type ProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
  is_active: boolean | null;
  deactivated_at: string | null;
};

class AdminUserActivationApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?:
      | "unauthorized"
      | "admin_denied"
      | "admin_pending"
      | "admin_missing_domain"
      | "not_found"
      | "protected_account"
      | "invalid_action",
  ) {
    super(message);
  }
}

function jsonError(error: unknown) {
  if (error instanceof AdminUserActivationApiError) {
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
          : "Failed to update user activation status.",
    },
    { status: 500 },
  );
}

async function getRouteContext(req: NextRequest): Promise<{
  adminClient: SupabaseClient;
  requester: Pick<
    ProfileRow,
    | "id"
    | "email"
    | "role"
    | "requested_role"
    | "approval_status"
    | "email_domain"
  >;
  requesterUser: User;
  isMaster: boolean;
  domain: string | null;
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new AdminUserActivationApiError(
      "Missing Supabase environment variables.",
      500,
    );
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    throw new AdminUserActivationApiError(
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
    throw new AdminUserActivationApiError(
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
    throw new AdminUserActivationApiError(
      profileError.message || "Failed to verify administrator access.",
      500,
    );
  }

  const requester = profileData as Pick<
    ProfileRow,
    | "id"
    | "email"
    | "role"
    | "requested_role"
    | "approval_status"
    | "email_domain"
    | "is_active"
  > | null;

  if (!requester) {
    throw new AdminUserActivationApiError(
      "Profile not found.",
      403,
      "admin_denied",
    );
  }

  if (requester.is_active === false) {
    throw new AdminUserActivationApiError(
      "Administrator account is inactive.",
      403,
      "admin_denied",
    );
  }

  if (!canAccessAdminRoute(requester.role, requester.approval_status)) {
    const isPendingAdmin =
      requester.requested_role === "admin" &&
      requester.approval_status === "pending" &&
      requester.role !== "admin";

    throw new AdminUserActivationApiError(
      isPendingAdmin
        ? "Administrator approval pending."
        : "Administrator access requires an approved administrator account.",
      403,
      isPendingAdmin ? "admin_pending" : "admin_denied",
    );
  }

  const isMaster = isMasterRole(requester.role);
  const domain = requester.email_domain ?? getEmailDomain(requester.email);

  if (!isMaster && !domain) {
    throw new AdminUserActivationApiError(
      "Administrator account is missing an email domain.",
      403,
      "admin_missing_domain",
    );
  }

  return { adminClient, requester, requesterUser: user, isMaster, domain };
}

function parseAction(body: unknown): ActivationAction {
  const action =
    typeof body === "object" && body !== null && "action" in body
      ? body.action
      : null;

  if (action === "deactivate" || action === "reactivate") {
    return action;
  }

  throw new AdminUserActivationApiError(
    "Activation action must be deactivate or reactivate.",
    400,
    "invalid_action",
  );
}

function assertCanManageTarget({
  requesterUserId,
  isMaster,
  domain,
  target,
}: {
  requesterUserId: string;
  isMaster: boolean;
  domain: string | null;
  target: ProfileRow;
}) {
  if (target.id === requesterUserId) {
    throw new AdminUserActivationApiError(
      "You cannot change your own activation status.",
      403,
      "protected_account",
    );
  }

  if (target.role === "master") {
    throw new AdminUserActivationApiError(
      "Master accounts are protected from activation changes.",
      403,
      "protected_account",
    );
  }

  if (isMaster) {
    if (
      target.role === "student" ||
      target.role === "teacher" ||
      target.role === "admin"
    ) {
      return;
    }

    throw new AdminUserActivationApiError(
      "This account cannot be managed by activation actions.",
      403,
      "protected_account",
    );
  }

  const targetDomain = target.email_domain ?? getEmailDomain(target.email);

  if (!targetDomain || targetDomain !== domain) {
    throw new AdminUserActivationApiError(
      "Administrators can only manage users in their own email domain.",
      403,
      "admin_denied",
    );
  }

  if (target.role !== "student" && target.role !== "teacher") {
    throw new AdminUserActivationApiError(
      "Administrators can only manage student and teacher accounts.",
      403,
      "protected_account",
    );
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { profileId } = await ctx.params;
    const body = (await req.json().catch(() => null)) as unknown;
    const action = parseAction(body);
    const { adminClient, requesterUser, isMaster, domain } =
      await getRouteContext(req);

    const { data: targetData, error: targetError } = await adminClient
      .from("profiles")
      .select(
        "id,email,role,requested_role,approval_status,email_domain,is_active,deactivated_at",
      )
      .eq("id", profileId)
      .maybeSingle();

    if (targetError) {
      throw new AdminUserActivationApiError(
        targetError.message || "Failed to load target profile.",
        500,
      );
    }

    const target = targetData as ProfileRow | null;

    if (!target) {
      throw new AdminUserActivationApiError(
        "Target profile not found.",
        404,
        "not_found",
      );
    }

    assertCanManageTarget({
      requesterUserId: requesterUser.id,
      isMaster,
      domain,
      target,
    });

    const updates =
      action === "deactivate"
        ? { is_active: false, deactivated_at: new Date().toISOString() }
        : { is_active: true, deactivated_at: null };

    const { data: updatedData, error: updateError } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", target.id)
      .select("id,is_active,deactivated_at")
      .single();

    if (updateError) {
      throw new AdminUserActivationApiError(
        updateError.message || "Failed to update activation status.",
        500,
      );
    }

    const updated = updatedData as Pick<
      ProfileRow,
      "id" | "is_active" | "deactivated_at"
    >;

    return NextResponse.json({
      user: {
        id: updated.id,
        isActive: updated.is_active ?? true,
        deactivatedAt: updated.deactivated_at,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
