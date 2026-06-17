import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminClassroomManagementScope = {
  type: "domain" | "master_global";
  domain: string | null;
  label: string;
};

export type AdminClassroomRosterMember = {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  emailDomain: string | null;
  joinedAt: string;
  joinedVia: string | null;
  isActive: boolean;
  canRemove: boolean;
};

export type AdminManagedClassroom = {
  id: string;
  name: string;
  subject: string | null;
  term: string | null;
  classCode: string;
  teacherId: string;
  teacherName: string | null;
  teacherEmail: string | null;
  teacherEmailDomain: string | null;
  rosterCount: number;
  roster: AdminClassroomRosterMember[];
};

export type AdminEligibleStudent = {
  id: string;
  fullName: string | null;
  email: string | null;
  emailDomain: string | null;
  alreadyInClassroom: boolean;
};

export type AdminClassroomManagement = {
  scope: AdminClassroomManagementScope;
  classrooms: AdminManagedClassroom[];
  eligibleStudents: AdminEligibleStudent[];
};

export type AdminClassroomManagementAccessError = {
  error: string;
  code?:
    | "unauthorized"
    | "admin_denied"
    | "admin_pending"
    | "admin_missing_domain"
    | "classroom_not_found"
    | "student_not_found"
    | "invalid_student"
    | "inactive_student";
};

export type AdminClassroomMemberAddStatus = "added" | "already_enrolled";
export type AdminClassroomMemberRemoveStatus = "removed" | "not_found";

export type AdminClassroomMemberMutationResult<
  TStatus extends string = AdminClassroomMemberAddStatus | AdminClassroomMemberRemoveStatus,
> = {
  ok: true;
  status: TStatus;
};

export async function getAdminClassroomManagement(params?: {
  classroomId?: string | null;
  search?: string;
}): Promise<AdminClassroomManagement> {
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

  const query = new URLSearchParams();
  if (params?.classroomId) query.set("classroomId", params.classroomId);
  if (params?.search) query.set("q", params.search);

  const response = await fetch(
    `/api/admin/classroom-management${query.toString() ? `?${query}` : ""}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | AdminClassroomManagement
    | AdminClassroomManagementAccessError
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload
        ? payload.error
        : "Failed to load classroom management data.";
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    throw error;
  }

  return payload as AdminClassroomManagement;
}

async function getAdminClassroomManagementAccessToken() {
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

  return session.access_token;
}

async function parseAdminClassroomManagementMutationResponse<TStatus extends string>(
  response: Response,
  fallbackMessage: string,
): Promise<AdminClassroomMemberMutationResult<TStatus>> {
  const payload = (await response.json().catch(() => null)) as
    | AdminClassroomMemberMutationResult<TStatus>
    | AdminClassroomManagementAccessError
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload ? payload.error : fallbackMessage;
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    throw error;
  }

  return payload as AdminClassroomMemberMutationResult<TStatus>;
}

export async function addAdminClassroomMember(
  classroomId: string,
  userId: string,
): Promise<AdminClassroomMemberMutationResult<AdminClassroomMemberAddStatus>> {
  const accessToken = await getAdminClassroomManagementAccessToken();
  const response = await fetch(
    `/api/admin/classroom-management/${encodeURIComponent(classroomId)}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    },
  );

  return parseAdminClassroomManagementMutationResponse<AdminClassroomMemberAddStatus>(
    response,
    "Failed to add student to classroom.",
  );
}

export async function removeAdminClassroomMember(
  classroomId: string,
  userId: string,
): Promise<AdminClassroomMemberMutationResult<AdminClassroomMemberRemoveStatus>> {
  const accessToken = await getAdminClassroomManagementAccessToken();
  const response = await fetch(
    `/api/admin/classroom-management/${encodeURIComponent(classroomId)}/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  return parseAdminClassroomManagementMutationResponse<AdminClassroomMemberRemoveStatus>(
    response,
    "Failed to remove student from classroom.",
  );
}
