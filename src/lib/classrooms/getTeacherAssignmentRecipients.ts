// src/lib/classrooms/getTeacherAssignmentRecipients.ts
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type TeacherAssignmentRecipientRow = {
  assignment_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  status: "assigned" | "completed" | "excused" | "archived" | string;
  completion_percent: number | string | null;
  accuracy_percent: number | string | null;
  is_complete: boolean | null;
  completed_at: string | null;
  last_active_at: string | null;
  questions_attempted: number | string | null;
  questions_correct: number | string | null;
};

export type TeacherAssignmentRecipient = {
  assignmentId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  status: string;
  completionPercent: number;
  accuracyPercent: number | null;
  isComplete: boolean;
  isExcused: boolean;
  completedAt: string | null;
  lastActiveAt: string | null;
  questionsAttempted: number;
  questionsCorrect: number;
};

export type TeacherAssignmentRecipientSummary = {
  recipientCount: number;
  completedCount: number;
  incompleteCount: number;
  excusedCount: number;
  averageCompletion: number;
  averageAccuracy: number | null;
};

export type TeacherAssignmentRecipientsResult = {
  summary: TeacherAssignmentRecipientSummary;
  recipients: TeacherAssignmentRecipient[];
  rows: TeacherAssignmentRecipientRow[];
};

function toNumber(value: number | string | null | undefined): number {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return clampPercent(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function buildAssignmentRecipientsResult(
  rows: TeacherAssignmentRecipientRow[],
): TeacherAssignmentRecipientsResult {
  const recipients = rows.map((row) => {
    const completionPercent = clampPercent(toNumber(row.completion_percent));
    const questionsAttempted = toNumber(row.questions_attempted);
    const questionsCorrect = toNumber(row.questions_correct);
    const rawAccuracy = row.accuracy_percent;
    const accuracyValue =
      questionsAttempted === 0 ||
      rawAccuracy === null ||
      rawAccuracy === undefined
        ? null
        : clampPercent(toNumber(rawAccuracy));
    const isExcused = row.status === "excused";
    const isComplete = Boolean(row.is_complete) || row.status === "completed";

    return {
      assignmentId: row.assignment_id,
      userId: row.user_id,
      fullName: row.full_name ?? null,
      email: row.email ?? null,
      status: row.status ?? "assigned",
      completionPercent,
      accuracyPercent: accuracyValue,
      isComplete,
      isExcused,
      completedAt: row.completed_at ?? null,
      lastActiveAt: row.last_active_at ?? null,
      questionsAttempted,
      questionsCorrect,
    };
  });

  const completedCount = recipients.filter(
    (recipient) => recipient.isComplete && !recipient.isExcused,
  ).length;
  const excusedCount = recipients.filter(
    (recipient) => recipient.isExcused,
  ).length;
  const incompleteCount = Math.max(
    recipients.length - completedCount - excusedCount,
    0,
  );
  const averageAccuracy = average(
    recipients
      .map((recipient) => recipient.accuracyPercent)
      .filter((value): value is number => value !== null),
  );

  return {
    recipients,
    rows,
    summary: {
      recipientCount: recipients.length,
      completedCount,
      incompleteCount,
      excusedCount,
      averageCompletion:
        average(recipients.map((recipient) => recipient.completionPercent)) ??
        0,
      averageAccuracy,
    },
  };
}

export async function getTeacherAssignmentRecipients(
  classroomId: string,
  assignmentId: string,
): Promise<TeacherAssignmentRecipientsResult> {
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

  return buildAssignmentRecipientsResult(
    (Array.isArray(data) ? data : []) as TeacherAssignmentRecipientRow[],
  );
}
