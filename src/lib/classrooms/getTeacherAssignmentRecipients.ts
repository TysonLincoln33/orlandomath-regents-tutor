import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClassroomAssignment } from "@/lib/classrooms/createClassroomAssignment";

export type TeacherAssignmentRecipientStatus =
  | "assigned"
  | "completed"
  | "excused"
  | "archived";

export type TeacherAssignmentRecipientRow = {
  assignment_id: string;
  assignment_title: string;
  assignment_section_id: string | null;
  assignment_due_date: string | null;
  assignment_created_at: string;
  assignment_updated_at: string | null;
  user_id: string;
  full_name: string | null;
  email: string | null;
  status: TeacherAssignmentRecipientStatus;
  assigned_at: string;
  completed_at: string | null;
  questions_attempted: number | string | null;
  questions_correct: number | string | null;
  completion_percent: number | string | null;
  accuracy_percent: number | string | null;
  attempt_count: number | string | null;
  correct_count: number | string | null;
  last_activity_at: string | null;
};

export type TeacherAssignmentRecipient = {
  userId: string;
  fullName: string | null;
  email: string | null;
  status: TeacherAssignmentRecipientStatus;
  assignedAt: string;
  completedAt: string | null;
  questionsAttempted: number;
  questionsCorrect: number;
  completionPercent: number;
  accuracyPercent: number;
  attemptCount: number;
  correctCount: number;
  lastActivityAt: string | null;
};

export type TeacherAssignmentRecipientDetail = {
  assignment: ClassroomAssignment;
  summary: {
    recipientCount: number;
    completedCount: number;
    incompleteCount: number;
    excusedCount: number;
    averageCompletion: number;
    averageAccuracy: number;
  };
  recipients: TeacherAssignmentRecipient[];
};

function toNumber(value: number | string | null | undefined): number {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function averagePercent(values: number[]): number {
  if (values.length === 0) return 0;
  return clampPercent(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function buildAssignmentFallback(
  assignmentId: string,
  fallbackAssignment?: ClassroomAssignment,
): ClassroomAssignment {
  return {
    id: assignmentId,
    classroom_id: fallbackAssignment?.classroom_id ?? "",
    title: fallbackAssignment?.title ?? "Assignment",
    description: fallbackAssignment?.description ?? null,
    due_date: fallbackAssignment?.due_date ?? null,
    section_id: fallbackAssignment?.section_id ?? null,
    created_by: fallbackAssignment?.created_by ?? "",
    created_at: fallbackAssignment?.created_at ?? "",
    updated_at: fallbackAssignment?.updated_at ?? null,
    archived_at: fallbackAssignment?.archived_at ?? null,
    recipient_count: fallbackAssignment?.recipient_count ?? 0,
    completed_count: fallbackAssignment?.completed_count ?? 0,
    incomplete_count: fallbackAssignment?.incomplete_count ?? 0,
    excused_count: fallbackAssignment?.excused_count ?? 0,
  };
}

function buildTeacherAssignmentRecipientDetail(
  rows: TeacherAssignmentRecipientRow[],
  assignmentId: string,
  fallbackAssignment?: ClassroomAssignment,
): TeacherAssignmentRecipientDetail {
  const recipients = rows.map((row) => {
    const attemptCount = toNumber(row.attempt_count);
    const correctCount = toNumber(row.correct_count);
    const questionsAttempted =
      toNumber(row.questions_attempted) || attemptCount;
    const questionsCorrect = toNumber(row.questions_correct) || correctCount;

    return {
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      status: row.status,
      assignedAt: row.assigned_at,
      completedAt: row.completed_at,
      questionsAttempted,
      questionsCorrect,
      completionPercent: clampPercent(toNumber(row.completion_percent)),
      accuracyPercent: clampPercent(toNumber(row.accuracy_percent)),
      attemptCount,
      correctCount,
      lastActivityAt: row.last_activity_at,
    };
  });

  const firstRow = rows[0];
  const recipientCount = recipients.length;
  const completedCount = recipients.filter(
    (recipient) => recipient.status === "completed",
  ).length;
  const excusedCount = recipients.filter(
    (recipient) => recipient.status === "excused",
  ).length;
  const incompleteCount = Math.max(
    recipientCount - completedCount - excusedCount,
    0,
  );

  const assignment = firstRow
    ? {
        ...buildAssignmentFallback(assignmentId, fallbackAssignment),
        id: firstRow.assignment_id,
        title: firstRow.assignment_title,
        due_date: firstRow.assignment_due_date,
        section_id: firstRow.assignment_section_id,
        created_at: firstRow.assignment_created_at,
        updated_at: firstRow.assignment_updated_at,
        recipient_count: recipientCount,
        completed_count: completedCount,
        incomplete_count: incompleteCount,
        excused_count: excusedCount,
      }
    : buildAssignmentFallback(assignmentId, fallbackAssignment);

  return {
    assignment,
    summary: {
      recipientCount,
      completedCount,
      incompleteCount,
      excusedCount,
      averageCompletion: averagePercent(
        recipients.map((recipient) => recipient.completionPercent),
      ),
      averageAccuracy: averagePercent(
        recipients.map((recipient) => recipient.accuracyPercent),
      ),
    },
    recipients,
  };
}

export async function getTeacherAssignmentRecipients(
  classroomId: string,
  assignmentId: string,
  fallbackAssignment?: ClassroomAssignment,
): Promise<TeacherAssignmentRecipientDetail> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    rpc: (
      functionName: string,
      args: Record<string, string>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const { data, error } = await supabase.rpc(
    "get_teacher_assignment_recipients",
    {
      p_classroom_id: classroomId,
      p_assignment_id: assignmentId,
    },
  );

  if (error) {
    throw new Error(error.message || "Failed to load assignment recipients.");
  }

  return buildTeacherAssignmentRecipientDetail(
    (Array.isArray(data) ? data : []) as TeacherAssignmentRecipientRow[],
    assignmentId,
    fallbackAssignment,
  );
}
