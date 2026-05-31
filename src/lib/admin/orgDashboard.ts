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
