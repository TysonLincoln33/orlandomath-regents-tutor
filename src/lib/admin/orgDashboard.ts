import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminDashboardScope = {
  type: "domain" | "master_global";
  domain: string | null;
  label: string;
};

export type AdminDashboardSummary = {
  organizationLabel: string;
  totalTeachers: number;
  totalStudents: number;
  totalClassrooms: number;
  activeAssignments: number;
  archivedAssignments: number;
  totalGroupedAssignments: number;
  averageCompletion: number | null;
  averageAccuracy: number | null;
};

export type AdminDashboardTeacher = {
  id: string;
  fullName: string | null;
  email: string | null;
  classroomCount: number;
  studentCount: number;
  assignmentCount: number;
  averageCompletion: number | null;
  averageAccuracy: number | null;
};

export type AdminDashboardStudent = {
  id: string;
  fullName: string | null;
  email: string | null;
  emailDomain: string | null;
  isActive: boolean;
  classroomCount: number;
  assignedWorkCount: number;
  completionPercent: number | null;
  accuracyPercent: number | null;
  lastActivityAt: string | null;
};

export type AdminDashboardClassroom = {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string | null;
  teacherEmail: string | null;
  studentCount: number;
  assignmentCount: number;
  averageCompletion: number | null;
  averageAccuracy: number | null;
};

export type AdminDashboardAssignmentRecipient = {
  userId: string;
  fullName: string | null;
  email: string | null;
  status: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  completionPercent: number | null;
  accuracyPercent: number | null;
  hasProgress: boolean;
  hasAttempts: boolean;
};

export type AdminDashboardSectionAssignment = {
  id: string;
  sectionId: string | null;
  sectionTitle: string;
  dueDate: string | null;
  createdAt: string;
  archivedAt: string | null;
  recipientCount: number;
  completedCount: number;
  incompleteCount: number;
  excusedCount: number;
  recipients: AdminDashboardAssignmentRecipient[];
};

export type AdminDashboardAssignment = {
  id: string;
  assignmentIds: string[];
  title: string;
  description: string | null;
  teacherId: string;
  teacherName: string | null;
  teacherEmail: string | null;
  classroomId: string;
  classroomName: string | null;
  dueDate: string | null;
  sectionIds: (string | null)[];
  sectionCount: number;
  recipientCount: number;
  completedCount: number;
  incompleteCount: number;
  excusedCount: number;
  averageProgress: number | null;
  archivedAt: string | null;
  sectionAssignments: AdminDashboardSectionAssignment[];
};

export type AdminDashboardRecentAttempt = {
  questionId: string | null;
  sectionId: string | null;
  sectionTitle: string;
  correct: boolean | null;
  attemptedAt: string | null;
};

export type AdminDashboardActivity = {
  type: "assignment" | "progress" | "attempt";
  label: string;
  detail: string;
  occurredAt: string | null;
  studentId?: string;
  studentName?: string | null;
  studentEmail?: string | null;
  correct?: boolean | null;
};

export type AdminDashboardStudentDetail = {
  studentId: string;
  fullName: string | null;
  email: string | null;
  classrooms: Array<{ id: string; name: string; teacherName: string | null; teacherEmail: string | null }>;
  assignedWorkCount: number;
  overallCompletion: number | null;
  overallAccuracy: number | null;
  totalQuestionAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  recentActivity: AdminDashboardActivity[];
  recentQuestionAttempts: AdminDashboardRecentAttempt[];
};

export type AdminOrgDashboard = {
  scope: AdminDashboardScope;
  summary: AdminDashboardSummary;
  teachers: AdminDashboardTeacher[];
  students: AdminDashboardStudent[];
  classrooms: AdminDashboardClassroom[];
  assignments: AdminDashboardAssignment[];
  studentDetails: Record<string, AdminDashboardStudentDetail>;
  recentActivity: AdminDashboardActivity[];
};

export type AdminDashboardAccessErrorCode =
  | "admin_pending"
  | "admin_denied"
  | "admin_missing_domain"
  | "unauthorized";

export type AdminDashboardAccessError = {
  code?: AdminDashboardAccessErrorCode;
  error: string;
  profile?: {
    requested_role: string | null;
    approval_status: string | null;
    email_domain: string | null;
  };
};

export async function getAdminOrgDashboard(): Promise<AdminOrgDashboard> {
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
      code?: AdminDashboardAccessErrorCode;
      status?: number;
    };
    error.code = "unauthorized";
    error.status = 401;
    throw error;
  }

  const response = await fetch("/api/admin/org-dashboard", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | AdminOrgDashboard
    | AdminDashboardAccessError
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload
        ? payload.error
        : "Failed to load administrator dashboard.";
    const error = new Error(message) as Error & {
      status?: number;
      code?: AdminDashboardAccessErrorCode;
      payload?: AdminDashboardAccessError | null;
    };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    error.payload = payload && "error" in payload ? payload : null;
    throw error;
  }

  return payload as AdminOrgDashboard;
}

export type AdminAssignmentRecipientAction = "excuse" | "unexcuse";

export type AdminAssignmentRecipientMutationResult = {
  recipient: {
    assignment_id: string;
    classroom_id: string;
    user_id: string;
    status: string;
    assigned_at: string | null;
    completed_at: string | null;
  };
};

export type AdminAssignmentRecipientBulkMutationResult = {
  recipients: AdminAssignmentRecipientMutationResult["recipient"][];
  updated_count: number;
};

export type AdminAssignmentRecipientCreateResult = {
  recipient: AdminAssignmentRecipientMutationResult["recipient"];
};

export type AdminAssignmentRecipientBulkCreateResult = {
  recipients: AdminAssignmentRecipientMutationResult["recipient"][];
  created_count: number;
};

export type AdminAssignmentRecipientRemoveResult = {
  removed: true;
  removed_count: number;
  recipient?: AdminAssignmentRecipientMutationResult["recipient"];
  recipients?: AdminAssignmentRecipientMutationResult["recipient"][];
};

export async function updateAdminAssignmentRecipient(
  assignmentId: string,
  userId: string,
  action: AdminAssignmentRecipientAction,
): Promise<AdminAssignmentRecipientMutationResult> {
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

  const response = await fetch(
    `/api/admin/assignments/${assignmentId}/recipients/${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | AdminAssignmentRecipientMutationResult
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    const error = new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Failed to update assignment recipient.",
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    throw error;
  }

  return payload as AdminAssignmentRecipientMutationResult;
}

export async function updateAdminAssignmentRecipientsBulk(
  assignmentIds: string[],
  userId: string,
  action: AdminAssignmentRecipientAction,
): Promise<AdminAssignmentRecipientBulkMutationResult> {
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

  const response = await fetch(`/api/admin/assignments/recipients/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, assignmentIds }),
  });

  const payload = (await response.json().catch(() => null)) as
    | AdminAssignmentRecipientBulkMutationResult
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    const error = new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Failed to update assignment recipients.",
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload && "code" in payload ? payload.code : undefined;
    throw error;
  }

  return payload as AdminAssignmentRecipientBulkMutationResult;
}

async function getAdminAssignmentMutationAccessToken() {
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

async function parseAdminAssignmentMutationResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string; code?: string }
    | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" && "error" in payload
        ? payload
        : null;
    const error = new Error(
      errorPayload?.error
        ? errorPayload.error
        : fallbackMessage,
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code =
      errorPayload && "code" in errorPayload ? errorPayload.code : undefined;
    throw error;
  }

  return payload as T;
}

export async function addAdminAssignmentRecipient(
  assignmentId: string,
  userId: string,
  options?: { addToClassroomIfNeeded?: boolean },
): Promise<AdminAssignmentRecipientCreateResult> {
  const accessToken = await getAdminAssignmentMutationAccessToken();
  const response = await fetch(`/api/admin/assignments/${assignmentId}/recipients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      userId,
      addToClassroomIfNeeded: options?.addToClassroomIfNeeded === true,
    }),
  });

  return parseAdminAssignmentMutationResponse<AdminAssignmentRecipientCreateResult>(
    response,
    "Failed to add assignment recipient.",
  );
}

export async function removeAdminAssignmentRecipient(
  assignmentId: string,
  userId: string,
): Promise<AdminAssignmentRecipientRemoveResult> {
  const accessToken = await getAdminAssignmentMutationAccessToken();
  const response = await fetch(
    `/api/admin/assignments/${assignmentId}/recipients/${userId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  return parseAdminAssignmentMutationResponse<AdminAssignmentRecipientRemoveResult>(
    response,
    "Failed to remove assignment recipient.",
  );
}

export async function addAdminAssignmentRecipientsBulk(
  assignmentIds: string[],
  userId: string,
  options?: { addToClassroomIfNeeded?: boolean },
): Promise<AdminAssignmentRecipientBulkCreateResult> {
  const accessToken = await getAdminAssignmentMutationAccessToken();
  const response = await fetch(`/api/admin/assignments/recipients/${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      assignmentIds,
      addToClassroomIfNeeded: options?.addToClassroomIfNeeded === true,
    }),
  });

  return parseAdminAssignmentMutationResponse<AdminAssignmentRecipientBulkCreateResult>(
    response,
    "Failed to add assignment recipients.",
  );
}

export async function removeAdminAssignmentRecipientsBulk(
  assignmentIds: string[],
  userId: string,
): Promise<AdminAssignmentRecipientRemoveResult> {
  const accessToken = await getAdminAssignmentMutationAccessToken();
  const response = await fetch(`/api/admin/assignments/recipients/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ assignmentIds }),
  });

  return parseAdminAssignmentMutationResponse<AdminAssignmentRecipientRemoveResult>(
    response,
    "Failed to remove assignment recipients.",
  );
}
