import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminQuickAssignStudent = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export type AdminQuickAssignMetrics = {
  quickAssignmentCount: number;
  assignmentRows: number;
  chapterCount: number;
  sectionCount: number;
  completionPercent: number | null;
  accuracyPercent: number | null;
  attempts: number;
};

export type AdminQuickAssignment = {
  id: string;
  title: string;
  sectionId: string | null;
  sectionTitle: string;
  chapterId: string | null;
  chapterNumber: number | null;
  sectionNumber: number | null;
  dueDate: string | null;
  createdAt: string;
  status: string;
  completionPercent: number | null;
  accuracyPercent: number | null;
  attempts: number;
};

export type AdminQuickAssignData = {
  student: AdminQuickAssignStudent;
  quickClass: { id: string; name: string } | null;
  metrics: AdminQuickAssignMetrics;
  assignments: AdminQuickAssignment[];
};

export type AdminQuickAssignCreateResult = {
  classroom: { id: string; name: string; created: boolean };
  title: string;
  assignmentCount: number;
  recipientCount: number;
  classroomMembershipCreated: boolean;
};

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw new Error(error.message || "Failed to verify session.");
  if (!session?.access_token) throw new Error("Please sign in again.");
  return session.access_token;
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

export async function getAdminQuickAssignData(
  studentUserId: string,
): Promise<AdminQuickAssignData> {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/admin/quick-assign/students/${studentUserId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return parseResponse<AdminQuickAssignData>(
    response,
    "Failed to load Quick Assign data.",
  );
}

export async function createAdminQuickAssign(params: {
  studentUserId: string;
  chapterIds: string[];
}): Promise<AdminQuickAssignCreateResult> {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/admin/quick-assign/students/${params.studentUserId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ chapterIds: params.chapterIds }),
  });

  return parseResponse<AdminQuickAssignCreateResult>(
    response,
    "Failed to create Quick Assignments.",
  );
}
