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
    | "admin_missing_domain";
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
